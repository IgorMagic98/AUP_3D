// modules/armature.js
class Armature {
    constructor() {
        this.types = {
            valve: { name: 'Узел управления', length: 1.0, color: 0xff6600 },
            gate: { name: 'Задвижка', length: 0.5, color: 0x888888 },
            check: { name: 'Обратный клапан', length: 0.6, color: 0x33cc33 },
            filter: { name: 'Фильтр', length: 0.8, color: 0x3366ff },
            reg: { name: 'Регулятор давления', length: 0.7, color: 0xff3333 }
        };
    }

    // ============================================
    // ШАГ 1: ТОЛЬКО ВЫРЕЗКА (без визуала и арматуры)
    // ============================================
    
    /**
     * Вырезать сегмент трубопровода в точке клика.
     * Возвращает данные о разрезе, но НЕ меняет сцену.
     */
    cutSegment(pipeline, segIndex, segHit) {
        const segData = pipeline.userData.segments[segIndex];
        if (!segData) return null;

        const startPoint = new THREE.Vector3(
            segData.startPos.x, segData.startPos.y, segData.startPos.z
        );
        const endPoint = new THREE.Vector3(
            segData.endPos.x, segData.endPos.y, segData.endPos.z
        );

        // Точка клика в локальных координатах
        const localHitPoint = segHit.point.clone();
        pipeline.root.worldToLocal(localHitPoint);

        const segVector = new THREE.Vector3().subVectors(endPoint, startPoint);
        const segLength = segVector.length();
        const direction = segVector.clone().normalize();

        const hitVector = new THREE.Vector3().subVectors(localHitPoint, startPoint);
        const t = Math.max(0.1, Math.min(0.9, hitVector.dot(direction) / segLength));

        // Центр разреза
        const cutCenter = startPoint.clone().add(direction.clone().multiplyScalar(t * segLength));

        return {
            segIndex,
            segData,
            startPoint,
            endPoint,
            direction,
            cutCenter,
            segLength,
            diameter: segData.diameter,
            startNodeId: segData.startNodeId,
            endNodeId: segData.endNodeId
        };
    }

    /**
     * Разрезать сегмент на два, учитывая длину арматуры.
     * Возвращает два новых сегмента и позицию для арматуры.
     */
    // modules/armature.js

splitSegment(cutInfo, armatureLength) {
    const { startPoint, endPoint, direction, cutCenter, diameter, startNodeId, endNodeId } = cutInfo;
    const halfLength = armatureLength / 2;

    const armStart = cutCenter.clone().sub(direction.clone().multiplyScalar(halfLength));
    const armEnd = cutCenter.clone().add(direction.clone().multiplyScalar(halfLength));

    // Создаем новые сегменты
    const newSeg1 = {
        start: startPoint.clone(),
        end: armStart.clone(),
        startPos: { x: startPoint.x, y: startPoint.y, z: startPoint.z },
        endPos: { x: armStart.x, y: armStart.y, z: armStart.z },
        diameter,
        startNodeId,
        endNodeId: genNodeId(),  // Новый узел для конца первого сегмента
        length: startPoint.distanceTo(armStart)
    };

    const newSeg2 = {
        start: armEnd.clone(),
        end: endPoint.clone(),
        startPos: { x: armEnd.x, y: armEnd.y, z: armEnd.z },
        endPos: { x: endPoint.x, y: endPoint.y, z: endPoint.z },
        diameter,
        startNodeId: genNodeId(),  // Новый узел для начала второго сегмента
        endNodeId,
        length: armEnd.distanceTo(endPoint)
    };

    return {
        newSeg1,
        newSeg2,
        armaturePosition: cutCenter.clone(),
        armatureDirection: direction.clone()
    };
}

    // ============================================
    // ШАГ 2: ОБНОВЛЕНИЕ ИНДЕКСОВ И ВИЗУАЛА
    // ============================================
    
    /**
     * Заменить сегмент в массиве и пересоздать визуальную модель трубопровода.
     * Обновляет индексы всех сегментов.
     */
    rebuildPipeline(pipeline, segIndex, newSeg1, newSeg2) {
        const allSegs = [...pipeline.userData.segments];
        allSegs.splice(segIndex, 1, newSeg1, newSeg2);

        const segsForFactory = allSegs.map(s => ({
            start: new THREE.Vector3(s.startPos.x, s.startPos.y, s.startPos.z),
            end: new THREE.Vector3(s.endPos.x, s.endPos.y, s.endPos.z),
            diameter: s.diameter,
            startNodeId: s.startNodeId,
            endNodeId: s.endNodeId
        }));

        const newPipelineRoot = Factory.createPipeline(segsForFactory, pipeline.id);
        if (!newPipelineRoot) return false;

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

        // Обновляем индексы сегментов (Factory сам расставляет index: 0, 1, 2...)
        // Но нужно обновить userData.segments, чтобы индексы совпадали
        this._syncSegmentIndices(pipeline);

        return true;
    }

    /**
     * Синхронизировать индексы сегментов с визуальной моделью
     */
    _syncSegmentIndices(pipeline) {
        pipeline.root.children.forEach(child => {
            if (child.userData.type === 'pipeSegment') {
                const idx = child.userData.index;
                if (pipeline.userData.segments[idx]) {
                    pipeline.userData.segments[idx]._meshIndex = idx;
                }
            }
        });
    }

    // ============================================
    // ШАГ 3: СОЗДАНИЕ И ДОБАВЛЕНИЕ АРМАТУРЫ
    // ============================================
    
    /**
     * Создать 3D-модель арматуры и добавить в сцену
     */
    createArmatureMesh(armatureType, diameter, position, direction, pipeline) {
        const config = this.types[armatureType];
        if (!config) return null;

        STATE.objectCounter++;
        STATE.valveCounter++;

        const armature = Factory.createControlValve(config.length, diameter, STATE.objectCounter);

        // Переводим позицию из локальных координат трубопровода в мировые
        const worldPos = position.clone();
        pipeline.root.localToWorld(worldPos);
        armature.position.copy(worldPos);

        // Поворот по направлению трубы в мировых координатах
        const worldDir = direction.clone();
        worldDir.applyQuaternion(pipeline.root.quaternion);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(1, 0, 0),
            worldDir
        );
        armature.quaternion.copy(quaternion);

        armature.userData.number = STATE.valveCounter;
        armature.userData.armatureType = armatureType;

        Engine.scene.add(armature);

        STATE.objects.push({
            id: STATE.objectCounter,
            type: 'control_valve',
            root: armature,
            userData: {
                ...armature.userData,
                number: STATE.valveCounter,
                armatureType,
                name: config.name
            }
        });

        return armature;
    }

    // ============================================
    // ГЛАВНЫЙ МЕТОД: КОМБИНИРУЕТ ВСЕ ШАГИ
    // ============================================
    
    /**
     * Полный процесс вставки арматуры:
     * 1. Вырезать сегмент
     * 2. Разделить на два
     * 3. Пересоздать трубопровод
     * 4. Добавить арматуру
     */
    insertAt(armatureType, segHit) {
        const config = this.types[armatureType];
        if (!config) {
            Utils.showStatus('Неизвестный тип арматуры');
            return false;
        }

        const seg = segHit.object;
        const pipelineId = seg.userData.pipelineId;
        const segIndex = seg.userData.index;
        const pipeline = STATE.objects.find(o => o.id === pipelineId);

        if (!pipeline || !pipeline.userData.segments[segIndex]) {
            Utils.showStatus('Кликните по участку трубопровода!');
            return false;
        }

        // ШАГ 1: Вырезаем
        const cutInfo = this.cutSegment(pipeline, segIndex, segHit);
        if (!cutInfo) return false;

        // ШАГ 2: Разделяем сегмент
        const { newSeg1, newSeg2, armaturePosition, armatureDirection } = 
            this.splitSegment(cutInfo, config.length);

        // ШАГ 3: Пересоздаем трубопровод (обновляем индексы)
        if (!this.rebuildPipeline(pipeline, segIndex, newSeg1, newSeg2)) {
            Utils.showStatus('Ошибка при пересоздании трубопровода');
            return false;
        }

        // ШАГ 4: Создаем и добавляем арматуру
        const armature = this.createArmatureMesh(
            armatureType,
            cutInfo.diameter,
            armaturePosition,
            armatureDirection,
            pipeline
        );

        if (!armature) return false;

        Tree.update();
        Utils.showStatus(`✓ ${config.name} №${STATE.valveCounter} вставлен`);

        return true;
    }

    // ============================================
    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ============================================
    
    getAvailableTypes() {
        return Object.keys(this.types);
    }

    getTypeInfo(armatureType) {
        return this.types[armatureType] || null;
    }
}