// ============================================================
// world.js — управление сценой (основание, сетка, оси)
// Зависимости: Utils, STATE, Engine, CONFIG, AXES_SETTINGS, Factory
// ============================================================

const World = {
    updateGroundSize(w, d) {
        w = Utils.clamp(parseFloat(w) || 10, 2, 200);
        d = Utils.clamp(parseFloat(d) || 10, 2, 200);
        document.getElementById('planeWidth').value = w;
        document.getElementById('planeDepth').value = d;
        
        ['ground', 'grid', 'axes'].forEach(k => {
            if (STATE.meshes[k]) {
                Engine.scene.remove(STATE.meshes[k]);
                if (STATE.meshes[k].geometry) STATE.meshes[k].geometry.dispose();
            }
        });

        STATE.meshes.ground = new THREE.Mesh(
            new THREE.PlaneGeometry(w, d),
            new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.GROUND, side: THREE.DoubleSide })
        );
        STATE.meshes.ground.rotation.x = -Math.PI / 2;
        Engine.scene.add(STATE.meshes.ground);

        const mx = Math.max(w, d);
        STATE.meshes.grid = new THREE.GridHelper(mx, mx, CONFIG.COLORS.GRID, CONFIG.COLORS.GRID);
        STATE.meshes.grid.position.y = .01;
        STATE.meshes.grid.visible = STATE.showGrid;
        Engine.scene.add(STATE.meshes.grid);

        let as = AXES_SETTINGS.FIXED_SIZE;
        if (AXES_SETTINGS.AUTO_SIZE.ENABLED) {
            as = Utils.clamp(
                Math.min(w, d) * AXES_SETTINGS.AUTO_SIZE.RELATIVE_RATIO,
                AXES_SETTINGS.AUTO_SIZE.MIN_SIZE,
                AXES_SETTINGS.AUTO_SIZE.MAX_SIZE
            );
        }
        document.getElementById('axesSizeInput').value = as;
        STATE.meshes.axes = Factory.createCustomAxes(as);
        STATE.meshes.axes.position.set(0, AXES_SETTINGS.HEIGHT_OFFSET, 0);
        Engine.scene.add(STATE.meshes.axes);
    },

    updateAxesSize(s) {
        s = Utils.clamp(parseFloat(s) || 2, .1, 100);
        if (STATE.meshes.axes) Engine.scene.remove(STATE.meshes.axes);
        STATE.meshes.axes = Factory.createCustomAxes(s);
        STATE.meshes.axes.position.set(0, AXES_SETTINGS.HEIGHT_OFFSET, 0);
        Engine.scene.add(STATE.meshes.axes);
        AXES_SETTINGS.AUTO_SIZE.ENABLED = false;
        AXES_SETTINGS.FIXED_SIZE = s;
        document.getElementById('axesSizeInput').value = s;
    }
};