// modules/ui-app.js
class UIApp {
    constructor() {
        this.project = new ProjectManager();
        this.scene = new SceneManager();
        this.pipeline = new PipelineBuilder();
        this.editor = new ObjectEditor();
        this.split = new SplitManager();
        this.graph = new NetworkGraph();
        this.input = null;
        this.visuals = new VisualEffects();
    }

    init() {
        // Сначала инициализируем Engine
        Engine.init();
        
        // Теперь создаем InputHandler (ему нужен Engine.renderer)
        this.input = new InputHandler();
        
        this._bindRibbonButtons();
        this._bindToolbarButtons();
        this._bindPipelineBuilderButtons();
        this._bindModalButtons();
        
        World.updateGroundSize(50, 50);
        Tree.init();
        Tree.update();
    }

    _bindRibbonButtons() {
        document.getElementById('menuNew').onclick = () => {
            document.getElementById('newProjectModal').classList.add('active');
            document.getElementById('projectNameInput').value = '';
            document.getElementById('projectFolderPath').value = '';
            STATE.project.folderHandle = null;
        };
        
        document.getElementById('menuOpen').onclick = () => this.project.open();
        document.getElementById('menuSave').onclick = () => this.project.save();
        
        document.getElementById('menuCreatePipeline').onclick = () => this.pipeline.start();
        document.getElementById('menuSplitSegment').onclick = () => this.split.startSegmentMode();
        document.getElementById('menuSplitPipeline').onclick = () => this.split.openPipelineModal();
        document.getElementById('menuDuplicateObject').onclick = () => {
            const o = STATE.objects.find(x => x.id === STATE.selectedObjectId && x.type === 'pipeline');
            if (o) this.editor.startDuplicate(o);
            else Utils.showStatus('Выберите трубопровод в дереве');
        };
        
        document.getElementById('menuConnectPoints').onclick = () => {
            if (STATE.connectPointsMode.active) {
                this.input._cancelConnectPoints();
            } else {
                STATE.connectPointsMode.active = true;
                STATE.connectPointsMode.selectedPoints = [];
                Utils.showStatus('Выберите 2 шара');
            }
        };
        
        document.getElementById('menuConnectBranches').onclick = () => {
            if (STATE.connectMode.active) {
                STATE.connectMode.active = false;
                STATE.connectMode.selectedBranches = [];
            } else {
                STATE.connectMode.active = true;
                STATE.connectMode.selectedBranches = [];
                Utils.showStatus('Выберите 2 узла');
            }
        };
        
        document.getElementById('menuCreateBranch').onclick = () => {
            this._updateCreateBranchInputs(4);
            document.getElementById('createBranchSprCount').value = 4;
            document.getElementById('createBranchModal').classList.add('active');
        };
        
        document.getElementById('menuDuplicateBranch').onclick = () => {
            const o = STATE.objects.find(x => x.id === STATE.selectedObjectId && x.type === 'branch');
            if (o) this.editor.startDuplicate(o);
            else Utils.showStatus('Выберите ветку в дереве');
        };
        
        document.getElementById('menuCreateRow').onclick = () => {
            document.getElementById('createRowLeftCount').value = 3;
            document.getElementById('createRowRightCount').value = 3;
            this._updateCreateRowSideInputs('Left', 3);
            this._updateCreateRowSideInputs('Right', 3);
            document.getElementById('createRowModal').classList.add('active');
        };
        
        document.getElementById('menuDuplicateRow').onclick = () => {
            const o = STATE.objects.find(x => x.id === STATE.selectedObjectId && x.type === 'sprinkler_row');
            if (o) this.editor.startDuplicate(o);
            else Utils.showStatus('Выберите рядок в дереве');
        };
        
        document.getElementById('arm_valve').onclick = () => {
            STATE.insertValveMode = !STATE.insertValveMode;
            const btn = document.getElementById('arm_valve');
            if (STATE.insertValveMode) {
                btn.classList.add('active');
                Utils.showStatus('🔧 Режим вставки узла управления АКТИВЕН. Кликните по участку трубопровода для разбивки.');
            } else {
                btn.classList.remove('active');
                Utils.showStatus('Режим вставки узла управления отключен.');
            }
        };
        
        ['arm_gate', 'arm_check', 'arm_filter', 'arm_reg'].forEach(id => {
            document.getElementById(id).onclick = () => 
                Utils.showStatus('Функция добавления арматуры находится в разработке');
        });
        
        ['src_tank', 'src_city', 'src_pump'].forEach(id => {
            document.getElementById(id).onclick = () => 
                Utils.showStatus('Функция добавления источника находится в разработке');
        });
        
        document.getElementById('menuSceneSettings').onclick = () => this.scene.openSceneSettings();
        document.getElementById('menuRunCalc').onclick = () => Utils.showStatus('Запуск гидравлического расчета... (демо-режим)');
        
        document.getElementById('menuShowGraph').onclick = () => this.graph.show();
        document.getElementById('menuShowAutoConnections').onclick = () => this.graph.showAutoConnections();
        
        document.getElementById('menuResetView').onclick = () => this.scene.resetView();
        document.getElementById('menuToggleGrid').onclick = () => this.scene.toggleGrid();
        document.getElementById('menuTopView').onclick = () => this.scene.topView();
        document.getElementById('menuToggleCameraMode').onclick = () => this.scene.toggleCameraMode();
        
        const toggleConnBtn = document.getElementById('menuToggleConnectionPoints');
        if (toggleConnBtn) toggleConnBtn.onclick = () => this.visuals.toggleConnectionPoints();
        
        const toggleDiamBtn = document.getElementById('menuToggleDiameters');
        if (toggleDiamBtn) toggleDiamBtn.onclick = () => this.visuals.toggleDiameters();
    }

    _bindToolbarButtons() {
        document.getElementById('resetViewBtn').onclick = () => this.scene.resetView();
        document.getElementById('toggleGridBtn').onclick = () => this.scene.toggleGrid();
        document.getElementById('topViewBtn').onclick = () => this.scene.topView();
        document.getElementById('toggleConnectionPointsBtn').onclick = () => this.visuals.toggleConnectionPoints();
        document.getElementById('toggleDiametersBtn').onclick = () => this.visuals.toggleDiameters();
    }

    _bindPipelineBuilderButtons() {
        document.querySelectorAll('#pipelineBuilder .axis-btn').forEach(b => {
            b.addEventListener('click', e => {
                document.querySelectorAll('#pipelineBuilder .axis-btn').forEach(x => x.classList.remove('active'));
                e.currentTarget.classList.add('active');
                STATE.pipeline.axis = e.currentTarget.dataset.axis;
                this.pipeline.updatePreview();
            });
        });
        
        document.querySelectorAll('#pipelineBuilder .dir-btn').forEach(b => {
            b.addEventListener('click', e => {
                document.querySelectorAll('#pipelineBuilder .dir-btn').forEach(x => x.classList.remove('active'));
                e.currentTarget.classList.add('active');
                STATE.pipeline.direction = e.currentTarget.dataset.dir;
                this.pipeline.updatePreview();
            });
        });
        
        ['pbCX', 'pbCY', 'pbCZ', 'pbLength'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.pipeline.updatePreview());
        });
        
        document.getElementById('pbDiameter').addEventListener('change', e => {
            STATE.pipeline.diameter = parseInt(e.target.value) || 25;
            this.pipeline.updatePreview();
        });
        
        document.getElementById('pbConfirm').addEventListener('click', () => this.pipeline.addSegment());
        document.getElementById('pbFinish').addEventListener('click', () => this.pipeline.finish());
        document.getElementById('pbCancel').addEventListener('click', () => this.pipeline.cancel());
    }

    _bindModalButtons() {
        document.getElementById('sceneSettingsCancelBtn').onclick = () => 
            document.getElementById('sceneSettingsModal').classList.remove('active');
        
        document.getElementById('sceneSettingsApplyBtn').onclick = () => {
            this.scene.applySceneSettings();
        };
        
        document.getElementById('sceneSettingsModal').onclick = e => {
            if (e.target.id === 'sceneSettingsModal') {
                e.target.classList.remove('active');
            }
        };
        
        document.getElementById('createBranchCancelBtn').onclick = () => 
            document.getElementById('createBranchModal').classList.remove('active');
        
        document.getElementById('createBranchModal').onclick = e => {
            if (e.target.id === 'createBranchModal') {
                e.target.classList.remove('active');
            }
        };
        
        document.getElementById('createBranchUpdateBtn').onclick = () => {
            const c = Utils.clamp(parseInt(document.getElementById('createBranchSprCount').value) || 1, 1, 50);
            document.getElementById('createBranchSprCount').value = c;
            this._updateCreateBranchInputs(c);
        };
        
        document.getElementById('createBranchApplyBtn').onclick = () => {
            const { lengths, diameters } = this._getCreateBranchData();
            if (!lengths.length) {
                Utils.showStatus('Нет участков!');
                return;
            }
            
            STATE.objectCounter++;
            STATE.branchCounter++;
            
            const br = Factory.createBranch(lengths, diameters, STATE.objectCounter);
            br.position.set(0, 5, 0);
            br.userData.number = STATE.branchCounter;
            
            Engine.scene.add(br);
            STATE.objects.push({
                id: STATE.objectCounter,
                type: 'branch',
                root: br,
                userData: br.userData
            });
            
            document.getElementById('createBranchModal').classList.remove('active');
            Tree.update();
            Utils.showStatus(`Ветка №${STATE.branchCounter} создана`);
        };
        
        document.getElementById('createRowCancelBtn').onclick = () => 
            document.getElementById('createRowModal').classList.remove('active');
        
        document.getElementById('createRowModal').onclick = e => {
            if (e.target.id === 'createRowModal') {
                e.target.classList.remove('active');
            }
        };
        
        document.getElementById('createRowUpdateLeftBtn').onclick = () => {
            const c = Utils.clamp(parseInt(document.getElementById('createRowLeftCount').value) || 0, 0, 30);
            document.getElementById('createRowLeftCount').value = c;
            this._updateCreateRowSideInputs('Left', c);
        };
        
        document.getElementById('createRowUpdateRightBtn').onclick = () => {
            const c = Utils.clamp(parseInt(document.getElementById('createRowRightCount').value) || 0, 0, 30);
            document.getElementById('createRowRightCount').value = c;
            this._updateCreateRowSideInputs('Right', c);
        };
        
        document.getElementById('createRowApplyBtn').onclick = () => {
            const ld = this._getCreateRowSideData('Left');
            const rd = this._getCreateRowSideData('Right');
            
            if (!ld.lengths.length && !rd.lengths.length) {
                Utils.showStatus('Добавьте участок!');
                return;
            }
            
            STATE.objectCounter++;
            STATE.rowCounter++;
            
            const row = Factory.createSprinklerRow(
                ld.lengths, ld.diameters,
                rd.lengths, rd.diameters,
                STATE.objectCounter
            );
            row.position.set(0, 5, 0);
            row.userData.number = STATE.rowCounter;
            
            Engine.scene.add(row);
            STATE.objects.push({
                id: STATE.objectCounter,
                type: 'sprinkler_row',
                root: row,
                userData: row.userData
            });
            
            document.getElementById('createRowModal').classList.remove('active');
            Tree.update();
            Utils.showStatus(`Рядок №${STATE.rowCounter} создан`);
        };
        
        document.getElementById('graphCloseBtn').onclick = () => this.graph.close();
        
        document.getElementById('networkGraphModal').onclick = e => {
            if (e.target.id === 'networkGraphModal') {
                this.graph.close();
            }
        };
        
        document.getElementById('graphDownloadBtn').onclick = () => this.graph.downloadJson();
        
        document.getElementById('graphCopyJson').onclick = () => {
            document.getElementById('graphJsonOutput').select();
            document.execCommand('copy');
        };
        
        document.getElementById('graphTabSchema').onclick = () => this.graph._switchGraphTab('Schema');
        document.getElementById('graphTabTable').onclick = () => this.graph._switchGraphTab('Table');
        document.getElementById('graphTabExport').onclick = () => this.graph._switchGraphTab('Export');
        
        document.getElementById('graphZoomIn').onclick = () => this.graph._graphZoomBy(1.3);
        document.getElementById('graphZoomOut').onclick = () => this.graph._graphZoomBy(0.7);
        document.getElementById('graphZoomReset').onclick = () => {
            STATE.graphView.scale = 1;
            STATE.graphView.panX = 0;
            STATE.graphView.panY = 0;
            this.graph._graphApplyTransform();
        };
        document.getElementById('graphZoomFit').onclick = () => this.graph._graphFitView();
        
        const gs = document.getElementById('graphSvg');
        gs.addEventListener('wheel', e => {
            e.preventDefault();
            const r = gs.getBoundingClientRect();
            this.graph._graphZoomAt(e.clientX - r.left, e.clientY - r.top, 1 + (e.deltaY > 0 ? -0.1 : 0.1));
        }, { passive: false });
        
        gs.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            STATE.graphView.isPanning = true;
            STATE.graphView.lastMouseX = e.clientX;
            STATE.graphView.lastMouseY = e.clientY;
            e.preventDefault();
        });
        
        addEventListener('mousemove', e => {
            if (!STATE.graphView.isPanning) return;
            STATE.graphView.panX += e.clientX - STATE.graphView.lastMouseX;
            STATE.graphView.panY += e.clientY - STATE.graphView.lastMouseY;
            STATE.graphView.lastMouseX = e.clientX;
            STATE.graphView.lastMouseY = e.clientY;
            this.graph._graphApplyTransform();
        });
        
        addEventListener('mouseup', () => {
            STATE.graphView.isPanning = false;
        });
        
        ['editCancelBtn', 'editModal'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.onclick = id === 'editModal' ? 
                    e => { if (e.target.id === 'editModal') this.editor.closeEditModal(); } : 
                    () => this.editor.closeEditModal();
            }
        });
        
        document.getElementById('editApplyBtn').onclick = () => this.editor.applyEdit();
        document.getElementById('editDeleteBtn').onclick = () => this.editor.deleteObject(STATE.currentEditId);
        
        document.getElementById('editUpdateSprBtn').onclick = () => {
            const c = Utils.clamp(parseInt(document.getElementById('editSprCount').value) || 1, 1, 50);
            document.getElementById('editSprCount').value = c;
            this.editor._updateEditSegments(Array(c).fill(2), Array(c).fill(50));
        };
        
        ['rowEditCancelBtn', 'editRowModal'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.onclick = id === 'editRowModal' ? 
                    e => { if (e.target.id === 'editRowModal') this.editor.closeRowEditModal(); } : 
                    () => this.editor.closeRowEditModal();
            }
        });
        
        document.getElementById('rowEditApplyBtn').onclick = () => this.editor.applyRowEdit();
        document.getElementById('rowEditDeleteBtn').onclick = () => {
            if (STATE.currentEditRowId && confirm('Удалить?')) {
                const i = STATE.objects.findIndex(o => o.id === STATE.currentEditRowId);
                if (i >= 0) {
                    Engine.scene.remove(STATE.objects[i].root);
                    STATE.objects.splice(i, 1);
                    this.editor.closeRowEditModal();
                    Tree.update();
                }
            }
        };
        
        document.getElementById('rowEditUpdateLeftBtn').onclick = () => {
            const c = Utils.clamp(parseInt(document.getElementById('rowEditLeftCount').value) || 0, 0, 30);
            document.getElementById('rowEditLeftCount').value = c;
            this.editor._updateRowEditSide('Left', Array(c).fill(2), Array(c).fill(50));
        };
        
        document.getElementById('rowEditUpdateRightBtn').onclick = () => {
            const c = Utils.clamp(parseInt(document.getElementById('rowEditRightCount').value) || 0, 0, 30);
            document.getElementById('rowEditRightCount').value = c;
            this.editor._updateRowEditSide('Right', Array(c).fill(2), Array(c).fill(50));
        };
        
        ['pipeEditCancelBtn', 'editPipelineModal'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.onclick = id === 'editPipelineModal' ? 
                    e => { if (e.target.id === 'editPipelineModal') this.editor.closePipelineEditModal(); } : 
                    () => this.editor.closePipelineEditModal();
            }
        });
        
        document.getElementById('pipeEditApplyBtn').onclick = () => this.editor.applyPipelineEdit();
        document.getElementById('pipeEditDeleteBtn').onclick = () => {
            if (STATE.currentEditPipeId && confirm('Удалить?')) {
                const i = STATE.objects.findIndex(o => o.id === STATE.currentEditPipeId);
                if (i >= 0) {
                    Engine.scene.remove(STATE.objects[i].root);
                    STATE.objects.splice(i, 1);
                    this.editor.closePipelineEditModal();
                    Tree.update();
                }
            }
        };
        
        document.getElementById('pipeEditAddSegBtn').onclick = () => this.editor.addPipelineEditSegment();
        
        ['splitCancelBtn', 'splitPipelineModal'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.onclick = id === 'splitPipelineModal' ? 
                    e => { if (e.target.id === 'splitPipelineModal') this.split.closeSplitPipelineModal(); } : 
                    () => this.split.closeSplitPipelineModal();
            }
        });
        
        document.getElementById('splitApplyBtn').onclick = () => this.split.applySplitPipeline();
        
        document.getElementById('splitUpdateBtn').onclick = () => {
            const c = Utils.clamp(parseInt(document.getElementById('splitSegCount').value) || 1, 1, 50);
            document.getElementById('splitSegCount').value = c;
            this.split._updateSplitInputs(c);
        };
        
        document.getElementById('splitEqualBtn').onclick = () => {
            const o = STATE.objects.find(x => x.id === STATE.currentSplitPipeId);
            if (!o) return;
            const tl = parseFloat(document.getElementById('splitTotalLength').textContent) || 0;
            const c = parseInt(document.getElementById('splitSegCount').value) || 1;
            document.querySelectorAll('#splitInputs .spLen').forEach(i => i.value = (tl / c).toFixed(2));
            this.split._recalcSplitTotal();
        };
        
        ['splitSegCancelBtn', 'splitSegmentModal'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.onclick = id === 'splitSegmentModal' ? 
                    e => { if (e.target.id === 'splitSegmentModal') this.split.closeSplitSegmentModal(); } : 
                    () => this.split.closeSplitSegmentModal();
            }
        });
        
        document.getElementById('splitSegApplyBtn').onclick = () => this.split.applySplitSegment();
        
        document.getElementById('splitSegUpdateBtn').onclick = () => {
            const c = Utils.clamp(parseInt(document.getElementById('splitSegCountInput').value) || 1, 1, 50);
            document.getElementById('splitSegCountInput').value = c;
            this.split._updateSplitSegmentInputs(c);
        };
        
        document.getElementById('splitSegEqualBtn').onclick = () => {
            if (!this.split._splitSegmentData) return;
            const tl = this.split._splitSegmentData.length;
            const c = parseInt(document.getElementById('splitSegCountInput').value) || 1;
            document.querySelectorAll('#splitSegInputs .ssLen').forEach(i => i.value = (tl / c).toFixed(2));
            this.split._recalcSplitSegmentTotal();
        };
        
        ['valveEditCancelBtn', 'editValveModal'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.onclick = id === 'editValveModal' ? 
                    e => { if (e.target.id === 'editValveModal') this.editor.closeValveEditModal(); } : 
                    () => this.editor.closeValveEditModal();
            }
        });
        
        document.getElementById('valveEditApplyBtn').onclick = () => this.editor.applyValveEdit();
        document.getElementById('valveEditDeleteBtn').onclick = () => {
            if (STATE.currentEditValveId && confirm('Удалить узел управления?')) {
                const i = STATE.objects.findIndex(o => o.id === STATE.currentEditValveId);
                if (i >= 0) {
                    Engine.scene.remove(STATE.objects[i].root);
                    STATE.objects.splice(i, 1);
                    this.editor.closeValveEditModal();
                    Tree.update();
                }
            }
        };
        
        document.querySelectorAll('.rot-btn').forEach(b => {
            b.addEventListener('click', e => {
                e.stopPropagation();
                const tg = e.currentTarget.dataset.target || 'branch';
                const ax = e.currentTarget.dataset.axis;
                const an = parseFloat(e.currentTarget.dataset.angle);
                const pf = tg === 'pipe' ? 'pipeEditRot' : 
                            tg === 'row' ? 'rowEditRot' : 
                            tg === 'valve' ? 'valveEditRot' : 'editRot';
                const inp = document.getElementById(`${pf}${ax.toUpperCase()}`);
                if (inp) inp.value = (parseFloat(inp.value) || 0) + an;
            });
        });
        
        ['editResetRotBtn', 'rowEditResetRotBtn', 'pipeEditResetRotBtn', 'valveEditResetRotBtn'].forEach(id => {
            document.getElementById(id).onclick = () => {
                const pf = id.replace('ResetRotBtn', '');
                [`${pf}RotX`, `${pf}RotY`, `${pf}RotZ`].forEach(x => {
                    const el = document.getElementById(x);
                    if (el) el.value = 0;
                });
            };
        });
    }

    _updateCreateBranchInputs(c) {
        const el = document.getElementById('createBranchInputs');
        el.innerHTML = '';
        
        for (let i = 0; i < c; i++) {
            const r = document.createElement('div');
            r.className = 'segment-row';
            r.innerHTML = `
                <span>${i + 1}.</span>
                <input type="number" class="cbLen" value="2" step="0.1" min="0.1" max="100">
                <select class="cbDn">${Utils.getDnOptions(50)}</select>
            `;
            el.appendChild(r);
        }
        
        el.querySelectorAll('.cbLen').forEach(i => {
            i.addEventListener('input', () => this._calcCreateBranchTotal());
        });
        
        this._calcCreateBranchTotal();
    }

    _calcCreateBranchTotal() {
        let t = 0;
        document.querySelectorAll('#createBranchInputs .cbLen').forEach(i => {
            t += Utils.clamp(parseFloat(i.value) || 0, 0.1, 100);
        });
        document.getElementById('createBranchTotalLength').textContent = t.toFixed(2);
    }

    _getCreateBranchData() {
        return {
            lengths: Array.from(document.querySelectorAll('#createBranchInputs .cbLen')).map(i => 
                Utils.clamp(parseFloat(i.value) || 2, 0.1, 100)
            ),
            diameters: Array.from(document.querySelectorAll('#createBranchInputs .cbDn')).map(s => 
                parseInt(s.value) || 50
            )
        };
    }

    _updateCreateRowSideInputs(side, c) {
        const el = document.getElementById(`createRow${side}Inputs`);
        el.innerHTML = '';
        
        for (let i = 0; i < c; i++) {
            const r = document.createElement('div');
            r.className = 'segment-row';
            r.innerHTML = `
                <span>${i + 1}.</span>
                <input type="number" class="crLen" value="2" step="0.1" min="0.1">
                <select class="crDn">${Utils.getDnOptions(50)}</select>
            `;
            el.appendChild(r);
        }
    }

    _getCreateRowSideData(side) {
        const c = document.getElementById(`createRow${side}Inputs`);
        return {
            lengths: Array.from(c.querySelectorAll('.crLen')).map(i => 
                Utils.clamp(parseFloat(i.value) || 2, 0.1, 100)
            ),
            diameters: Array.from(c.querySelectorAll('.crDn')).map(s => 
                parseInt(s.value) || 50
            )
        };
    }
}

const UI = new UIApp();