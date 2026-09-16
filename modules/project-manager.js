// modules/project-manager.js
class ProjectManager {
    constructor() {
        this._currentProject = null;
    }

    async createNew() {
        const name = document.getElementById('projectNameInput').value.trim();
        if (!name) {
            alert('Введите имя проекта!');
            return;
        }

        if (!STATE.project.folderHandle) {
            alert('Выберите папку для проекта!');
            return;
        }

        try {
            const folder = await STATE.project.folderHandle.getDirectoryHandle(name, { create: true });
            this._currentProject = { name, folderHandle: folder };
            this._resetScene();
            this._updateUI(name);
            Utils.showStatus(`✅ Проект "${name}" создан!`);
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error(err);
                alert('Ошибка при создании проекта: ' + err.message);
            }
        }
    }

    async save() {
        if (!this._currentProject) {
            alert('Сначала создайте новый проект через меню "Новый проект..."');
            return;
        }
        if (STATE.objects.length === 0) {
            alert('Нет объектов для сохранения!');
            return;
        }

        try {
            await this._writeGeometryFile();
            await this._writeGraphFile();
            Utils.showStatus(`✅ Проект сохранен! geometry.json и graph.json`);
        } catch (err) {
            console.error(err);
            alert('Ошибка при сохранении: ' + err.message);
        }
    }

    open() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => e.target.files[0] && this._importData(e.target.files[0]);
        input.click();
    }

    _resetScene() {
        STATE.objects.forEach(o => Engine.scene.remove(o.root));
        STATE.objects = [];
        STATE.objectCounter = 0;
        STATE.pipelineCounter = 0;
        STATE.branchCounter = 0;
        STATE.rowCounter = 0;
        STATE.valveCounter = 0;
        STATE.nodeCounter = 0;
        Tree.update();
    }

    _updateUI(name) {
        document.getElementById('projectNameDisplay').textContent = `📁 Проект: ${name}`;
        document.getElementById('projectPathDisplay').textContent = 
            `Путь: ${STATE.project.folderHandle.name}/${name}`;
        document.getElementById('projectInfo').classList.add('show');
    }

    async _writeGeometryFile() {
        const data = {
            version: 8,
            projectName: this._currentProject.name,
            savedAt: new Date().toISOString(),
            scene: {
                planeWidth: parseFloat(document.getElementById('planeWidth').value),
                planeDepth: parseFloat(document.getElementById('planeDepth').value),
                axesSize: parseFloat(document.getElementById('axesSizeInput').value)
            },
            nodeCounter: STATE.nodeCounter,
            objects: STATE.objects.map(o => ({
                id: o.id,
                type: o.type,
                userData: o.userData,
                position: [o.root.position.x, o.root.position.y, o.root.position.z],
                rotation: [o.root.rotation.x, o.root.rotation.y, o.root.rotation.z]
            }))
        };
        const handle = await this._currentProject.folderHandle.getFileHandle('geometry.json', { create: true });
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(data, null, 2));
        await writable.close();
    }

    async _writeGraphFile() {
        const graph = NetworkGraph.build();
        const handle = await this._currentProject.folderHandle.getFileHandle('graph.json', { create: true });
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(graph, null, 2));
        await writable.close();
    }

    _importData(file) {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data = JSON.parse(e.target.result);
                this._applyImportedData(data);
            } catch (err) {
                console.error(err);
                Utils.showStatus(`Ошибка: ${err.message}`);
            }
        };
        reader.readAsText(file);
    }

    _applyImportedData(data) {
        if (data.scene) {
            World.updateGroundSize(data.scene.planeWidth || 50, data.scene.planeDepth || 50);
            if (data.scene.axesSize) World.updateAxesSize(data.scene.axesSize);
        }
        if (data.nodeCounter) STATE.nodeCounter = data.nodeCounter;
        
        STATE.objects.forEach(o => Engine.scene.remove(o.root));
        STATE.objects = [];
        
        let imp = 0;
        data.objects?.forEach(item => {
            STATE.objectCounter++;
            const root = this._createObjectFromData(item);
            if (root) {
                this._finalizeImportedObject(root, item);
                imp++;
            }
        });
        Tree.update();
        Utils.showStatus(`✓ Импортировано: ${imp}`);
    }

    _createObjectFromData(item) {
        switch (item.type) {
            case 'pipeline':
                return this._createPipelineFromData(item);
            case 'sprinkler_row':
                return Factory.createSprinklerRow(
                    item.userData.leftLengths || [],
                    item.userData.leftDiameters || [],
                    item.userData.rightLengths || [],
                    item.userData.rightDiameters || [],
                    STATE.objectCounter
                );
            case 'control_valve':
                return Factory.createControlValve(2, item.userData.diameter || 50, STATE.objectCounter);
            default: {
                const segs = item.userData.segments || [];
                return Factory.createBranch(
                    segs.map(s => s.length) || [2],
                    segs.map(s => s.diameter) || [50],
                    STATE.objectCounter
                );
            }
        }
    }

    _createPipelineFromData(item) {
        let segs = item.userData.segments;
        if (!segs && item.userData.points) {
            segs = this._buildSegmentsFromPoints(item.userData.points, item.userData.diameters || [], item.userData.isClosedLoop);
        }
        if (!segs) return null;
        
        const sff = segs.map(s => ({
            start: new THREE.Vector3(s.startPos?.x || s.start?.x || 0, s.startPos?.y || s.start?.y || 0, s.startPos?.z || s.start?.z || 0),
            end: new THREE.Vector3(s.endPos?.x || s.end?.x || 0, s.endPos?.y || s.end?.y || 0, s.endPos?.z || s.end?.z || 0),
            diameter: s.diameter || 50,
            startNodeId: s.startNodeId || genNodeId(),
            endNodeId: s.endNodeId || genNodeId()
        }));
        
        return Factory.createPipeline(sff, STATE.objectCounter);
    }

    _buildSegmentsFromPoints(pts, dns, isClosed) {
        const segs = [];
        let prevNid = genNodeId();
        const firstNid = prevNid;
        
        for (let i = 0; i < pts.length - 1; i += 2) {
            const enid = (i === pts.length - 2 && isClosed) ? firstNid : genNodeId();
            segs.push({
                start: pts[i],
                end: pts[i + 1],
                diameter: dns[i / 2] || 50,
                startNodeId: prevNid,
                endNodeId: enid
            });
            prevNid = enid;
        }
        return segs;
    }

    _finalizeImportedObject(root, item) {
        if (item.position && item.type !== 'pipeline') {
            root.position.set(item.position[0], item.position[1], item.position[2]);
        }
        if (item.rotation) {
            root.rotation.set(item.rotation[0], item.rotation[1], item.rotation[2]);
        }
        Engine.scene.add(root);
        
        root.userData.connectedTo = item.userData.connectedTo || null;
        root.userData.number = item.userData.number || STATE.objectCounter;
        root.userData.isClosedLoop = item.userData.isClosedLoop || false;
        
        STATE.objects.push({
            id: STATE.objectCounter,
            type: item.type,
            root,
            userData: { ...item.userData, ...root.userData }
        });
    }
}