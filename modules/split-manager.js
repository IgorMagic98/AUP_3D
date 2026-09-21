// modules/split-manager.js
class SplitManager {
    startSegmentMode() {
        STATE.pendingSplitSegment = true;
        Utils.showStatus('Кликните по сегменту');
    }

    promptSplit(pid, si) {
        const p = STATE.objects.find(o => o.id === pid);
        if (!p) return;
        
        const segs = p.userData.segments;
        if (!segs || !segs[si]) return;
        
        const seg = segs[si];
        this._splitSegmentData = {
            pipelineId: pid,
            segmentIndex: si,
            start: new THREE.Vector3(seg.startPos.x, seg.startPos.y, seg.startPos.z),
            end: new THREE.Vector3(seg.endPos.x, seg.endPos.y, seg.endPos.z),
            length: seg.length,
            diameter: seg.diameter
        };
        
        document.getElementById('splitSegPipelineId').textContent = p.userData.number || pid;
        document.getElementById('splitSegIndex').textContent = si + 1;
        document.getElementById('splitSegOrigLength').textContent = seg.length.toFixed(2);
        document.getElementById('splitSegDiameter').textContent = seg.diameter;
        document.getElementById('splitSegCountInput').value = 2;
        
        this._updateSplitSegmentInputs(2);
        document.getElementById('splitSegmentModal').classList.add('active');
        STATE.pendingSplitSegment = null;
    }

    _updateSplitSegmentInputs(c) {
        const el = document.getElementById('splitSegInputs');
        el.innerHTML = '';
        const tl = this._splitSegmentData.length;
        
        for (let i = 0; i < c; i++) {
            const r = document.createElement('div');
            r.className = 'segment-edit-row';
            r.innerHTML = `
                <span>${i + 1}.</span>
                <input type="number" class="ssLen" value="${(tl / c).toFixed(2)}" step="0.1" min="0.1">
                <select class="ssDn">${Utils.getDnOptions(this._splitSegmentData.diameter)}</select>
            `;
            el.appendChild(r);
        }
        
        el.querySelectorAll('.ssLen,.ssDn').forEach(e => {
            e.addEventListener('input', () => this._recalcSplitSegmentTotal());
        });
        
        this._recalcSplitSegmentTotal();
    }

    _recalcSplitSegmentTotal() {
        let t = 0;
        document.querySelectorAll('#splitSegInputs .ssLen').forEach(i => {
            t += parseFloat(i.value) || 0;
        });
        
        document.getElementById('splitSegSumLength').textContent = t.toFixed(2);
        
        const ol = this._splitSegmentData.length;
        const d = Math.abs(t - ol);
        const di = document.getElementById('splitSegDiffInfo');
        const w = document.getElementById('splitSegWarning');
        
        if (d > 0.05) {
            di.textContent = `(${t > ol ? '+' : ''}${(t - ol).toFixed(2)} м)`;
            di.style.color = '#d32f2f';
            w.style.display = 'block';
        } else {
            di.textContent = '✓';
            di.style.color = '#2a7a3e';
            w.style.display = 'none';
        }
    }

    applySplitSegment() {
        if (!this._splitSegmentData) return;
        
        const { pipelineId, segmentIndex, start, end, length, diameter } = this._splitSegmentData;
        const p = STATE.objects.find(o => o.id === pipelineId);
        if (!p) return;
        
        const nl = Array.from(document.querySelectorAll('#splitSegInputs .ssLen')).map(i => 
            parseFloat(i.value) || 0.1
        );
        const nd = Array.from(document.querySelectorAll('#splitSegInputs .ssDn')).map(s => 
            parseInt(s.value) || diameter
        );
        
        const dir = new THREE.Vector3().subVectors(end, start).normalize();
        const ns = [];
        let cp = start.clone();
        
        for (let i = 0; i < nl.length; i++) {
            const ep2 = cp.clone().addScaledVector(dir, nl[i]);
            ns.push({
                start: cp.clone(),
                end: ep2.clone(),
                diameter: nd[i],
                length: nl[i]
            });
            cp = ep2.clone();
        }
        
        const oldSegs = p.userData.segments;
        const newSegs = [];
        
        for (let i = 0; i < oldSegs.length; i++) {
            if (i === segmentIndex) {
                let prevNid = oldSegs[i].startNodeId;
                ns.forEach((s, j) => {
                    const enid = j === ns.length - 1 ? oldSegs[i].endNodeId : genNodeId();
                    newSegs.push({
                        id: `seg_${p.id}_${newSegs.length}`,
                        startNodeId: prevNid,
                        endNodeId: enid,
                        startPos: { x: s.start.x, y: s.start.y, z: s.start.z },
                        endPos: { x: s.end.x, y: s.end.y, z: s.end.z },
                        length: s.length,
                        diameter: s.diameter
                    });
                    prevNid = enid;
                });
            } else {
                newSegs.push({ ...oldSegs[i], id: `seg_${p.id}_${newSegs.length}` });
            }
        }
        
        const segsForFactory = newSegs.map(s => ({
            start: new THREE.Vector3(s.startPos.x, s.startPos.y, s.startPos.z),
            end: new THREE.Vector3(s.endPos.x, s.endPos.y, s.endPos.z),
            diameter: s.diameter,
            startNodeId: s.startNodeId,
            endNodeId: s.endNodeId
        }));
        
        const oldRoot = p.root;
        const nr = Factory.createPipeline(segsForFactory, p.id);
        
        if (!nr) return;
        
        nr.rotation.copy(oldRoot.rotation);
        nr.userData.rotation = p.userData.rotation;
        nr.userData.number = p.userData.number;
        nr.userData.connectedTo = p.userData.connectedTo;
        
        Engine.scene.remove(oldRoot);
        Engine.scene.add(nr);
        
        p.root = nr;
        p.userData = {
            ...nr.userData,
            rotation: p.userData.rotation,
            number: p.userData.number,
            connectedTo: p.userData.connectedTo
        };
        
        this.closeSplitSegmentModal();
        Tree.update();
        Utils.showStatus(`✓ Сегмент разбит на ${ns.length}`);
    }

    closeSplitSegmentModal() {
        document.getElementById('splitSegmentModal').classList.remove('active');
        this._splitSegmentData = null;
    }

    openPipelineModal(id) {
        if (!id) id = STATE.selectedObjectId;
        
        const o = STATE.objects.find(x => x.id === id);
        if (!o || o.type !== 'pipeline') return;
        
        STATE.currentSplitPipeId = id;
        document.getElementById('splitPipeId').textContent = o.userData.number || id;
        
        const segs = o.userData.segments || [];
        const tl = segs.reduce((a, s) => a + s.length, 0);
        
        document.getElementById('splitOrigInfo').textContent = `${segs.length} участков, ${tl.toFixed(2)} м`;
        document.getElementById('splitTotalLength').textContent = tl.toFixed(2);
        document.getElementById('splitSegCount').value = 3;
        
        this._updateSplitInputs(3);
        document.getElementById('splitWarning').style.display = 'none';
        document.getElementById('splitPipelineModal').classList.add('active');
    }

    _updateSplitInputs(c) {
        const el = document.getElementById('splitInputs');
        el.innerHTML = '';
        const tl = parseFloat(document.getElementById('splitTotalLength').textContent) || 0;
        
        for (let i = 0; i < c; i++) {
            const r = document.createElement('div');
            r.className = 'segment-edit-row';
            r.innerHTML = `
                <span>${i + 1}.</span>
                <input type="number" class="spLen" value="${(tl / c).toFixed(2)}" step="0.1" min="0.1">
                <select class="spDn">${Utils.getDnOptions(50)}</select>
            `;
            el.appendChild(r);
        }
        
        el.querySelectorAll('.spLen,.spDn').forEach(e => {
            e.addEventListener('input', () => this._recalcSplitTotal());
        });
        
        this._recalcSplitTotal();
    }

    _recalcSplitTotal() {
        let t = 0;
        document.querySelectorAll('#splitInputs .spLen').forEach(i => {
            t += parseFloat(i.value) || 0;
        });
        
        document.getElementById('splitSumLength').textContent = t.toFixed(2);
        
        const ol = parseFloat(document.getElementById('splitTotalLength').textContent) || 0;
        const d = Math.abs(t - ol);
        
        if (d > 0.05) {
            document.getElementById('splitDiffInfo').textContent = `(${t > ol ? '+' : ''}${(t - ol).toFixed(2)})`;
            document.getElementById('splitDiffInfo').style.color = '#d32f2f';
            document.getElementById('splitWarning').style.display = 'block';
        } else {
            document.getElementById('splitDiffInfo').textContent = '✓';
            document.getElementById('splitDiffInfo').style.color = '#2a7a3e';
            document.getElementById('splitWarning').style.display = 'none';
        }
    }

    applySplitPipeline() {
        const o = STATE.objects.find(x => x.id === STATE.currentSplitPipeId);
        if (!o) return;
        
        const nl = Array.from(document.querySelectorAll('#splitInputs .spLen')).map(i => 
            parseFloat(i.value) || 0.1
        );
        const nd = Array.from(document.querySelectorAll('#splitInputs .spDn')).map(s => 
            parseInt(s.value) || 50
        );
        
        const oldSegs = o.userData.segments;
        const allPts = [];
        
        oldSegs.forEach(s => {
            allPts.push(new THREE.Vector3(s.startPos.x, s.startPos.y, s.startPos.z));
            allPts.push(new THREE.Vector3(s.endPos.x, s.endPos.y, s.endPos.z));
        });
        
        const oldSegments = [];
        for (let i = 0; i < allPts.length - 1; i += 2) {
            const s = allPts[i], e = allPts[i + 1];
            const d = new THREE.Vector3().subVectors(e, s);
            const l = d.length();
            if (l > 0.001) {
                oldSegments.push({
                    start: s.clone(),
                    end: e.clone(),
                    dir: d.normalize(),
                    length: l
                });
            }
        }
        
        const newSegs = [];
        let si = 0, dis = 0, cp = oldSegments[0].start.clone();
        
        for (let i = 0; i < nl.length; i++) {
            let rem = nl[i];
            const dn = nd[i] || 50;
            
            while (rem > 0.001) {
                if (si >= oldSegments.length) {
                    newSegs.push({
                        start: cp.clone(),
                        end: cp.clone().addScaledVector(oldSegments[oldSegments.length - 1].dir, rem),
                        diameter: dn
                    });
                    rem = 0;
                    break;
                }
                
                const seg = oldSegments[si];
                const av = seg.length - dis;
                
                if (rem <= av + 0.001) {
                    newSegs.push({
                        start: cp.clone(),
                        end: cp.clone().addScaledVector(seg.dir, rem),
                        diameter: dn
                    });
                    dis += rem;
                    rem = 0;
                } else {
                    newSegs.push({
                        start: cp.clone(),
                        end: seg.end.clone(),
                        diameter: dn
                    });
                    rem -= av;
                    dis = 0;
                    si++;
                    cp = seg.end.clone();
                }
            }
            cp = newSegs[newSegs.length - 1].end.clone();
        }
        
        const sff = newSegs.map((s, i) => {
            const sn = genNodeId();
            const en = i === newSegs.length - 1 ? 
                (o.userData.isClosedLoop ? null : genNodeId()) : 
                genNodeId();
            return { ...s, startNodeId: sn, endNodeId: en };
        });
        
        for (let i = 1; i < sff.length; i++) {
            sff[i].startNodeId = sff[i - 1].endNodeId;
        }
        
        if (o.userData.isClosedLoop && sff.length > 0) {
            sff[sff.length - 1].endNodeId = sff[0].startNodeId;
        }
        
        const nr = Factory.createPipeline(sff, o.id);
        if (!nr) return;
        
        nr.rotation.copy(o.root.rotation);
        nr.userData.rotation = o.userData.rotation;
        nr.userData.number = o.userData.number;
        nr.userData.connectedTo = o.userData.connectedTo;
        
        Engine.scene.remove(o.root);
        Engine.scene.add(nr);
        
        o.root = nr;
        o.userData = {
            ...nr.userData,
            rotation: o.userData.rotation,
            number: o.userData.number,
            connectedTo: o.userData.connectedTo
        };
        
        this.closeSplitPipelineModal();
        Tree.update();
        Utils.showStatus(`✓ Разбит на ${newSegs.length}`);
    }

    closeSplitPipelineModal() {
        document.getElementById('splitPipelineModal').classList.remove('active');
    }


    insertValveAt(segHit) {
        const seg = segHit.object;
        const pipelineId = seg.userData.pipelineId;
        const segIndex = seg.userData.index;
        const pipeline = STATE.objects.find(o => o.id === pipelineId);
        
        if (!pipeline || !pipeline.userData.segments[segIndex]) {
            Utils.showStatus('Кликните по участку трубопровода!');
            return;
        }
        
        const segData = pipeline.userData.segments[segIndex];
        const startPoint = new THREE.Vector3(segData.startPos.x, segData.startPos.y, segData.startPos.z);
        const endPoint = new THREE.Vector3(segData.endPos.x, segData.endPos.y, segData.endPos.z);
        
        // Направление сегмента
        const direction = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
        const segLength = startPoint.distanceTo(endPoint);
        
        // Точка клика в мировых координатах
        const worldHitPoint = segHit.point.clone();
        
        // Переводим в локальные координаты трубопровода
        const localHitPoint = worldHitPoint.clone().sub(pipeline.root.position);
        
        // Вычисляем параметр t (от 0 до 1) - где на сегменте произошел клик
        const hitVector = new THREE.Vector3().subVectors(localHitPoint, startPoint);
        const t = Math.max(0.1, Math.min(0.9, hitVector.dot(direction) / segLength));
        
        // Длина узла управления
        const valveLength = 1.0;
        const halfValveLength = valveLength / 2;
        
        // Точка установки узла (центр)
        const valveCenter = startPoint.clone().add(direction.clone().multiplyScalar(t * segLength));
        
        // Начало и конец узла управления
        const valveStart = valveCenter.clone().sub(direction.clone().multiplyScalar(halfValveLength));
        const valveEnd = valveCenter.clone().add(direction.clone().multiplyScalar(halfValveLength));
        
        const diameter = segData.diameter;
        
        // Создаем два новых сегмента с учетом длины узла
        const newSeg1 = {
            startPos: { x: startPoint.x, y: startPoint.y, z: startPoint.z },
            endPos: { x: valveStart.x, y: valveStart.y, z: valveStart.z },
            start: startPoint.clone(),
            end: valveStart.clone(),
            diameter: diameter,
            startNodeId: segData.startNodeId,
            endNodeId: genNodeId(),
            length: startPoint.distanceTo(valveStart)
        };
        
        const newSeg2 = {
            startPos: { x: valveEnd.x, y: valveEnd.y, z: valveEnd.z },
            endPos: { x: endPoint.x, y: endPoint.y, z: endPoint.z },
            start: valveEnd.clone(),
            end: endPoint.clone(),
            diameter: diameter,
            startNodeId: genNodeId(),
            endNodeId: segData.endNodeId,
            length: valveEnd.distanceTo(endPoint)
        };
        
        // Заменяем исходный сегмент на два новых
        const allSegs = [...pipeline.userData.segments];
        allSegs.splice(segIndex, 1, newSeg1, newSeg2);
        
        // Пересоздаем визуальную модель трубопровода
        const segsForFactory = allSegs.map(s => ({
            start: s.start ? s.start.clone() : new THREE.Vector3(s.startPos.x, s.startPos.y, s.startPos.z),
            end: s.end ? s.end.clone() : new THREE.Vector3(s.endPos.x, s.endPos.y, s.endPos.z),
            diameter: s.diameter,
            startNodeId: s.startNodeId,
            endNodeId: s.endNodeId
        }));
        
        const newPipelineRoot = Factory.createPipeline(segsForFactory, pipelineId);
        
        if (newPipelineRoot) {
            newPipelineRoot.position.copy(pipeline.root.position);
            newPipelineRoot.rotation.copy(pipeline.root.rotation);
            newPipelineRoot.userData.number = pipeline.userData.number;
            newPipelineRoot.userData.isClosedLoop = pipeline.userData.isClosedLoop;
            newPipelineRoot.userData.connectedTo = pipeline.userData.connectedTo;
            
            Engine.scene.remove(pipeline.root);
            Engine.scene.add(newPipelineRoot);
            
            pipeline.root = newPipelineRoot;
            pipeline.userData = {
                ...newPipelineRoot.userData,
                number: pipeline.userData.number,
                isClosedLoop: pipeline.userData.isClosedLoop,
                connectedTo: pipeline.userData.connectedTo
            };
        }
        
        // Создаем узел управления
        STATE.objectCounter++;
        STATE.valveCounter++;
        
        const valve = Factory.createControlValve(valveLength, diameter, STATE.objectCounter);
        
        // Позиционируем узел управления в точке установки (в мировых координатах)
        valve.position.copy(valveCenter.clone().add(pipeline.root.position));
        
        // Поворачиваем узел управления по направлению сегмента
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(1, 0, 0),
            direction
        );
        valve.quaternion.copy(quaternion);
        
        valve.userData.number = STATE.valveCounter;
        
        Engine.scene.add(valve);
        STATE.objects.push({
            id: STATE.objectCounter,
            type: 'control_valve',
            root: valve,
            userData: valve.userData
        });
        
        STATE.insertValveMode = false;
        document.getElementById('arm_valve')?.classList.remove('active');
        
        Tree.update();
        Utils.showStatus(`✓ Участок разбит. Узел управления №${STATE.valveCounter} вставлен.`);
    }



    /**
     * Редактировать параметры сегмента трубопровода
     */
    applySegmentEdit(pipelineId, segmentIndex, newLength, newDiameter) {
        const pipeline = STATE.objects.find(o => o.id === pipelineId);
        if (!pipeline || !pipeline.userData.segments[segmentIndex]) {
            Utils.showStatus('Сегмент не найден');
            return;
        }
        
        const segData = pipeline.userData.segments[segmentIndex];
        const startPoint = new THREE.Vector3(segData.startPos.x, segData.startPos.y, segData.startPos.z);
        const endPoint = new THREE.Vector3(segData.endPos.x, segData.endPos.y, segData.endPos.z);
        
        // Направление сегмента
        const direction = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
        
        // Новая конечная точка
        const newEndPoint = startPoint.clone().add(direction.clone().multiplyScalar(newLength));
        
        // Обновляем данные сегмента
        segData.length = newLength;
        segData.diameter = newDiameter;
        segData.endPos = { 
            x: newEndPoint.x, 
            y: newEndPoint.y, 
            z: newEndPoint.z 
        };
        
        // Пересоздаем трубопровод
        const allSegs = [...pipeline.userData.segments];
        const segsForFactory = allSegs.map(s => ({
            start: new THREE.Vector3(s.startPos.x, s.startPos.y, s.startPos.z),
            end: new THREE.Vector3(s.endPos.x, s.endPos.y, s.endPos.z),
            diameter: s.diameter,
            startNodeId: s.startNodeId,
            endNodeId: s.endNodeId
        }));
        
        const newPipelineRoot = Factory.createPipeline(segsForFactory, pipelineId);
        
        if (newPipelineRoot) {
            newPipelineRoot.position.copy(pipeline.root.position);
            newPipelineRoot.rotation.copy(pipeline.root.rotation);
            newPipelineRoot.userData.number = pipeline.userData.number;
            newPipelineRoot.userData.isClosedLoop = pipeline.userData.isClosedLoop;
            newPipelineRoot.userData.connectedTo = pipeline.userData.connectedTo;
            
            Engine.scene.remove(pipeline.root);
            Engine.scene.add(newPipelineRoot);
            
            pipeline.root = newPipelineRoot;
            pipeline.userData = {
                ...newPipelineRoot.userData,
                number: pipeline.userData.number,
                isClosedLoop: pipeline.userData.isClosedLoop,
                connectedTo: pipeline.userData.connectedTo
            };
        }
        
        Tree.update();
        Utils.showStatus(`✓ Участок #${segmentIndex + 1} обновлен: ${newLength.toFixed(2)}м, DN${newDiameter}`);
    }

    // insertValveAt(segHit) {
    //     const seg = segHit.object;
    //     const pipelineId = seg.userData.pipelineId;
    //     const segIndex = seg.userData.index;
    //     const pipeline = STATE.objects.find(o => o.id === pipelineId);
        
    //     if (!pipeline || !pipeline.userData.segments[segIndex]) {
    //         Utils.showStatus('Кликните по участку трубопровода!');
    //         return;
    //     }
        
    //     const segData = pipeline.userData.segments[segIndex];
        
    //     // Проверяем, существуют ли startPos и endPos
    //     if (!segData.startPos || !segData.endPos) {
    //         console.error('Сегмент не имеет startPos или endPos:', segData);
    //         Utils.showStatus('Ошибка: некорректные данные сегмента');
    //         return;
    //     }
        
    //     const startPoint = new THREE.Vector3(segData.startPos.x, segData.startPos.y, segData.startPos.z);
    //     const endPoint = new THREE.Vector3(segData.endPos.x, segData.endPos.y, segData.endPos.z);
        
    //     // Точка клика в мировых координатах
    //     const worldHitPoint = segHit.point.clone();
        
    //     // Переводим в локальные координаты трубопровода
    //     const localHitPoint = worldHitPoint.clone().sub(pipeline.root.position);
        
    //     // Вычисляем параметр t (от 0 до 1) - где на сегменте произошел клик
    //     const segVector = new THREE.Vector3().subVectors(endPoint, startPoint);
    //     const hitVector = new THREE.Vector3().subVectors(localHitPoint, startPoint);
        
    //     // Проекция точки клика на вектор сегмента
    //     const t = hitVector.dot(segVector) / segVector.lengthSq();
        
    //     // Ограничиваем t, чтобы не резать у самых краев (5% от начала и конца)
    //     const clampedT = Math.max(0.05, Math.min(0.95, t));
        
    //     // Точка разреза в локальных координатах
    //     const splitPoint = startPoint.clone().lerp(endPoint, clampedT);
        
    //     const diameter = segData.diameter;
        
    //     // Создаем ID для новых узлов
    //     const newStartNodeId = segData.startNodeId; // Начало первого сегмента = начало исходного
    //     const valveInNodeId = genNodeId();          // Вход в узел управления
    //     const valveOutNodeId = genNodeId();         // Выход из узла управления
    //     const newEndNodeId = segData.endNodeId;     // Конец второго сегмента = конец исходного
        
    //     // Создаем два новых сегмента
    //     const newSeg1 = {
    //         start: startPoint.clone(),
    //         end: splitPoint.clone(),
    //         diameter: diameter,
    //         startNodeId: newStartNodeId,
    //         endNodeId: valveInNodeId
    //     };
        
    //     const newSeg2 = {
    //         start: splitPoint.clone(),
    //         end: endPoint.clone(),
    //         diameter: diameter,
    //         startNodeId: valveOutNodeId,
    //         endNodeId: newEndNodeId
    //     };
        
    //     // Заменяем исходный сегмент на два новых
    //     const allSegs = [...pipeline.userData.segments];
    //     allSegs.splice(segIndex, 1, newSeg1, newSeg2);
        
    //     // Пересоздаем визуальную модель трубопровода
        
    //     const segsForFactory = allSegs.map(s => ({
    //         start: s.start ? s.start.clone() : new THREE.Vector3(s.startPos.x, s.startPos.y, s.startPos.z),
    //         end: s.end ? s.end.clone() : new THREE.Vector3(s.endPos.x, s.endPos.y, s.endPos.z),
    //         diameter: s.diameter,
    //         startNodeId: s.startNodeId,
    //         endNodeId: s.endNodeId
    //     }));
        
    //     const newPipelineRoot = Factory.createPipeline(segsForFactory, pipelineId);
        
    //     if (newPipelineRoot) {
    //         newPipelineRoot.position.copy(pipeline.root.position);
    //         newPipelineRoot.rotation.copy(pipeline.root.rotation);
    //         newPipelineRoot.userData.number = pipeline.userData.number;
    //         newPipelineRoot.userData.isClosedLoop = pipeline.userData.isClosedLoop;
    //         newPipelineRoot.userData.connectedTo = pipeline.userData.connectedTo;
            
    //         Engine.scene.remove(pipeline.root);
    //         Engine.scene.add(newPipelineRoot);
            
    //         pipeline.root = newPipelineRoot;
    //         pipeline.userData = {
    //             ...newPipelineRoot.userData,
    //             number: pipeline.userData.number,
    //             isClosedLoop: pipeline.userData.isClosedLoop,
    //             connectedTo: pipeline.userData.connectedTo
    //         };
    //     }
        
    //     // Создаем узел управления
    //     STATE.objectCounter++;
    //     STATE.valveCounter++;
        
    //     const valveLength = 1;
    //     const valve = Factory.createControlValve(valveLength, diameter, STATE.objectCounter);
        
    //     // Позиционируем узел управления в точке разреза (в мировых координатах)
    //     valve.position.copy(splitPoint.clone().add(pipeline.root.position));
        
    //     // Поворачиваем узел управления по направлению сегмента
    //     const direction = segVector.clone().normalize();
    //     const quaternion = new THREE.Quaternion().setFromUnitVectors(
    //         new THREE.Vector3(1, 0, 0),
    //         direction
    //     );
    //     valve.quaternion.copy(quaternion);
        
    //     valve.userData.number = STATE.valveCounter;
        
    //     Engine.scene.add(valve);
    //     STATE.objects.push({
    //         id: STATE.objectCounter,
    //         type: 'control_valve',
    //         root: valve,
    //         userData: valve.userData
    //     });
        
    //     STATE.insertValveMode = false;
    //     document.getElementById('arm_valve')?.classList.remove('active');
        
    //     Tree.update();
    //     Utils.showStatus(`✓ Участок разбит. Узел управления №${STATE.valveCounter} вставлен.`);
    // }
}