// modules/object-editor.js
class ObjectEditor {
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

    deleteObject(id) {
        if (!id || !confirm('Удалить?')) return;
        
        const i = STATE.objects.findIndex(o => o.id === id);
        if (i >= 0) {
            Engine.scene.remove(STATE.objects[i].root);
            STATE.objects.splice(i, 1);
            this.closeEditModal();
            Tree.update();
        }
    }
}