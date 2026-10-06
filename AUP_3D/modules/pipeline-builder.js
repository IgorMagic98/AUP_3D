// modules/pipeline-builder.js
class PipelineBuilder {
    start() {
        if (STATE.pipeline.active) {
            this.cancel();
            return;
        }

        STATE.pipeline.active = true;
        STATE.pipeline.segments = [];
        STATE.pipeline.committedMeshes = [];
        STATE.pipeline.diameter = parseInt(document.getElementById('pbDiameter').value) || 25;
        STATE.pipeline.axis = 'y';
        STATE.pipeline.direction = '+';
        STATE.pipeline.currentPoint.set(0, 0, 0);
        STATE.pipeline._currentNodeId = genNodeId();

        this.updateCurrentPointUI();
        document.getElementById('pbLength').value = 5;

        document.querySelectorAll('#pipelineBuilder .axis-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('#pipelineBuilder .axis-btn[data-axis="y"]').classList.add('active');
        
        document.querySelectorAll('#pipelineBuilder .dir-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('#pipelineBuilder .dir-btn[data-dir="+"]').classList.add('active');

        document.getElementById('pipelineBuilder').classList.add('active');
        
        const b = document.getElementById('pipelineBuilder');
        b.style.transform = 'none';
        b.style.bottom = 'auto';
        b.style.left = Math.max(10, (innerWidth - 600) / 2) + 'px';
        b.style.top = Math.max(130, innerHeight - 350) + 'px';

        Engine.controls.enabled = false;
        this.updateSegmentsList();
        this.updatePreview();
    }

    cancel() {
        STATE.pipeline.active = false;
        document.getElementById('pipelineBuilder').classList.remove('active');
        
        if (STATE.pipeline.previewMesh) {
            Engine.scene.remove(STATE.pipeline.previewMesh);
            STATE.pipeline.previewMesh = null;
        }
        
        STATE.pipeline.committedMeshes.forEach(m => {
            if (m.geometry) m.geometry.dispose();
            Engine.scene.remove(m);
        });
        STATE.pipeline.committedMeshes = [];
        Engine.controls.enabled = true;
    }

    addSegment() {
        const sx = parseFloat(document.getElementById('pbCX').value) || 0;
        const sy = parseFloat(document.getElementById('pbCY').value) || 0;
        const sz = parseFloat(document.getElementById('pbCZ').value) || 0;
        
        STATE.pipeline.currentPoint.set(sx, sy, sz);
        const ep = STATE.pipeline.currentPoint.clone();
        
        const len = parseFloat(document.getElementById('pbLength').value) || 5;
        const ax = STATE.pipeline.axis;
        const dir = STATE.pipeline.direction === '+' ? 1 : -1;
        const dn = STATE.pipeline.diameter;
        
        if (ax === 'x') ep.x += len * dir;
        else if (ax === 'y') ep.y += len * dir;
        else ep.z += len * dir;

        const endNodeId = genNodeId();
        STATE.pipeline.segments.push({
            start: STATE.pipeline.currentPoint.clone(),
            end: ep.clone(),
            diameter: dn,
            length: len,
            startNodeId: STATE.pipeline._currentNodeId,
            endNodeId: endNodeId
        });

        const r = dn / 2000;
        const pm = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.PIPE, metalness: 0.2, roughness: 0.8 });
        const mesh = Factory.createOrientedCylinder(STATE.pipeline.currentPoint.clone(), ep.clone(), r, pm, `pb_c`);
        
        if (mesh) {
            mesh.userData = { type: 'committedPipeSegment' };
            Engine.scene.add(mesh);
            STATE.pipeline.committedMeshes.push(mesh);
        }

        const cs = Math.max(0.15, r * 3);
        const conn = new THREE.Mesh(
            new THREE.SphereGeometry(cs, 16, 16),
            new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.CONNECTION_POINT, emissive: 0x004d00, emissiveIntensity: 0.5 })
        );
        conn.position.copy(ep);
        conn.userData = { type: 'committedConnectionPoint' };
        Engine.scene.add(conn);
        STATE.pipeline.committedMeshes.push(conn);

        STATE.pipeline.currentPoint.copy(ep);
        STATE.pipeline._currentNodeId = endNodeId;
        
        this.updateCurrentPointUI();
        this.updateSegmentsList();
        this.updatePreview();
    }

    finish() {
        if (!STATE.pipeline.segments.length) {
            this.cancel();
            return;
        }

        const segs = STATE.pipeline.segments;
        const fp = segs[0].start;
        const lp = segs[segs.length - 1].end;
        let isClosed = false;
        
        if (isSamePoint(fp, lp)) {
            isClosed = true;
            segs[segs.length - 1].end.copy(fp);
            segs[segs.length - 1].endNodeId = segs[0].startNodeId;
        }

        STATE.pipeline.committedMeshes.forEach(m => {
            if (m.geometry) m.geometry.dispose();
            Engine.scene.remove(m);
        });
        STATE.pipeline.committedMeshes = [];
        
        if (STATE.pipeline.previewMesh) {
            Engine.scene.remove(STATE.pipeline.previewMesh);
            STATE.pipeline.previewMesh = null;
        }

        STATE.objectCounter++;
        STATE.pipelineCounter++;
        
        const root = Factory.createPipeline(segs, STATE.objectCounter);
        if (!root) {
            this.cancel();
            return;
        }
        
        root.userData.isClosedLoop = isClosed;
        root.userData.number = STATE.pipelineCounter;
        
        Engine.scene.add(root);
        STATE.objects.push({
            id: STATE.objectCounter,
            type: 'pipeline',
            root,
            userData: root.userData
        });

        STATE.pipeline.active = false;
        STATE.pipeline.segments = [];
        document.getElementById('pipelineBuilder').classList.remove('active');
        Engine.controls.enabled = true;
        Tree.update();
        
        Utils.showStatus(`Трубопровод №${STATE.pipelineCounter} (${segs.length} уч.) ${isClosed ? '[ЗАМКНУТЫЙ]' : ''}`);
    }

    updateCurrentPointUI() {
        document.getElementById('pbCX').value = STATE.pipeline.currentPoint.x.toFixed(2);
        document.getElementById('pbCY').value = STATE.pipeline.currentPoint.y.toFixed(2);
        document.getElementById('pbCZ').value = STATE.pipeline.currentPoint.z.toFixed(2);
    }

    updatePreview() {
        if (STATE.pipeline.previewMesh) {
            Engine.scene.remove(STATE.pipeline.previewMesh);
            STATE.pipeline.previewMesh = null;
        }
        
        if (!STATE.pipeline.active) return;
        
        const sp = new THREE.Vector3(
            parseFloat(document.getElementById('pbCX').value) || 0,
            parseFloat(document.getElementById('pbCY').value) || 0,
            parseFloat(document.getElementById('pbCZ').value) || 0
        );
        const ep = sp.clone();
        const len = parseFloat(document.getElementById('pbLength').value) || 5;
        const ax = STATE.pipeline.axis;
        const dir = STATE.pipeline.direction === '+' ? 1 : -1;
        
        if (ax === 'x') ep.x += len * dir;
        else if (ax === 'y') ep.y += len * dir;
        else ep.z += len * dir;

        const mat = new THREE.MeshStandardMaterial({
            color: CONFIG.COLORS.PREVIEW,
            transparent: true,
            opacity: 0.5
        });
        
        const pv = Factory.createOrientedCylinder(sp, ep, STATE.pipeline.diameter / 2000, mat, 'preview');
        if (pv) {
            Engine.scene.add(pv);
            STATE.pipeline.previewMesh = pv;
        }
    }

    updateSegmentsList() {
        const l = document.getElementById('pipelineSegmentsList');
        l.innerHTML = '';
        let tl = 0;
        
        STATE.pipeline.segments.forEach((s, i) => {
            tl += s.length;
            const d = s.length > 0 ? `${s.length}м` : '0м';
            const it = document.createElement('div');
            it.className = 'pipeline-segment-item';
            it.innerHTML = `
                <div class="seg-info">
                    <strong>#${i + 1}</strong> ${d} (DN${s.diameter}) [${s.startNodeId}→${s.endNodeId}]
                </div>
                <div>
                    <button class="delete" data-index="${i}">🗑️</button>
                </div>
            `;
            l.appendChild(it);
        });
        
        document.getElementById('pbSegmentCount').textContent = STATE.pipeline.segments.length;
        document.getElementById('pbTotalLength').textContent = tl.toFixed(2);
        
        l.querySelectorAll('.delete').forEach(b => {
            b.addEventListener('click', e => {
                const idx = parseInt(e.currentTarget.dataset.index);
                this.removeSegment(idx);
            });
        });
    }

    removeSegment(idx) {
        if (idx < 0 || idx >= STATE.pipeline.segments.length) return;
        
        STATE.pipeline.segments = STATE.pipeline.segments.slice(0, idx);
        
        STATE.pipeline.committedMeshes.forEach(m => {
            if (m.geometry) m.geometry.dispose();
            Engine.scene.remove(m);
        });
        STATE.pipeline.committedMeshes = [];
        
        STATE.pipeline.segments.forEach((seg, i) => {
            const r = seg.diameter / 2000;
            const pm = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.PIPE, metalness: 0.2, roughness: 0.8 });
            const mesh = Factory.createOrientedCylinder(seg.start, seg.end, r, pm, `pb_c`);
            if (mesh) {
                mesh.userData = { type: 'committedPipeSegment' };
                Engine.scene.add(mesh);
                STATE.pipeline.committedMeshes.push(mesh);
            }
            
            const cs = Math.max(0.15, r * 3);
            const conn = new THREE.Mesh(
                new THREE.SphereGeometry(cs, 16, 16),
                new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.CONNECTION_POINT, emissive: 0x004d00, emissiveIntensity: 0.5 })
            );
            conn.position.copy(seg.end);
            conn.userData = { type: 'committedConnectionPoint' };
            Engine.scene.add(conn);
            STATE.pipeline.committedMeshes.push(conn);
        });
        
        if (STATE.pipeline.segments.length > 0) {
            STATE.pipeline.currentPoint.copy(STATE.pipeline.segments[STATE.pipeline.segments.length - 1].end);
            STATE.pipeline._currentNodeId = STATE.pipeline.segments[STATE.pipeline.segments.length - 1].endNodeId;
        } else {
            STATE.pipeline.currentPoint.set(0, 5, 0);
            STATE.pipeline._currentNodeId = genNodeId();
        }
        
        this.updateCurrentPointUI();
        this.updateSegmentsList();
        this.updatePreview();
    }
}