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
                UI.pipeline.finish();
            }
        });
    }

    _bindKeyboardEvents() {
        addEventListener('keydown', e => this._onKeyDown(e));
    }

    // _onCanvasClick(e) {
    //     if (this._isUIElement(e.target)) return;
        
    //     Engine.mouse.x = (e.clientX / innerWidth) * 2 - 1;
    //     Engine.mouse.y = -(e.clientY / innerHeight) * 2 + 1;
    //     Engine.raycaster.setFromCamera(Engine.mouse, Engine.camera);

    //     // Режим вставки узла управления
    //     if (STATE.insertValveMode) {
    //         const hits = Engine.raycaster.intersectObjects(Engine.scene.children, true);
    //         const segHit = hits.find(i => i.object.userData?.type === 'pipeSegment');
            
    //         if (segHit) {
    //             const seg = segHit.object;
    //             const pipelineId = seg.userData.pipelineId;
    //             const segIndex = seg.userData.index;
    //             const pipeline = STATE.objects.find(o => o.id === pipelineId);
                
    //             if (pipeline && pipeline.userData.segments[segIndex]) {
    //                 const segData = pipeline.userData.segments[segIndex];
    //                 const startPoint = new THREE.Vector3(segData.startPos.x, segData.startPos.y, segData.startPos.z);
    //                 const endPoint = new THREE.Vector3(segData.endPos.x, segData.endPos.y, segData.endPos.z);
                    
    //                 // Точка клика в мировых координатах
    //                 const worldHitPoint = segHit.point.clone();
                    
    //                 // Переводим в локальные координаты трубопровода
    //                 const localHitPoint = worldHitPoint.clone();
    //                 pipeline.root.worldToLocal(localHitPoint);
                    
    //                 // Направление и длина сегмента
    //                 const segVector = new THREE.Vector3().subVectors(endPoint, startPoint);
    //                 const segLength = segVector.length();
    //                 const direction = segVector.clone().normalize();
                    
    //                 // Находим параметр t (0-1) где кликнули
    //                 const hitVector = new THREE.Vector3().subVectors(localHitPoint, startPoint);
    //                 const t = Math.max(0.1, Math.min(0.9, hitVector.dot(direction) / segLength));
                    
    //                 // Длина узла управления
    //                 const valveLength = 1.0;
    //                 const halfValveLength = valveLength / 2;
    //                 const diameter = segData.diameter;
                    
    //                 // Точка установки узла (центр) в локальных координатах
    //                 const valveCenter = startPoint.clone().add(direction.clone().multiplyScalar(t * segLength));
                    
    //                 // Начало и конец узла управления
    //                 const valveStart = valveCenter.clone().sub(direction.clone().multiplyScalar(halfValveLength));
    //                 const valveEnd = valveCenter.clone().add(direction.clone().multiplyScalar(halfValveLength));
                    
    //                 // Создаем два новых сегмента
    //                 const newSeg1 = {
    //                     start: startPoint.clone(),
    //                     end: valveStart.clone(),
    //                     startPos: { x: startPoint.x, y: startPoint.y, z: startPoint.z },
    //                     endPos: { x: valveStart.x, y: valveStart.y, z: valveStart.z },
    //                     diameter: diameter,
    //                     startNodeId: segData.startNodeId,
    //                     endNodeId: genNodeId(),
    //                     length: startPoint.distanceTo(valveStart)
    //                 };
                    
    //                 const newSeg2 = {
    //                     start: valveEnd.clone(),
    //                     end: endPoint.clone(),
    //                     startPos: { x: valveEnd.x, y: valveEnd.y, z: valveEnd.z },
    //                     endPos: { x: endPoint.x, y: endPoint.y, z: endPoint.z },
    //                     diameter: diameter,
    //                     startNodeId: genNodeId(),
    //                     endNodeId: segData.endNodeId,
    //                     length: valveEnd.distanceTo(endPoint)
    //                 };
                    
    //                 // Заменяем сегмент
    //                 const allSegs = [...pipeline.userData.segments];
    //                 allSegs.splice(segIndex, 1, newSeg1, newSeg2);
                    
    //                 // Пересоздаем трубопровод
    //                 const segsForFactory = allSegs.map(s => ({
    //                     start: new THREE.Vector3(s.startPos.x, s.startPos.y, s.startPos.z),
    //                     end: new THREE.Vector3(s.endPos.x, s.endPos.y, s.endPos.z),
    //                     diameter: s.diameter,
    //                     startNodeId: s.startNodeId,
    //                     endNodeId: s.endNodeId
    //                 }));
                    
    //                 const newPipelineRoot = Factory.createPipeline(segsForFactory, pipelineId);
    //                 if (newPipelineRoot) {
    //                     newPipelineRoot.position.copy(pipeline.root.position);
    //                     newPipelineRoot.rotation.copy(pipeline.root.rotation);
    //                     newPipelineRoot.userData.number = pipeline.userData.number;
    //                     newPipelineRoot.userData.isClosedLoop = pipeline.userData.isClosedLoop;
                        
    //                     Engine.scene.remove(pipeline.root);
    //                     Engine.scene.add(newPipelineRoot);
                        
    //                     pipeline.root = newPipelineRoot;
    //                     pipeline.userData = {
    //                         ...newPipelineRoot.userData,
    //                         number: pipeline.userData.number,
    //                         isClosedLoop: pipeline.userData.isClosedLoop
    //                     };
    //                 }
                    
    //                 // Создаем узел управления
    //                 STATE.objectCounter++;
    //                 STATE.valveCounter++;
                    
    //                 const valve = Factory.createControlValve(valveLength, diameter, STATE.objectCounter);
                    
    //                 // Позиционируем в МИРОВЫХ координатах
    //                 const worldValveCenter = valveCenter.clone();
    //                 pipeline.root.localToWorld(worldValveCenter);
    //                 valve.position.copy(worldValveCenter);
                    
    //                 // Вычисляем мировое направление сегмента
    //                 const worldDirection = direction.clone();
    //                 worldDirection.applyQuaternion(pipeline.root.quaternion);
                    
    //                 // Поворачиваем узел по мировому направлению
    //                 const quaternion = new THREE.Quaternion().setFromUnitVectors(
    //                     new THREE.Vector3(0, 0, 0),
    //                     worldDirection
    //                 );
    //                 valve.quaternion.copy(quaternion);
                    
    //                 valve.userData.number = STATE.valveCounter;
                    
    //                 // Добавляем в сцену (не как дочерний элемент!)
    //                 Engine.scene.add(valve);
                    
    //                 STATE.objects.push({
    //                     id: STATE.objectCounter,
    //                     type: 'control_valve',
    //                     root: valve,
    //                     userData: valve.userData
    //                 });
                    
    //                 STATE.insertValveMode = false;
    //                 document.getElementById('arm_valve')?.classList.remove('active');
    //                 Tree.update();
    //                 Utils.showStatus(`✓ Узел управления №${STATE.valveCounter} вставлен`);
    //             }
    //         } else {
    //             Utils.showStatus('Кликните по участку трубопровода!');
    //         }
    //         return;
    //     }

    //     // Остальные режимы
    //     if (STATE.pendingDuplicate) {
    //         UI.editor.finishDuplicate();
    //         return;
    //     }
        
    //     if (STATE.pendingSplitSegment) {
    //         this._handleSplitSegment();
    //         return;
    //     }
        
    //     if (STATE.connectPointsMode.active) {
    //         this._handleConnectPoints();
    //         return;
    //     }
        
    //     if (STATE.pipeline.active) {
    //         this._handlePipelineBuild();
    //         return;
    //     }
        
    //     if (STATE.connectMode.active) return;
        
    //     if (STATE.pendingBranch || STATE.pendingRow) {
    //         this._handleAttach();
    //         return;
    //     }
    // }

    _onCanvasClick(e) {
        if (this._isUIElement(e.target)) return;
        
        Engine.mouse.x = (e.clientX / innerWidth) * 2 - 1;
        Engine.mouse.y = -(e.clientY / innerHeight) * 2 + 1;
        Engine.raycaster.setFromCamera(Engine.mouse, Engine.camera);

        // === РЕЖИМ ВСТАВКИ АРМАТУРЫ ===
        if (STATE.insertArmatureMode) {
            const hits = Engine.raycaster.intersectObjects(Engine.scene.children, true);
            const segHit = hits.find(i => i.object.userData?.type === 'pipeSegment');
            
            if (segHit) {
                UI.armature.insertAt(STATE.insertArmatureMode, segHit);
                
                STATE.insertArmatureMode = null;
                document.querySelectorAll('.ribbon-btn-group .btn-ribbon').forEach(b => 
                    b.classList.remove('active')
                );
            } else {
                Utils.showStatus('Кликните по участку трубопровода!');
            }
            return;
        }

        // === ОСТАЛЬНЫЕ РЕЖИМЫ ===
        if (STATE.pendingDuplicate) {
            UI.editor.finishDuplicate();
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
            if (o) UI.editor.startDuplicate(o);
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
                g: () => UI.scene.toggleGrid(),
                h: () => UI.visuals.toggleConnectionPoints(),
                s: () => UI.split.startSegmentMode()
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
                UI.pipeline.addSegment();
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                UI.pipeline.cancel();
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
        
        UI.split.insertValveAt(segHit);
    }

    _handleSplitSegment() {
        const hits = Engine.raycaster.intersectObjects(Engine.scene.children, true);
        const sh = hits.find(i => i.object.userData?.type === 'pipeSegment');
        
        if (sh) {
            UI.split.promptSplit(sh.object.userData.pipelineId, sh.object.userData.index);
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
            UI.pipeline.updateCurrentPointUI();
            UI.pipeline.updatePreview();
            return;
        }
        
        const gh = Engine.raycaster.intersectObject(STATE.meshes.ground);
        if (gh.length > 0) {
            STATE.pipeline.currentPoint.set(gh[0].point.x, STATE.pipeline.currentPoint.y, gh[0].point.z);
            UI.pipeline.updateCurrentPointUI();
            UI.pipeline.updatePreview();
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
            // ✅ ИСПРАВЛЕНО: вызываем метод через экземпляр UI.editor
            UI.editor.attachToNode(po, nh.object);
        }
    }

    _handleGlobalEscape() {
        ['editModal', 'editRowModal', 'editPipelineModal', 'editValveModal',
         'createBranchModal', 'createRowModal', 'sceneSettingsModal',
         'splitPipelineModal', 'splitSegmentModal', 'networkGraphModal', 'newProjectModal']
            .forEach(id => document.getElementById(id)?.classList.remove('active'));
        
        UI.editor.cancelDuplicate();
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