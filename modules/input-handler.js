// modules/input-handler.js
class InputHandler {
    constructor() {
        this._bindCanvasEvents();
        this._bindKeyboardEvents();
    }

    _bindCanvasEvents() {
        const canvas = Engine.renderer.domElement;
        canvas.addEventListener('click', e => this._onCanvasClick(e));
        canvas.addEventListener('mousemove', e => this._onCanvasMouseMove(e));
        canvas.addEventListener('dblclick', () => {
            if (STATE.pipeline.active) {
                PipelineBuilder.finish();
            }
        });
    }

    _bindKeyboardEvents() {
        addEventListener('keydown', e => this._onKeyDown(e));
    }

    _onCanvasClick(e) {
        if (this._isUIElement(e.target)) return;
        
        Engine.mouse.x = (e.clientX / innerWidth) * 2 - 1;
        Engine.mouse.y = -(e.clientY / innerHeight) * 2 + 1;
        Engine.raycaster.setFromCamera(Engine.mouse, Engine.camera);

        if (STATE.insertValveMode) {
            this._handleValveInsert();
            return;
        }
        
        if (STATE.pendingDuplicate) {
            ObjectEditor.finishDuplicate();
            return;
        }
        
        if (STATE.pendingSplitSegment) {
            this._handleSplitSegment();
            return;
        }
        
        if (STATE.connectPointsMode.active) {
            this._handleConnectPoints();
            return;
        }
        
        if (STATE.pipeline.active) {
            this._handlePipelineBuild();
            return;
        }
        
        if (STATE.connectMode.active) return;
        
        if (STATE.pendingBranch || STATE.pendingRow) {
            this._handleAttach();
            return;
        }
    }

    _onKeyDown(e) {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            document.getElementById('menuSave').click();
            return;
        }
        
        if (e.ctrlKey && e.key === 'o') {
            e.preventDefault();
            document.getElementById('menuOpen').click();
            return;
        }
        
        if (e.ctrlKey && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            const o = STATE.objects.find(x => x.id === STATE.selectedObjectId);
            if (o) ObjectEditor.startDuplicate(o);
            return;
        }

        const inInput = document.activeElement && 
                       ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName);
        
        if (!inInput) {
            const shortcuts = {
                b: () => document.getElementById('menuCreateBranch').click(),
                r: () => document.getElementById('menuCreateRow').click(),
                p: () => document.getElementById('menuCreatePipeline').click(),
                v: () => document.getElementById('arm_valve').click(),
                c: () => document.getElementById('menuConnectPoints').click(),
                g: () => SceneManager.toggleGrid(),
                h: () => VisualEffects.toggleConnectionPoints(),
                s: () => SplitManager.startSegmentMode()
            };
            
            const action = shortcuts[e.key.toLowerCase()];
            if (action) {
                action();
                return;
            }
        }

        if (STATE.pipeline.active) {
            if (e.key === 'Enter') {
                e.preventDefault();
                PipelineBuilder.addSegment();
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                PipelineBuilder.cancel();
                return;
            }
        }

        if (e.key === 'Escape') {
            this._handleGlobalEscape();
        }
    }

    _isUIElement(target) {
        return target.closest('#ui,#toolbar,#pipelineBuilder,.modal-content,.edit-modal,.ribbon-wrapper,#treePanel');
    }

    _handleValveInsert() {
        const hits = Engine.raycaster.intersectObjects(Engine.scene.children, true);
        const segHit = hits.find(i => i.object.userData?.type === 'pipeSegment');
        
        if (!segHit) {
            Utils.showStatus('Кликните по участку трубопровода!');
            return;
        }
        
        SplitManager.insertValveAt(segHit);
    }

    _handleSplitSegment() {
        const hits = Engine.raycaster.intersectObjects(Engine.scene.children, true);
        const sh = hits.find(i => i.object.userData?.type === 'pipeSegment');
        
        if (sh) {
            SplitManager.promptSplit(sh.object.userData.pipelineId, sh.object.userData.index);
        }
    }

    _handleConnectPoints() {
        const hits = Engine.raycaster.intersectObjects(Engine.scene.children, true);
        const h = hits.find(i => i.object.userData?.type === 'connectionPoint');
        
        if (!h) return;
        
        const wp = new THREE.Vector3();
        h.object.getWorldPosition(wp);
        
        const pd = {
            position: wp.clone(),
            diameter: h.object.userData.diameter,
            pipelineId: h.object.userData.pipelineId,
            mesh: h.object
        };
        
        if (STATE.connectPointsMode.selectedPoints.find(p => p.mesh === pd.mesh)) return;
        
        STATE.connectPointsMode.selectedPoints.push(pd);
        h.object.material.color.setHex(CONFIG.COLORS.CONNECTION_POINT_SELECTED);
        
        if (STATE.connectPointsMode.selectedPoints.length === 2) {
            this._connectTwoPoints();
        }
    }

    _connectTwoPoints() {
        const p1 = STATE.connectPointsMode.selectedPoints[0].position;
        const p2 = STATE.connectPointsMode.selectedPoints[1].position;
        const dn = prompt('DN:', 50);
        
        if (!dn) return;
        
        STATE.objectCounter++;
        STATE.pipelineCounter++;
        
        const pl = Factory.createConnectionPipeline(p1, p2, parseInt(dn), STATE.objectCounter);
        pl.userData.number = STATE.pipelineCounter;
        
        Engine.scene.add(pl);
        STATE.objects.push({
            id: STATE.objectCounter,
            type: 'pipeline',
            root: pl,
            userData: pl.userData
        });
        
        Tree.update();
        this._cancelConnectPoints();
    }

    _handlePipelineBuild() {
        const hits = Engine.raycaster.intersectObjects(Engine.scene.children, true);
        const ch = hits.find(i => {
            const t = i.object.userData?.type;
            return t === 'committedConnectionPoint' || t === 'connectionPoint';
        });
        
        if (ch) {
            const wp = new THREE.Vector3();
            ch.object.getWorldPosition(wp);
            STATE.pipeline.currentPoint.copy(wp);
            PipelineBuilder.updateCurrentPointUI();
            PipelineBuilder.updatePreview();
            return;
        }
        
        const gh = Engine.raycaster.intersectObject(STATE.meshes.ground);
        if (gh.length > 0) {
            STATE.pipeline.currentPoint.set(gh[0].point.x, STATE.pipeline.currentPoint.y, gh[0].point.z);
            PipelineBuilder.updateCurrentPointUI();
            PipelineBuilder.updatePreview();
        }
    }

    _handleAttach() {
        const po = STATE.pendingBranch || STATE.pendingRow;
        if (!po) return;
        
        const hits = Engine.raycaster.intersectObjects(Engine.scene.children, true);
        const nh = hits.find(i => {
            const t = i.object.userData?.type;
            return t === 'connectionPoint' || t === 'attachNode';
        });
        
        if (nh) {
            ObjectEditor.attachToNode(po, nh.object);
        }
    }

    _handleGlobalEscape() {
        ['editModal', 'editRowModal', 'editPipelineModal', 'editValveModal',
         'createBranchModal', 'createRowModal', 'sceneSettingsModal',
         'splitPipelineModal', 'splitSegmentModal', 'networkGraphModal', 'newProjectModal']
            .forEach(id => document.getElementById(id)?.classList.remove('active'));
        
        ObjectEditor.cancelDuplicate();
        STATE.pendingSplitSegment = null;
        STATE.connectMode.active = false;
        
        if (STATE.connectPointsMode.active) {
            this._cancelConnectPoints();
        }
        
        STATE.pendingBranch = null;
        STATE.pendingRow = null;
        STATE.insertValveMode = false;
        document.getElementById('arm_valve')?.classList.remove('active');
    }

    _cancelConnectPoints() {
        STATE.connectPointsMode.active = false;
        STATE.connectPointsMode.selectedPoints = [];
        
        STATE.objects.forEach(o => {
            if (o.root) {
                o.root.traverse(c => {
                    if (c.userData?.type === 'connectionPoint') {
                        c.material.color.setHex(CONFIG.COLORS.CONNECTION_POINT);
                        c.material.emissive.setHex(0x004d00);
                        c.material.emissiveIntensity = 0.5;
                    }
                });
            }
        });
    }

    _onCanvasMouseMove(e) {
        if (!STATE.pendingDuplicate || !STATE.pendingDuplicate.phantom) return;
        if (e.target.closest('#ui,#toolbar,#pipelineBuilder,.modal-content,.edit-modal,.ribbon-wrapper,#treePanel')) return;
        
        Engine.mouse.x = (e.clientX / innerWidth) * 2 - 1;
        Engine.mouse.y = -(e.clientY / innerHeight) * 2 + 1;
        Engine.raycaster.setFromCamera(Engine.mouse, Engine.camera);
        
        const hits = Engine.raycaster.intersectObjects(Engine.scene.children, true);
        const nh = hits.find(i => {
            const t = i.object.userData?.type;
            return t === 'connectionPoint' || t === 'attachNode';
        });
        
        if (nh) {
            const wp = new THREE.Vector3();
            nh.object.getWorldPosition(wp);
            STATE.pendingDuplicate.phantom.position.copy(wp);
            STATE.pendingDuplicate._snapToNode = {
                mesh: nh.object,
                position: wp.clone(),
                userData: nh.object.userData
            };
        } else {
            STATE.pendingDuplicate._snapToNode = null;
            const gh = Engine.raycaster.intersectObject(STATE.meshes.ground);
            if (gh.length > 0) {
                STATE.pendingDuplicate.phantom.position.set(
                    gh[0].point.x,
                    STATE.pendingDuplicate.sourceObj.root.position.y,
                    gh[0].point.z
                );
            }
        }
    }
}