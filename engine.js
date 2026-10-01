// ============================================================
// engine.js — инициализация 3D-сцены Three.js
// Зависимости: THREE (глобальный), подключается ПОСЛЕ state.js
// ============================================================

const Engine = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    raycaster: null,
    selectedObject: null,
    mouse: new THREE.Vector2(),

    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf5f6fa);

        this.camera = new THREE.PerspectiveCamera(
            60,
            innerWidth / innerHeight,
            0.01,
            1000
        );
        this.camera.position.set(20, 25, 30);

        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('renderCanvas'),
            antialias: true
        });
        this.renderer.setSize(innerWidth, innerHeight);
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

        this.controls = new THREE.OrbitControls(
            this.camera,
            this.renderer.domElement
        );
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 1;
        this.controls.maxDistance = 500;
        this.controls.maxPolarAngle = Math.PI / 2.1;

        this.raycaster = new THREE.Raycaster();

        // Освещение
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x888899, 0.7));
        const dl = new THREE.DirectionalLight(0xffffff, 0.6);
        dl.position.set(20, 30, 20);
        this.scene.add(dl);

        addEventListener('resize', () => this.onResize());

        this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        this.renderer.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
    },

    // 2. ИСПРАВЛЕННЫЙ МЕТОД НАВЕДЕНИЯ МЫШИ
    onPointerMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        // ТЕПЕРЬ ИСПОЛЬЗУЕМ ФИЛЬТР:
        const validObject = this.checkValidIntersection(intersects);

        if (validObject) {
            this.renderer.domElement.style.cursor = 'pointer'; // Рука
        } else {
            this.renderer.domElement.style.cursor = 'default'; // Стрелка
        }
    },


    

     // 3. ИСПРАВЛЕННЫЙ МЕТОД КЛИКА МЫШИ
    onPointerDown(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        // ТЕПЕРЬ ВЫДЕЛЯЕМ ЧЕРЕЗ ФИЛЬТР ГРУПП:
        const hitTarget = this.checkValidIntersection(intersects);

        if (hitTarget) {
            // Сброс старого выделения (сработает для всей прошлой группы)
            if (this.selectedObject && this.selectedObject !== hitTarget) {
                this.deselectObject(this.selectedObject);
            }

            // Запоминаем и подсвечиваем НОВУЮ ГРУППУ целиком
            this.selectedObject = hitTarget;
            this.selectObject(hitTarget);

        } else {
            // Клик в пустоту — снимаем выделение
            if (this.selectedObject) {
                this.deselectObject(this.selectedObject);
                this.selectedObject = null;
            }
        }
    },

    // Метод для выделения объекта (например, подсветим его красным)
    selectObject(object) {
        // Если это группа элементов
        if (object.isGroup) {
            object.traverse((child) => {
                if (child.isMesh && child.material) {
                    // Сохраняем родной цвет каждого меша, если еще не сохранили
                    if (!child.userData.originalColor) {
                        child.userData.originalColor = child.material.color.getHex();
                    }
                    child.material.color.setHex(0xff0000); // Красим всю группу в красный
                }
            });
        } 
        // Если это одиночный меш (на случай, если кликнули не по трубе)
        else if (object.isMesh && object.material) {
            if (!object.userData.originalColor) {
                object.userData.originalColor = object.material.color.getHex();
            }
            object.material.color.setHex(0xff0000);
        }
    },

    // Метод для снятия выделения
    deselectObject(object) {
        if (object.isGroup) {
            object.traverse((child) => {
                if (child.isMesh && child.material && child.userData.originalColor !== undefined) {
                    child.material.color.setHex(child.userData.originalColor); // Возвращаем исходный цвет
                }
            });
        } else if (object.isMesh && object.material && object.userData.originalColor !== undefined) {
            object.material.color.setHex(object.userData.originalColor);
        }
    },

    // Вспомогательный метод для фильтрации объектов внутри Engine
    checkValidIntersection(intersects) {
        if (intersects.length === 0) return null;

        for (let i = 0; i < intersects.length; i++) {
            let hitObject = intersects[i].object;

            // Игнорируем свет и вспомогательную сетку
            if (hitObject.isGridHelper || hitObject.isLight) continue;

            // Поднимаемся вверх по родителям в поисках группы с именем "group"
            while (hitObject && !hitObject.isScene) {
                if (hitObject.name === "group") {
                    return hitObject; // Нашли! Возвращаем всю группу целиком
                }
                if (hitObject.parent && hitObject.parent.name === "group") {
                    return hitObject.parent; // Тоже нашли (прямой родитель — группа)
                }
                hitObject = hitObject.parent; // Идем выше на один уровень
            }

            // Если объект не в группе, возвращаем сам меш
            return intersects[i].object; 
        }
        return null;
    },

    // Метод адаптивности экрана
    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    },



    onResize() {
        const a = innerWidth / innerHeight;
        if (Engine.camera.type === 'PerspectiveCamera') {
            Engine.camera.aspect = a;
        } else {
            const f = 200;
            Engine.camera.left = -f * a / 2;
            Engine.camera.right = f * a / 2;
            Engine.camera.top = f / 2;
            Engine.camera.bottom = -f / 2;
        }
        Engine.camera.updateProjectionMatrix();
        Engine.renderer.setSize(innerWidth, innerHeight);
    },

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
};