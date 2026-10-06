// modules/object-editor.js
class ObjectEditor {
    // ==========================================
    // ДУБЛИРОВАНИЕ
    // ==========================================
    startDuplicate(o) {
        if (!o || o.type === 'pipeline') return;
        if (STATE.pendingDuplicate) {
            this.cancelDuplicate();
        }
        
        const ph = o.root.clone();
        ph.name = `phantom_${o.id}`;
        ph.traverse(c => {
            if (c.isMesh && c.material) {
                const m = c.material.clone();
                m.transparent = true;
                m.opacity = 0.5;
                c.material = m;
            }
        });
        
        Engine.scene.add(ph);
        STATE.pendingDuplicate = {
            phantom: ph,
            sourceObj: o,
            type: o.type,
            _snapToNode: null
        };
        Engine.controls.enabled = false;
    }

    cancelDuplicate() {
        if (!STATE.pendingDuplicate) return;
        if (STATE.pendingDuplicate.phantom) {
            Engine.scene.remove(STATE.pendingDuplicate.phantom);
        }
        STATE.pendingDuplicate = null;
        Engine.controls.enabled = true;
    }

    finishDuplicate() {
        if (!STATE.pendingDuplicate) return;
        
        const { sourceObj, type, phantom } = STATE.pendingDuplicate;
        const pos = phantom.position.clone();
        
        STATE.objectCounter++;
        let nr, nn;
        
        if (type === 'branch') {
            STATE.branchCounter++;
            nn = STATE.branchCounter;
            nr = Factory.createBranch(
                sourceObj.userData.segments.map(s => s.length),
                sourceObj.userData.segments.map(s => s.diameter),
                STATE.objectCounter
            );
        } else if (type === 'sprinkler_row') {
            STATE.rowCounter++;
            nn = STATE.rowCounter;
            nr = Factory.createSprinklerRow(
                sourceObj.userData.leftLengths || [],
                sourceObj.userData.leftDiameters || [],
                sourceObj.userData.rightLengths || [],
                sourceObj.userData.rightDiameters || [],
                STATE.objectCounter
            );
        } else if (type === 'control_valve') {
            STATE.valveCounter++;
            nn = STATE.valveCounter;
            nr = Factory.createControlValve(2, sourceObj.userData.diameter, STATE.objectCounter);
        } else {
            return;
        }
        
        nr.position.copy(pos);
        nr.rotation.copy(sourceObj.root.rotation);
        nr.userData.number = nn;
        
        if (STATE.pendingDuplicate._snapToNode && STATE.pendingDuplicate._snapToNode.userData) {
            const ud = STATE.pendingDuplicate._snapToNode.userData;
            let tt, ti, ni;
            
            if (ud.type === 'connectionPoint') {
                tt = 'pipeline';
                ti = ud.pipelineId || ud.branchId || ud.rowId || ud.valveId;
                ni = ud.index || 0;
            } else if (ud.type === 'attachNode') {
                ti = ud.branchId || ud.rowId;
                tt = ud.rowId ? 'sprinkler_row' : 'branch';
                ni = 0;
            }
            
            if (ti !== sourceObj.id) {
                nr.userData.connectedTo = {
                    targetType: tt,
                    targetId: ti,
                    nodeIndex: ni,
                    nodeType: ud.type,
                    position: STATE.pendingDuplicate._snapToNode.position.clone()
                };
            }
        }
        
        Engine.scene.add(nr);
        STATE.objects.push({
            id: STATE.objectCounter,
            type,
            root: nr,
            userData: nr.userData
        });
        
        Tree.update();
        Utils.showStatus(`✓ Копия №${nn}`);
    }

    // ==========================================
    // ПРИВЯЗКА
    // ==========================================
    attachToNode(po, nm) {
        const ud = nm.userData;
        if (!ud) return;
        
        let tt, ti, ni;
        const wp = new THREE.Vector3();
        nm.getWorldPosition(wp);
        
        if (ud.type === 'connectionPoint') {
            tt = 'pipeline';
            ti = ud.pipelineId || ud.branchId || ud.rowId || ud.valveId;
            ni = ud.index || 0;
        } else if (ud.type === 'attachNode') {
            ti = ud.branchId || ud.rowId;
            tt = ud.rowId ? 'sprinkler_row' : 'branch';
            ni = 0;
        } else {
            return;
        }
        
        const poS = STATE.objects.find(o => o.root === po);
        if (poS && poS.id === ti) return;
        
        po.position.copy(wp);
        po.userData.connectedTo = {
            targetType: tt,
            targetId: ti,
            nodeIndex: ni,
            nodeType: ud.type,
            position: wp.clone()
        };
        
        if (poS) poS.userData = po.userData;
        
        STATE.pendingBranch = null;
        STATE.pendingRow = null;
        Tree.update();
        Utils.showStatus('✓ Привязано');
    }

    startAttachMode(o) {
        if (o.type === 'pipeline') return;
        if (o.type === 'sprinkler_row') {
            STATE.pendingRow = o.root;
        } else {
            STATE.pendingBranch = o.root;
        }
        Utils.showStatus(`Кликните по узлу для привязки №${o.userData.number || o.id}`);
    }

    // ==========================================
    // РЕДАКТИРОВАНИЕ: ВЕТКА (Branch)
    // ==========================================
    openEditModal(id) {
        const o = STATE.objects.find(x => x.id === id);
        if (!o) return;
        
        STATE.currentEditId = id;
        document.getElementById('editBranchId').textContent = o.userData.number || id;
        
        const p = o.root.position;
        document.getElementById('editPosX').value = p.x.toFixed(2);
        document.getElementById('editPosY').value = p.y.toFixed(2);
        document.getElementById('editPosZ').value = p.z.toFixed(2);
        
        const r = o.root.rotation;
        document.getElementById('editRotX').value = Math.round(THREE.MathUtils.radToDeg(r.x));
        document.getElementById('editRotY').value = Math.round(THREE.MathUtils.radToDeg(r.y));
        document.getElementById('editRotZ').value = Math.round(THREE.MathUtils.radToDeg(r.z));
        
        const segs = o.userData.segments || [];
        document.getElementById('editSprCount').value = segs.length;
        
        this._updateEditSegments(segs.map(s => s.length), segs.map(s => s.diameter));
        document.getElementById('editModal').classList.add('active');
    }

    _updateEditSegments(lengths, diameters) {
        const c = document.getElementById('editSegmentInputs');
        c.innerHTML = '';
        
        for (let i = 0; i < lengths.length; i++) {
            const r = document.createElement('div');
            r.className = 'segment-edit-row';
            r.innerHTML = `
                <span>${i + 1}.</span>
                <input type="number" class="eLen" value="${(lengths[i] || 2).toFixed(2)}" step="0.1">
                <select class="eDn">${Utils.getDnOptions(diameters[i] || 50)}</select>
            `;
            c.appendChild(r);
        }
        
        c.querySelectorAll('.eLen,.eDn').forEach(e => {
            e.addEventListener('input', () => {
                let t = 0;
                document.querySelectorAll('#editSegmentInputs .eLen').forEach(i => {
                    t += parseFloat(i.value) || 0;
                });
                document.getElementById('editTotalLength').textContent = t.toFixed(2);
            });
        });
        
        let t = 0;
        lengths.forEach(x => t += x);
        document.getElementById('editTotalLength').textContent = t.toFixed(2);
    }

    applyEdit() {
        if (!STATE.currentEditId) return;
        const o = STATE.objects.find(x => x.id === STATE.currentEditId);
        if (!o) return;
        
        const np = new THREE.Vector3(
            parseFloat(document.getElementById('editPosX').value) || 0,
            parseFloat(document.getElementById('editPosY').value) || 0,
            parseFloat(document.getElementById('editPosZ').value) || 0
        );
        
        const rx = THREE.MathUtils.degToRad(parseFloat(document.getElementById('editRotX').value) || 0);
        const ry = THREE.MathUtils.degToRad(parseFloat(document.getElementById('editRotY').value) || 0);
        const rz = THREE.MathUtils.degToRad(parseFloat(document.getElementById('editRotZ').value) || 0);
        
        const ls = Array.from(document.querySelectorAll('#editSegmentInputs .eLen')).map(i => 
            Utils.clamp(parseFloat(i.value) || 2, 0.1, 100)
        );
        const ds = Array.from(document.querySelectorAll('#editSegmentInputs .eDn')).map(s => 
            parseInt(s.value) || 50
        );
        
        const old = o.root;
        const wc = o.userData.connectedTo;
        
        o.root = Factory.createBranch(ls, ds, o.id);
        o.root.position.copy(np);
        o.root.rotation.set(rx, ry, rz, 'YXZ');
        o.root.userData.number = o.userData.number;
        if (wc) o.root.userData.connectedTo = wc;
        
        Engine.scene.remove(old);
        Engine.scene.add(o.root);
        o.userData = o.root.userData;
        
        this.closeEditModal();
        Tree.update();
    }

    closeEditModal() {
        document.getElementById('editModal').classList.remove('active');
        STATE.currentEditId = null;
    }

    // ==========================================
    // РЕДАКТИРОВАНИЕ: ТРУБОПРОВОД (Pipeline)
    // ==========================================
    openPipelineEditModal(id) {
        const o = STATE.objects.find(x => x.id === id);
        if (!o || o.type !== 'pipeline') return;
        
        STATE.currentEditPipeId = id;
        document.getElementById('editPipeId').textContent = o.userData.number || id;
        
        const segs = o.userData.segments || [];
        if (segs.length > 0) {
            document.getElementById('pipeNodeX').value = segs[0].startPos.x.toFixed(2);
            document.getElementById('pipeNodeY').value = segs[0].startPos.y.toFixed(2);
            document.getElementById('pipeNodeZ').value = segs[0].startPos.z.toFixed(2);
        }
        
        const r = o.root.rotation;
        document.getElementById('pipeEditRotX').value = Math.round(THREE.MathUtils.radToDeg(r.x));
        document.getElementById('pipeEditRotY').value = Math.round(THREE.MathUtils.radToDeg(r.y));
        document.getElementById('pipeEditRotZ').value = Math.round(THREE.MathUtils.radToDeg(r.z));
        
        this._renderPipelineEditSegments(segs);
        document.getElementById('editPipelineModal').classList.add('active');
    }

    _renderPipelineEditSegments(segs) {
        const c = document.getElementById('pipeEditSegments');
        c.innerHTML = '';
        let tl = 0;
        
        segs.forEach((s, i) => {
            tl += s.length;
            const r = document.createElement('div');
            r.className = 'pipe-edit-seg-row';
            r.innerHTML = `
                <span>${i + 1}</span>
                <input type="number" class="peLen" value="${s.length.toFixed(2)}" step="0.1" min="0.1">
                <select class="peDn">${Utils.getDnOptions(s.diameter)}</select>
                <button class="peDel" data-i="${i}">🗑️</button>
            `;
            c.appendChild(r);
        });
        
        document.getElementById('pipeEditTotalLength').textContent = tl.toFixed(2);
        document.getElementById('pipeEditSegCount').textContent = segs.length;
        
        c.querySelectorAll('.peLen,.peDn').forEach(e => {
            e.addEventListener('input', () => {
                let t = 0;
                document.querySelectorAll('#pipeEditSegments .peLen').forEach(i => {
                    t += parseFloat(i.value) || 0;
                });
                document.getElementById('pipeEditTotalLength').textContent = t.toFixed(2);
                document.getElementById('pipeEditSegCount').textContent = document.querySelectorAll('#pipeEditSegments .peLen').length;
            });
        });
        
        c.querySelectorAll('.peDel').forEach(b => {
            b.addEventListener('click', e => this._deletePipelineEditSegment(parseInt(e.currentTarget.dataset.i)));
        });
    }

    _deletePipelineEditSegment(i) {
        const c = document.getElementById('pipeEditSegments');
        const rows = c.querySelectorAll('.pipe-edit-seg-row');
        if (rows.length <= 1) return;
        if (i >= 0 && i < rows.length) {
            rows[i].remove();
            c.querySelectorAll('.pipe-edit-seg-row').forEach((r, j) => {
                r.querySelector('span').textContent = j + 1;
                r.querySelector('.peDel').dataset.i = j;
            });
        }
    }

    addPipelineEditSegment() {
        const c = document.getElementById('pipeEditSegments');
        const n = c.querySelectorAll('.peLen').length;
        const r = document.createElement('div');
        r.className = 'pipe-edit-seg-row';
        r.innerHTML = `
            <span>${n + 1}</span>
            <input type="number" class="peLen" value="2" step="0.1" min="0.1">
            <select class="peDn">${Utils.getDnOptions(50)}</select>
            <button class="peDel" data-i="${n}">🗑️</button>
        `;
        c.appendChild(r);
        r.querySelector('.peDel').addEventListener('click', e =>
            this._deletePipelineEditSegment(parseInt(e.currentTarget.dataset.i))
        );
    }

    applyPipelineEdit() {
        if (!STATE.currentEditPipeId) return;
        const o = STATE.objects.find(x => x.id === STATE.currentEditPipeId);
        if (!o) return;
        
        const nx = parseFloat(document.getElementById('pipeNodeX').value) || 0;
        const ny = parseFloat(document.getElementById('pipeNodeY').value) || 0;
        const nz = parseFloat(document.getElementById('pipeNodeZ').value) || 0;
        
        const rx = THREE.MathUtils.degToRad(parseFloat(document.getElementById('pipeEditRotX').value) || 0);
        const ry = THREE.MathUtils.degToRad(parseFloat(document.getElementById('pipeEditRotY').value) || 0);
        const rz = THREE.MathUtils.degToRad(parseFloat(document.getElementById('pipeEditRotZ').value) || 0);
        
        const nl = Array.from(document.querySelectorAll('#pipeEditSegments .peLen')).map(i => parseFloat(i.value) || 2);
        const nd = Array.from(document.querySelectorAll('#pipeEditSegments .peDn')).map(s => parseInt(s.value) || 50);
        
        const oldSegs = o.userData.segments || [];
        let cp = new THREE.Vector3(nx, ny, nz);
        const ns = [];
        
        for (let i = 0; i < nl.length; i++) {
            let dir;
            if (oldSegs[i]) {
                dir = new THREE.Vector3(
                    oldSegs[i].endPos.x - oldSegs[i].startPos.x,
                    oldSegs[i].endPos.y - oldSegs[i].startPos.y,
                    oldSegs[i].endPos.z - oldSegs[i].startPos.z
                ).normalize();
            } else {
                dir = new THREE.Vector3(1, 0, 0);
            }
            const ep = cp.clone().addScaledVector(dir, nl[i]);
            ns.push({ start: cp.clone(), end: ep.clone(), diameter: nd[i] });
            cp = ep.clone();
        }
        
        const sff = ns.map(s => ({
            start: s.start,
            end: s.end,
            diameter: s.diameter,
            startNodeId: genNodeId(),
            endNodeId: genNodeId()
        }));
        
        for (let i = 1; i < sff.length; i++) {
            sff[i].startNodeId = sff[i - 1].endNodeId;
        }
        if (o.userData.isClosedLoop && sff.length > 0) {
            sff[sff.length - 1].endNodeId = sff[0].startNodeId;
        }
        
        const nr = Factory.createPipeline(sff, o.id);
        if (!nr) return;
        
        nr.position.set(0, 0, 0);
        nr.rotation.set(rx, ry, rz, 'YXZ');
        nr.userData.rotation = { x: rx, y: ry, z: rz };
        nr.userData.number = o.userData.number;
        nr.userData.connectedTo = o.userData.connectedTo;
        
        Engine.scene.remove(o.root);
        Engine.scene.add(nr);
        
        o.root = nr;
        o.userData = {
            ...nr.userData,
            rotation: { x: rx, y: ry, z: rz },
            number: o.userData.number,
            connectedTo: o.userData.connectedTo
        };
        
        this.closePipelineEditModal();
        Tree.update();
    }

    closePipelineEditModal() {
        document.getElementById('editPipelineModal').classList.remove('active');
        STATE.currentEditPipeId = null;
    }

    // ==========================================
    // РЕДАКТИРОВАНИЕ: РЯДОК (Row)
    // ==========================================
    openRowEditModal(id) {
        const o = STATE.objects.find(x => x.id === id);
        if (!o) return;
        
        STATE.currentEditRowId = id;
        document.getElementById('editRowId').textContent = o.userData.number || id;
        
        const p = o.root.position;
        document.getElementById('rowEditPosX').value = p.x.toFixed(2);
        document.getElementById('rowEditPosY').value = p.y.toFixed(2);
        document.getElementById('rowEditPosZ').value = p.z.toFixed(2);
        
        const r = o.root.rotation;
        document.getElementById('rowEditRotX').value = Math.round(THREE.MathUtils.radToDeg(r.x));
        document.getElementById('rowEditRotY').value = Math.round(THREE.MathUtils.radToDeg(r.y));
        document.getElementById('rowEditRotZ').value = Math.round(THREE.MathUtils.radToDeg(r.z));
        
        document.getElementById('rowEditLeftCount').value = o.userData.leftLengths?.length || 0;
        document.getElementById('rowEditRightCount').value = o.userData.rightLengths?.length || 0;
        
        this._updateRowEditSide('Left', o.userData.leftLengths || [], o.userData.leftDiameters || []);
        this._updateRowEditSide('Right', o.userData.rightLengths || [], o.userData.rightDiameters || []);
        document.getElementById('editRowModal').classList.add('active');
    }

    _updateRowEditSide(side, ls, ds) {
        const c = document.getElementById(`rowEdit${side}Inputs`);
        c.innerHTML = '';
        for (let i = 0; i < ls.length; i++) {
            const r = document.createElement('div');
            r.className = 'segment-edit-row';
            r.innerHTML = `
                <span>${i + 1}.</span>
                <input type="number" class="reLen" value="${(ls[i] || 2).toFixed(2)}" step="0.1">
                <select class="reDn">${Utils.getDnOptions(ds[i] || 50)}</select>
            `;
            c.appendChild(r);
        }
    }

    _getRowEditSideData(side) {
        const c = document.getElementById(`rowEdit${side}Inputs`);
        return {
            lengths: Array.from(c.querySelectorAll('.reLen')).map(i => parseFloat(i.value) || 2),
            diameters: Array.from(c.querySelectorAll('.reDn')).map(s => parseInt(s.value) || 50)
        };
    }

    applyRowEdit() {
        if (!STATE.currentEditRowId) return;
        const o = STATE.objects.find(x => x.id === STATE.currentEditRowId);
        if (!o) return;
        
        const np = new THREE.Vector3(
            parseFloat(document.getElementById('rowEditPosX').value) || 0,
            parseFloat(document.getElementById('rowEditPosY').value) || 0,
            parseFloat(document.getElementById('rowEditPosZ').value) || 0
        );
        
        const rx = THREE.MathUtils.degToRad(parseFloat(document.getElementById('rowEditRotX').value) || 0);
        const ry = THREE.MathUtils.degToRad(parseFloat(document.getElementById('rowEditRotY').value) || 0);
        const rz = THREE.MathUtils.degToRad(parseFloat(document.getElementById('rowEditRotZ').value) || 0);
        
        const ld = this._getRowEditSideData('Left');
        const rd = this._getRowEditSideData('Right');
        
        const old = o.root;
        const wc = o.userData.connectedTo;
        
        o.root = Factory.createSprinklerRow(ld.lengths, ld.diameters, rd.lengths, rd.diameters, o.id);
        o.root.position.copy(np);
        o.root.rotation.set(rx, ry, rz, 'YXZ');
        o.root.userData.number = o.userData.number;
        if (wc) o.root.userData.connectedTo = wc;
        
        Engine.scene.remove(old);
        Engine.scene.add(o.root);
        o.userData = o.root.userData;
        
        this.closeRowEditModal();
        Tree.update();
    }

    closeRowEditModal() {
        document.getElementById('editRowModal').classList.remove('active');
        STATE.currentEditRowId = null;
    }

    // ==========================================
    // РЕДАКТИРОВАНИЕ: УЗЕЛ УПРАВЛЕНИЯ (Valve)
    // ==========================================
    openValveEditModal(id) {
        const o = STATE.objects.find(x => x.id === id);
        if (!o || o.type !== 'control_valve') return;
        
        STATE.currentEditValveId = id;
        document.getElementById('editValveId').textContent = o.userData.number || id;
        
        const p = o.root.position;
        document.getElementById('valveEditPosX').value = p.x.toFixed(2);
        document.getElementById('valveEditPosY').value = p.y.toFixed(2);
        document.getElementById('valveEditPosZ').value = p.z.toFixed(2);
        
        document.getElementById('valveEditLength').value = (o.userData.totalLength / 2).toFixed(2);
        document.getElementById('valveEditDiameter').value = o.userData.diameter || 50;
        
        const r = o.root.rotation;
        document.getElementById('valveEditRotX').value = Math.round(THREE.MathUtils.radToDeg(r.x));
        document.getElementById('valveEditRotY').value = Math.round(THREE.MathUtils.radToDeg(r.y));
        document.getElementById('valveEditRotZ').value = Math.round(THREE.MathUtils.radToDeg(r.z));
        
        document.getElementById('editValveModal').classList.add('active');
    }

    applyValveEdit() {
        if (!STATE.currentEditValveId) return;
        const o = STATE.objects.find(x => x.id === STATE.currentEditValveId);
        if (!o) return;
        
        const np = new THREE.Vector3(
            parseFloat(document.getElementById('valveEditPosX').value) || 0,
            parseFloat(document.getElementById('valveEditPosY').value) || 0,
            parseFloat(document.getElementById('valveEditPosZ').value) || 0
        );
        
        const newLength = parseFloat(document.getElementById('valveEditLength').value) || 2;
        const newDiameter = parseInt(document.getElementById('valveEditDiameter').value) || 50;
        
        const rx = THREE.MathUtils.degToRad(parseFloat(document.getElementById('valveEditRotX').value) || 0);
        const ry = THREE.MathUtils.degToRad(parseFloat(document.getElementById('valveEditRotY').value) || 0);
        const rz = THREE.MathUtils.degToRad(parseFloat(document.getElementById('valveEditRotZ').value) || 0);
        
        const old = o.root;
        const wc = o.userData.connectedTo;
        
        o.root = Factory.createControlValve(newLength, newDiameter, o.id);
        o.root.position.copy(np);
        o.root.rotation.set(rx, ry, rz, 'YXZ');
        o.root.userData.number = o.userData.number;
        if (wc) o.root.userData.connectedTo = wc;
        
        Engine.scene.remove(old);
        Engine.scene.add(o.root);
        o.userData = { ...o.root.userData, number: o.userData.number, connectedTo: wc };
        
        this.closeValveEditModal();
        Tree.update();
        Utils.showStatus(`✓ Узел управления №${o.userData.number} обновлен`);
    }

    closeValveEditModal() {
        document.getElementById('editValveModal').classList.remove('active');
        STATE.currentEditValveId = null;
    }

    // ==========================================
    // ОБЩИЕ МЕТОДЫ
    // ==========================================
    deleteObject(id) {
        if (!id || !confirm('Удалить этот объект?')) return;
        
        const i = STATE.objects.findIndex(o => o.id === id);
        if (i >= 0) {
            Engine.scene.remove(STATE.objects[i].root);
            STATE.objects.splice(i, 1);
            
            // Гарантированно закрываем все модальные окна редактирования
            this.closeEditModal();
            this.closePipelineEditModal();
            this.closeRowEditModal();
            this.closeValveEditModal();
            
            Tree.update();
            Utils.showStatus('Объект удален');
        }
    }
        // Метод-обёртка для совместимости с tree.js
    startDuplicateMode(o) {
        return this.startDuplicate(o);
    }
}