// ============================================================
// tree.js — Дерево объектов в интерфейсе (UI)
// Зависимости: STATE, UI, Engine
// ============================================================

const Tree = {
    container: null,
    
    init() {
        this.container = document.getElementById('treeContainer');
    },

    update() {
        document.getElementById('objectCount').textContent = STATE.objects.length;
        this.container.innerHTML = '';
        if (!STATE.objects.length) {
            this.container.innerHTML = '<div class="tree-empty">Сцена пуста.</div>';
            return;
        }
        const f = {
            pipeline: { name: 'Трубопроводы', icon: '▼', objects: [] },
            branch: { name: 'Ветки', icon: '▼', objects: [] },
            sprinkler_row: { name: 'Рядки', icon: '▼', objects: [] },
            control_valve: { name: 'Узлы управления', icon: '▼', objects: [] }
        };
        STATE.objects.forEach(o => { if (f[o.type]) f[o.type].objects.push(o) });
        Object.keys(f).forEach(t => {
            const fo = f[t];
            if (fo.objects.length > 0) {
                const fn = this.createFolderNode(t, fo);
                this.container.appendChild(fn);
            }
        });
    },

    createFolderNode(t, fo) {
        const d = document.createElement('div');
        d.className = 'tree-folder';
        const h = document.createElement('div');
        h.className = 'tree-folder-header';
        h.innerHTML = `<span class="folder-icon">${fo.icon}</span><span>${fo.name}</span><span class="folder-count">${fo.objects.length}</span>`;
        const c = document.createElement('div');
        c.className = 'tree-folder-children';
        fo.objects.forEach(o => c.appendChild(this.createRootNode(o)));
        d.appendChild(h);
        d.appendChild(c);
        if (STATE.expandedFolders.has(t)) c.classList.add('expanded');
        h.addEventListener('click', () => {
            if (c.classList.contains('expanded')) {
                c.classList.remove('expanded');
                STATE.expandedFolders.delete(t);
            } else {
                c.classList.add('expanded');
                STATE.expandedFolders.add(t);
            }
        });
        return d;
    },

    createRootNode(obj) {
        const t = obj.type;
        const ip = t === 'pipeline';
        const ir = t === 'sprinkler_row';
        const iv = t === 'control_valve';
        const ic = ip ? '<img src="ico/Pipeline.png" class="tree-icon-img">' : ir ? '<img src="ico/Sprinkler.png" class="tree-icon-img">' : iv ? '🔧' : '<img src="ico/Sprinkler.png" class="tree-icon-img">';
        const tn = ip ? 'Трубопровод' : ir ? 'Рядок' : iv ? 'Узел управления' : 'Ветка';
        
        let dns = [];
        if (ip && obj.userData.segments) dns = [...new Set(obj.userData.segments.map(s => s.diameter))];
        else if (ir) dns = [...new Set([...(obj.userData.leftDiameters || []), ...(obj.userData.rightDiameters || [])])];
        else if (obj.userData.segments) dns = [...new Set(obj.userData.segments.map(s => s.diameter))];
        else if (obj.userData.segmentDiameters) dns = [...new Set(obj.userData.segmentDiameters)];
        else if (iv) dns = [obj.userData.diameter];
        const di = dns.join('/') + 'мм';
        
        let ci = '';
        if (obj.userData.connectedTo) {
            const ct = obj.userData.connectedTo;
            ci = ` 🔗${ct.targetId}${ct.autoDetected ? ' ⚡' : ''}`;
        }
        const cm = obj.userData.isClosedLoop ? ' 🔄' : '';
        
        const nd = document.createElement('div');
        nd.className = 'tree-node';
        nd.dataset.id = obj.id;
        const r = document.createElement('div');
        r.className = 'tree-node-row';
        if (STATE.selectedObjectId === obj.id) r.classList.add('selected');
        if (!obj.root.visible) r.classList.add('hidden-node');
        
        r.innerHTML = `<div class="tree-toggle"></div><span class="tree-icon">${ic}</span><span class="tree-label" title="${tn} №${obj.userData.number || obj.id} | ${obj.userData.totalLength?.toFixed(2) || 0}м | ⌀${di}${ci}${cm}">${tn} №${obj.userData.number || obj.id}${cm}</span><div class="tree-actions"><button class="tree-action-btn" data-action="focus" title="Фокус"><img src="ico/focus.png"></button><button class="tree-action-btn" data-action="visibility" title="Видимость"><img src="${obj.root.visible ? 'ico/visibility.png' : 'visibility-off.png'}"></button><button class="tree-action-btn" data-action="duplicate" title="Копировать">📋</button>${ip ? '<button class="tree-action-btn" data-action="split" title="Разбить">✂️</button>' : '<button class="tree-action-btn" data-action="attach" title="Привязать"><img src="ico/attach.png"></button>'}<button class="tree-action-btn" data-action="edit" title="Редактировать"><img src="ico/edit.png"></button><button class="tree-action-btn" data-action="delete" title="Удалить"><img src="ico/delete.png"></button></div>`;
        
        const ch = document.createElement('div');
        ch.className = 'tree-children';
        nd.appendChild(r);
        nd.appendChild(ch);
        
        r.addEventListener('mouseenter', () => {
            if (r.classList.contains('highlighted')) return;
            r.classList.add('highlighted');
            UI.highlightEntireObject(obj);
        });
        r.addEventListener('mouseleave', () => {
            r.classList.remove('highlighted');
            UI.unhighlightAll();
        });
        r.addEventListener('click', e => {
            if (e.target.closest('.tree-action-btn')) return;
            const ex = ch.classList.contains('expanded');
            if (ex) { ch.classList.remove('expanded'); } 
            else { ch.classList.add('expanded'); this.renderChildren(obj, ch); }
            STATE.selectedObjectId = obj.id;
            this.update();
        });
        r.querySelectorAll('.tree-action-btn').forEach(b => b.addEventListener('click', e => {
            e.stopPropagation();
            this.handleAction(b.dataset.action, obj);
        }));
        return nd;
    },

    renderChildren(o, c) {
        c.innerHTML = '';
        let i = 0;
        o.root.traverse(ch => {
            if (ch === o.root) return;
            if (!ch.userData) return;
            if (!ch.userData.elemName && !ch.name) return;
            if (ch.userData.type === 'preview' || ch.userData.type === 'committedPipeSegment' || ch.userData.type === 'committedConnectionPoint' || ch.userData.isHitbox) return;
            
            const n = ch.userData.elemName || ch.name || `Элемент ${i}`;
            const cr = document.createElement('div');
            cr.className = 'tree-child-row';
            if (!ch.visible) cr.classList.add('hidden-node');
            cr.innerHTML = `<span class="tree-child-label">${n}</span><button class="tree-action-btn" data-action="child-visibility">${ch.visible ? '️' : '👁️‍️'}</button>`;
            
            cr.addEventListener('mouseenter', () => {
                cr.classList.add('highlighted');
                UI.highlightSingleMesh(ch);
            });
            cr.addEventListener('mouseleave', () => {
                cr.classList.remove('highlighted');
                UI.unhighlightAll();
            });
            cr.querySelector('[data-action="child-visibility"]').addEventListener('click', e => {
                e.stopPropagation();
                ch.visible = !ch.visible;
                this.update();
            });
            c.appendChild(cr);
            i++;
        });
    },

    handleAction(a, o) {
        switch (a) {
            case 'focus': UI.focusObject(o); break;
            case 'visibility': o.root.visible = !o.root.visible; this.update(); break;
            case 'attach': UI.startAttachMode(o); break;
            case 'duplicate': UI.startDuplicateMode(o); break;
            case 'split': if (o.type === 'pipeline') UI.openSplitPipelineModal(o.id); break;
            case 'edit':
                if (o.type === 'pipeline') UI.openPipelineEditModal(o.id);
                else if (o.type === 'sprinkler_row') UI.openRowEditModal(o.id);
                else if (o.type === 'control_valve') UI.openValveEditModal(o.id);
                else UI.openEditModal(o.id);
                break;
            case 'delete':
                if (confirm(`Удалить №${o.userData.number || o.id}?`)) {
                    Engine.scene.remove(o.root);
                    STATE.objects = STATE.objects.filter(x => x.id !== o.id);
                    this.update();
                }
                break;
        }
    }
};