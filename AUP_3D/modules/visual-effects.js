// modules/visual-effects.js
class VisualEffects {
    toggleDiameters() {
        STATE.showRealDiameters = !STATE.showRealDiameters;
        this.updatePipeThickness();
        
        const text = `Диаметры: ${STATE.showRealDiameters ? 'Вкл' : 'Выкл'}`;
        
        ['menuToggleDiameters', 'toggleDiametersBtn'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.textContent = text;
        });
        
        Utils.showStatus(`Режим диаметров: ${text}`);
    }

    updatePipeThickness() {
        const thinRadius = 0.015;
        
        STATE.objects.forEach(obj => {
            obj.root.traverse(child => {
                if (!child.isMesh || !child.userData) return;
                
                const types = ['pipeSegment', 'branchSegment', 'rowSegment', 'valveSegment'];
                if (!types.includes(child.userData.type)) return;
                
                const diam = child.userData.diameter || 50;
                const actualRadius = diam / 2000;
                const targetScale = STATE.showRealDiameters ? 1.0 : Math.max(thinRadius / actualRadius, 0.1);
                
                child.scale.set(targetScale, 1, targetScale);
            });
        });
    }

    toggleConnectionPoints() {
        STATE.showConnectionPoints = !STATE.showConnectionPoints;
        
        STATE.objects.forEach(obj => {
            obj.root.traverse(child => {
                if (child.userData && ['connectionPoint', 'attachNode'].includes(child.userData.type)) {
                    child.visible = STATE.showConnectionPoints;
                }
            });
        });
        
        const text = `Узлы: ${STATE.showConnectionPoints ? 'Вкл' : 'Выкл'}`;
        
        ['menuToggleConnectionPoints', 'toggleConnectionPointsBtn'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.textContent = text;
        });
        
        Utils.showStatus(`Присоединительные узлы: ${STATE.showConnectionPoints ? 'показаны' : 'скрыты'}`);
    }

    highlightEntireObject(obj) {
        this.unhighlightAll();
        
        if (!obj?.root) return;
        
        obj.root.traverse(c => {
            if (c.isMesh && c.material) {
                STATE.highlightedObjects.push({
                    mesh: c,
                    oe: c.material.emissive ? c.material.emissive.getHex() : 0,
                    oi: c.material.emissiveIntensity || 0
                });
                
                if (c.material.emissive) {
                    c.material.emissive.setHex(0xffcc00);
                    c.material.emissiveIntensity = 0.6;
                }
            }
        });
    }

    highlightSingleMesh(mesh) {
        this.unhighlightAll();
        
        if (!mesh?.isMesh || !mesh.material) return;
        
        STATE.highlightedObjects.push({
            mesh,
            oe: mesh.material.emissive ? mesh.material.emissive.getHex() : 0,
            oi: mesh.material.emissiveIntensity || 0
        });
        
        if (mesh.material.emissive) {
            mesh.material.emissive.setHex(0xffcc00);
            mesh.material.emissiveIntensity = 0.8;
        }
    }

    unhighlightAll() {
        STATE.highlightedObjects.forEach(i => {
            if (i.mesh?.material?.emissive) {
                i.mesh.material.emissive.setHex(i.oe);
                i.mesh.material.emissiveIntensity = i.oi;
            }
        });
        STATE.highlightedObjects = [];
    }

    focusObject(obj) {
        if (!obj?.root) return;
        
        const box = new THREE.Box3().setFromObject(obj.root);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        Engine.controls.target.copy(center);
        Engine.camera.position.set(
            center.x + Math.max(size.x, size.z) * 2,
            center.y + size.y * 1.5,
            center.z + Math.max(size.x, size.z) * 2
        );
        Engine.controls.update();
    }
}