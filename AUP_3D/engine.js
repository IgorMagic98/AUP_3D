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

    // Вспомогательный метод для перевода пикселей экрана в 3D-координаты [-1, 1]
    updateMouseCoordinates(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    },

    // 1. НАВЕДЕНИЕ МЫШИ (только на конкретный Меш)
    onPointerMove(event) {
        this.updateMouseCoordinates(event);

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        // Ищем самый первый попавшийся валидный Mesh (игнорируя свет и сетку)
        const hitMesh = this.findValidMesh(intersects);

        // Меняем курсор
        if (hitMesh) {
            this.renderer.domElement.style.cursor = 'pointer'; // Рука
        } else {
            this.renderer.domElement.style.cursor = 'default'; // Стрелка
        }
    },

    // 2. КЛИК МЫШИ (выделение конкретного Меша)
    onPointerDown(event) {
        this.updateMouseCoordinates(event);

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        const hitMesh = this.findValidMesh(intersects);

        if (hitMesh) {
            // Если кликнули по новому объекту — сбрасываем старый
            if (this.selectedObject && this.selectedObject !== hitMesh) {
                this.deselectObject(this.selectedObject);
            }

            // Запоминаем и выделяем конкретный нажатый узел
            this.selectedObject = hitMesh;
            this.selectObject(hitMesh);
        } else {
            // Клик в пустоту — сброс
            if (this.selectedObject) {
                this.deselectObject(this.selectedObject);
                this.selectedObject = null;
            }
        }
    },

    // 3. ФИЛЬТР: Находит первый THREE.Mesh в массиве пересечений
    findValidMesh(intersects) {
        if (intersects.length === 0) return null;

        for (let i = 0; i < intersects.length; i++) {
            const obj = intersects[i].object;

            // Игнорируем технические объекты и свет, ищем строго геометрию (Mesh)
            if (!obj.isGridHelper && !obj.isLight && obj.isMesh) {
                return obj; // Возвращаем конкретный узел/меш
            }
        }
        return null;
    },

    // 4. ВЫДЕЛЕНИЕ ОДНОГО МЕША
    selectObject(mesh) {
        if (!mesh || !mesh.material) return;

        // Если цвет еще не сохраняли
        if (!mesh.userData.originalColor) {
            // Клонируем материал, чтобы изменение цвета не затронуло другие такие же меши на сцене
            mesh.material = mesh.material.clone();
            // Запоминаем родной цвет
            mesh.userData.originalColor = mesh.material.color.getHex();
        }

        mesh.material.color.setHex(0xff0000); // Красим строго этот меш в красный
    },

    // 5. СНЯТИЕ ВЫДЕЛЕНИЯ С ОДНОГО МЕША
    deselectObject(mesh) {
        if (!mesh || !mesh.material) return;

        if (mesh.userData.originalColor !== undefined) {
            mesh.material.color.setHex(mesh.userData.originalColor); // Возвращаем родной цвет
        }
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