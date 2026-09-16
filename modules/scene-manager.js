// modules/scene-manager.js
class SceneManager {
    resetView() {
        Engine.camera.position.set(20, 25, 30);
        Engine.controls.target.set(0, 5, 0);
        Engine.controls.update();
    }

    topView() {
        Engine.camera.position.set(0, 50, 0);
        Engine.controls.target.set(0, 5, 0);
        Engine.controls.update();
    }

    setView(direction) {
        const c = Engine.controls.target.clone();
        const d = 30;
        const positions = {
            top: [c.x, c.y + d, c.z],
            bottom: [c.x, c.y - d, c.z],
            front: [c.x, c.y, c.z + d],
            back: [c.x, c.y, c.z - d],
            left: [c.x - d, c.y, c.z],
            right: [c.x + d, c.y, c.z]
        };
        if (positions[direction]) {
            Engine.camera.position.set(...positions[direction]);
            Engine.controls.update();
        }
    }

    toggleGrid() {
        STATE.showGrid = !STATE.showGrid;
        if (STATE.meshes.grid) {
            STATE.meshes.grid.visible = STATE.showGrid;
        }
        this._updateButtonLabels();
    }

    toggleCameraMode() {
        const isOrtho = Engine.camera.type === 'OrthographicCamera';
        const p = Engine.camera.position.clone();
        const t = Engine.controls.target.clone();
        const dom = Engine.renderer.domElement;
        
        Engine.controls.dispose();

        let nc;
        if (isOrtho) {
            nc = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 2000);
        } else {
            const f = 200;
            const a = innerWidth / innerHeight;
            nc = new THREE.OrthographicCamera(-f*a/2, f*a/2, f/2, -f/2, 0.1, 20000);
        }
        
        nc.position.copy(p);
        nc.lookAt(t);
        nc.updateProjectionMatrix();
        
        Engine.camera = nc;
        Engine.controls = new THREE.OrbitControls(nc, dom);
        Engine.controls.target.copy(t);
        Engine.controls.enableDamping = true;
        Engine.controls.dampingFactor = 0.05;
    }

    openSceneSettings() {
        document.getElementById('scenePlaneWidth').value = document.getElementById('planeWidth').value;
        document.getElementById('scenePlaneDepth').value = document.getElementById('planeDepth').value;
        document.getElementById('sceneAxesSize').value = document.getElementById('axesSizeInput').value;
        document.getElementById('sceneSettingsModal').classList.add('active');
    }

    applySceneSettings() {
        World.updateGroundSize(
            document.getElementById('scenePlaneWidth').value,
            document.getElementById('scenePlaneDepth').value
        );
        World.updateAxesSize(document.getElementById('sceneAxesSize').value);
        document.getElementById('sceneSettingsModal').classList.remove('active');
    }

    _updateButtonLabels() {
        const text = `Сетка: ${STATE.showGrid ? 'Вкл' : 'Выкл'}`;
        const btn1 = document.getElementById('menuToggleGrid');
        const btn2 = document.getElementById('toggleGridBtn');
        if (btn1) btn1.textContent = text;
        if (btn2) btn2.textContent = text;
    }
}