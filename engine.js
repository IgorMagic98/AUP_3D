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