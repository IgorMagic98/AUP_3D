// modules/network-graph.js
class NetworkGraph {
    build() {
        const nodes = [];
        const edges = [];
        const nodeMap = {};
        
        // Process pipelines
        STATE.objects.filter(o => o.type === 'pipeline').forEach(pipe => {
            const root = pipe.root;
            root.updateMatrixWorld(true);
            const segs = pipe.userData.segments || [];
            const np = pipe.userData.nodePositions || {};
            
            segs.forEach((seg, i) => {
                [seg.startNodeId, seg.endNodeId].forEach(nid => {
                    if (!nodeMap[nid]) {
                        const lp = np[nid] || { x: 0, y: 0, z: 0 };
                        const wp = new THREE.Vector3(lp.x, lp.y, lp.z).applyMatrix4(root.matrixWorld);
                        const isFirst = pipe.userData.segments[0].startNodeId === nid;
                        
                        nodes.push({
                            id: nid,
                            type: isFirst ? 'source' : 'connectionPoint',
                            objectType: 'pipeline',
                            objectId: pipe.id,
                            objectNumber: pipe.userData.number,
                            position: wp,
                            label: `${isFirst ? 'Вход' : 'Узел'} Т${pipe.userData.number || pipe.id} [${nid}]`
                        });
                        nodeMap[nid] = true;
                    }
                });
                
                edges.push({
                    id: seg.id,
                    from: seg.startNodeId,
                    to: seg.endNodeId,
                    type: 'pipe',
                    objectType: 'pipeline',
                    length: seg.length,
                    diameter: seg.diameter,
                    label: `DN${seg.diameter} ${seg.length.toFixed(1)}м`
                });
            });
        });
        
        // Process branches
        STATE.objects.filter(o => o.type === 'branch').forEach(br => {
            const root = br.root;
            root.updateMatrixWorld(true);
            const segs = br.userData.segments || [];
            const np = br.userData.nodePositions || {};
            const anid = br.userData.attachNodeId;
            
            segs.forEach((seg, i) => {
                [seg.startNodeId, seg.endNodeId].forEach(nid => {
                    if (!nodeMap[nid]) {
                        const lp = np[nid] || { x: 0, y: 0, z: 0 };
                        const local = new THREE.Vector3(lp.x, lp.y, lp.z);
                        const wp = local.applyMatrix4(root.matrixWorld);
                        const isAttach = nid === anid;
                        
                        nodes.push({
                            id: nid,
                            type: isAttach ? 'attachNode' : 'sprinkler',
                            objectType: 'branch',
                            objectId: br.id,
                            objectNumber: br.userData.number,
                            position: wp,
                            label: `${isAttach ? 'В' : 'Ор'}${br.userData.number || br.id} [${nid}]`
                        });
                        nodeMap[nid] = true;
                    }
                });
                
                edges.push({
                    id: seg.id,
                    from: seg.startNodeId,
                    to: seg.endNodeId,
                    type: 'pipe',
                    objectType: 'branch',
                    length: seg.length,
                    diameter: seg.diameter,
                    label: `DN${seg.diameter} ${seg.length.toFixed(1)}м`
                });
            });
            
            if (br.userData.connectedTo) {
                const ct = br.userData.connectedTo;
                let tid;
                
                if (ct.targetType === 'pipeline') {
                    tid = ct.nodeIndex === 0 ? `pipe_${ct.targetId}_in` : `pipe_${ct.targetId}_n${ct.nodeIndex}`;
                } else {
                    tid = `${ct.targetType === 'branch' ? 'branch' : 'row'}_${ct.targetId}_attach`;
                }
                
                const realTid = Object.keys(nodeMap).find(k => {
                    const n = nodes.find(x => x.id === k);
                    return n && n.objectId === ct.targetId && 
                           n.type !== 'sprinkler' && 
                           n.position.distanceTo(root.getWorldPosition(new THREE.Vector3())) < 1;
                });
                
                if (realTid || tid) {
                    edges.push({
                        id: `br_conn_${br.id}`,
                        from: realTid || tid,
                        to: anid,
                        type: 'attachment',
                        length: 0,
                        diameter: 0,
                        label: ''
                    });
                }
            }
        });
        
        // Process sprinkler rows
        STATE.objects.filter(o => o.type === 'sprinkler_row').forEach(row => {
            const root = row.root;
            root.updateMatrixWorld(true);
            const np = row.userData.nodePositions || {};
            const anid = row.userData.attachNodeId;
            const allSegs = [...(row.userData.leftSegments || []), ...(row.userData.rightSegments || [])];
            
            allSegs.forEach(seg => {
                [seg.startNodeId, seg.endNodeId].forEach(nid => {
                    if (!nodeMap[nid]) {
                        const lp = np[nid] || { x: 0, y: 0, z: 0 };
                        const wp = new THREE.Vector3(lp.x, lp.y, lp.z).applyMatrix4(root.matrixWorld);
                        
                        nodes.push({
                            id: nid,
                            type: nid === anid ? 'attachNode' : 'sprinkler',
                            objectType: 'sprinkler_row',
                            objectId: row.id,
                            objectNumber: row.userData.number,
                            position: wp,
                            label: `Р${row.userData.number || row.id} [${nid}]`
                        });
                        nodeMap[nid] = true;
                    }
                });
                
                edges.push({
                    id: seg.id,
                    from: seg.startNodeId,
                    to: seg.endNodeId,
                    type: 'pipe',
                    objectType: 'sprinkler_row',
                    length: seg.length,
                    diameter: seg.diameter,
                    label: `DN${seg.diameter} ${seg.length.toFixed(1)}м`
                });
            });
            
            if (row.userData.connectedTo) {
                const ct = row.userData.connectedTo;
                const realTid = Object.keys(nodeMap).find(k => {
                    const n = nodes.find(x => x.id === k);
                    return n && n.objectId === ct.targetId;
                });
                
                if (realTid) {
                    edges.push({
                        id: `row_conn_${row.id}`,
                        from: realTid,
                        to: anid,
                        type: 'attachment',
                        length: 0,
                        diameter: 0,
                        label: '🔗'
                    });
                }
            }
        });
        
        // Process control valves
        STATE.objects.filter(o => o.type === 'control_valve').forEach(valve => {
            const root = valve.root;
            root.updateMatrixWorld(true);
            const np = valve.userData.nodePositions || {};
            
            Object.keys(np).forEach(nid => {
                if (!nodeMap[nid]) {
                    const lp = np[nid];
                    const wp = new THREE.Vector3(lp.x, lp.y, lp.z).applyMatrix4(root.matrixWorld);
                    
                    nodes.push({
                        id: nid,
                        type: 'valveConnection',
                        objectType: 'control_valve',
                        objectId: valve.id,
                        objectNumber: valve.userData.number,
                        position: wp,
                        label: `УУ${valve.userData.number || valve.id} [${nid}]`
                    });
                    nodeMap[nid] = true;
                }
            });
        });
        
        // Auto-detect connections
        const connNodes = nodes.filter(n => 
            n.type === 'source' || n.type === 'connectionPoint' || 
            n.type === 'attachNode' || n.type === 'valveConnection'
        );
        
        const ac = [];
        const processed = new Set();
        
        for (let i = 0; i < connNodes.length; i++) {
            for (let j = i + 1; j < connNodes.length; j++) {
                const a = connNodes[i], b = connNodes[j];
                if (a.objectId === b.objectId) continue;
                
                const d = (a.position && b.position) ? a.position.distanceTo(b.position) : 0;
                if (d <= 0.1) {
                    const k = `${a.id}-${b.id}`;
                    if (!processed.has(k)) {
                        processed.add(k);
                        ac.push({ nodeA: a, nodeB: b, distance: d });
                    }
                }
            }
        }
        
        const ek = new Set(edges.map(e => `${e.from}-${e.to}`));
        
        ac.forEach((c, i) => {
            const k1 = `${c.nodeA.id}-${c.nodeB.id}`;
            const k2 = `${c.nodeB.id}-${c.nodeA.id}`;
            
            if (!ek.has(k1) && !ek.has(k2)) {
                edges.push({
                    id: `auto_${i}`,
                    from: c.nodeA.id,
                    to: c.nodeB.id,
                    type: 'auto_connection',
                    length: c.distance,
                    diameter: 0,
                    label: `${c.distance.toFixed(2)}м`
                });
                ek.add(k1);
            }
        });
        
        return { nodes, edges };
    }

    show() {
        const g = this.build();
        this._currentGraph = g;
        
        document.getElementById('graphNodeCount').textContent = g.nodes.length;
        document.getElementById('graphEdgeCount').textContent = g.edges.length;
        
        if (!g.nodes.length) {
            document.getElementById('graphGroup').innerHTML = 
                '<text x="50%" y="50%" text-anchor="middle" fill="#999">Нет объектов</text>';
        } else {
            this._layoutGraph(g.nodes, g.edges);
            this._renderGraphSvg(g);
        }
        
        this._renderGraphTables(g);
        
        document.getElementById('graphJsonOutput').value = JSON.stringify({
            version: '2.0-segments',
            generated: new Date().toISOString(),
            nodes: g.nodes.map(n => ({
                id: n.id,
                type: n.type,
                position: {
                    x: +n.position.x.toFixed(3),
                    y: +n.position.y.toFixed(3),
                    z: +n.position.z.toFixed(3)
                }
            })),
            edges: g.edges.map(e => ({
                from: e.from,
                to: e.to,
                type: e.type,
                length: e.length,
                diameter: e.diameter
            }))
        }, null, 2);
        
        this._switchGraphTab('Schema');
        STATE.graphView.scale = 1;
        STATE.graphView.panX = 0;
        STATE.graphView.panY = 0;
        this._graphApplyTransform();
        
        document.getElementById('networkGraphModal').classList.add('active');
    }

    _layoutGraph(nodes, edges) {
        if (!nodes.length) return;
        
        nodes.forEach(n => {
            n.x = n.position.x * 10;
            n.y = -n.position.z * 10;
            n.vx = 0;
            n.vy = 0;
        });
        
        for (let it = 0; it < 50; it++) {
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const dx = nodes[j].x - nodes[i].x;
                    const dy = nodes[j].y - nodes[i].y;
                    const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
                    const f = 500 / (d * d);
                    
                    nodes[i].vx -= (dx / d) * f;
                    nodes[i].vy -= (dy / d) * f;
                    nodes[j].vx += (dx / d) * f;
                    nodes[j].vy += (dy / d) * f;
                }
            }
            
            edges.forEach(e => {
                const a = nodes.find(n => n.id === e.from);
                const b = nodes.find(n => n.id === e.to);
                if (!a || !b) return;
                
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                const id2 = (e.type === 'attachment' || e.type === 'auto_connection') ? 80 : 40;
                const f = (d - id2) * 0.01;
                
                a.vx += (dx / Math.max(d, 1)) * f;
                a.vy += (dy / Math.max(d, 1)) * f;
                b.vx -= (dx / Math.max(d, 1)) * f;
                b.vy -= (dy / Math.max(d, 1)) * f;
            });
            
            nodes.forEach(n => {
                n.x += n.vx;
                n.y += n.vy;
                n.vx *= 0.85;
                n.vy *= 0.85;
            });
        }
    }

    _renderGraphSvg(g) {
        const svg = document.getElementById('graphSvg');
        const rect = svg.getBoundingClientRect();
        const W = rect.width || 800;
        const H = rect.height || 500;
        
        let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
        
        g.nodes.forEach(n => {
            mnX = Math.min(mnX, n.x);
            mxX = Math.max(mxX, n.x);
            mnY = Math.min(mnY, n.y);
            mxY = Math.max(mxY, n.y);
        });
        
        const p = 60;
        const rX = Math.max(mxX - mnX, 1);
        const rY = Math.max(mxY - mnY, 1);
        const sc = Math.min((W - p * 2) / rX, (H - p * 2) / rY);
        const oX = (W - rX * sc) / 2 - mnX * sc;
        const oY = (H - rY * sc) / 2 - mnY * sc;
        
        const tx = n => n.x * sc + oX;
        const ty = n => n.y * sc + oY;
        
        let h = '';
        
        g.edges.forEach(e => {
            const a = g.nodes.find(n => n.id === e.from);
            const b = g.nodes.find(n => n.id === e.to);
            if (!a || !b) return;
            
            let c = e.type === 'attachment' ? '#ff6b6b' :
                    e.type === 'auto_connection' ? '#ff9800' :
                    e.objectType === 'pipeline' ? '#1a80cc' :
                    e.objectType === 'branch' ? '#1a991a' :
                    e.objectType === 'control_valve' ? '#cc6600' : '#cc6600';
            
            let cl = 'edge-line';
            if (e.type === 'attachment') cl += ' attachment';
            if (e.type === 'auto_connection') cl += ' auto-connection';
            
            h += `<line class="${cl}" x1="${tx(a)}" y1="${ty(a)}" x2="${tx(b)}" y2="${ty(b)}" stroke="${c}"/>`;
            
            if (e.type !== 'attachment' && e.type !== 'auto_connection') {
                h += `<text class="edge-label" x="${(tx(a) + tx(b)) / 2}" y="${(ty(a) + ty(b)) / 2 - 3}" 
                      text-anchor="middle">${e.label}</text>`;
            }
        });
        
        g.nodes.forEach(n => {
            let c = n.type === 'source' ? '#d32f2f' :
                    n.type === 'connectionPoint' ? '#1a80cc' :
                    n.type === 'attachNode' ? '#e6991a' :
                    n.type === 'valveConnection' ? '#cc6600' : '#666';
            
            const r = n.type === 'attachNode' ? 8 :
                      n.type === 'connectionPoint' ? 6 :
                      n.type === 'source' ? 10 :
                      n.type === 'valveConnection' ? 7 : 4;
            
            h += `<circle class="node-circle" cx="${tx(n)}" cy="${ty(n)}" r="${r}" fill="${c}" 
                  stroke="white" stroke-width="1.5" data-node-id="${n.id}">
                  <title>${n.label}</title></circle>`;
            
            h += `<text class="node-label" x="${tx(n)}" y="${ty(n) - r - 4}" text-anchor="middle">${n.id}</text>`;
        });
        
        document.getElementById('graphGroup').innerHTML = h;
        
        document.querySelectorAll('.node-circle').forEach(ci => {
            ci.addEventListener('click', () => {
                const n = g.nodes.find(x => x.id === ci.dataset.nodeId);
                if (n) {
                    const o = STATE.objects.find(x => x.id === n.objectId);
                    if (o) {
                        VisualEffects.focusObject(o);
                        this.close();
                    }
                }
            });
        });
    }

    _renderGraphTables(g) {
        document.querySelector('#graphNodesTable tbody').innerHTML = g.nodes.map(n => 
            `<tr>
                <td style="padding:4px;border-bottom:1px solid #eee">${n.id}</td>
                <td>${n.type}</td>
                <td>(${n.position.x.toFixed(1)},${n.position.y.toFixed(1)},${n.position.z.toFixed(1)})</td>
            </tr>`
        ).join('');
        
        document.querySelector('#graphEdgesTable tbody').innerHTML = g.edges.map(e => 
            `<tr>
                <td style="padding:4px;border-bottom:1px solid #eee">${e.from}</td>
                <td>${e.to}</td>
                <td>${e.type}</td>
                <td>${e.label || ''}</td>
            </tr>`
        ).join('');
    }

    _switchGraphTab(t) {
        document.querySelectorAll('#networkGraphModal .graph-tab').forEach(x => x.classList.remove('active'));
        document.querySelectorAll('#networkGraphModal .graph-view').forEach(x => x.classList.remove('active'));
        document.getElementById(`graphTab${t}`).classList.add('active');
        document.getElementById(`graph${t}View`).classList.add('active');
    }

    _graphApplyTransform() {
        const g = document.getElementById('graphGroup');
        if (!g) return;
        
        g.style.transform = `translate(${STATE.graphView.panX}px,${STATE.graphView.panY}px) scale(${STATE.graphView.scale})`;
        g.style.transformOrigin = '0 0';
        document.getElementById('graphZoomLevel').textContent = Math.round(STATE.graphView.scale * 100) + '%';
    }

    _graphZoomBy(f) {
        const r = document.getElementById('graphSvg').getBoundingClientRect();
        this._graphZoomAt(r.width / 2, r.height / 2, f);
    }

    _graphZoomAt(mx, my, f) {
        const gv = STATE.graphView;
        const ns = Math.max(gv.minScale, Math.min(gv.maxScale, gv.scale * f));
        const af = ns / gv.scale;
        
        gv.panX = mx - (mx - gv.panX) * af;
        gv.panY = my - (my - gv.panY) * af;
        gv.scale = ns;
        
        this._graphApplyTransform();
    }

    _graphFitView() {
        if (!this._currentGraph) return;
        
        const r = document.getElementById('graphSvg').getBoundingClientRect();
        const W = r.width || 800;
        const H = r.height || 500;
        
        let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
        
        this._currentGraph.nodes.forEach(n => {
            mnX = Math.min(mnX, n.x);
            mxX = Math.max(mxX, n.x);
            mnY = Math.min(mnY, n.y);
            mxY = Math.max(mxY, n.y);
        });
        
        const p = 80;
        const sc = Math.min((W - p * 2) / Math.max(mxX - mnX, 1), (H - p * 2) / Math.max(mxY - mnY, 1));
        
        STATE.graphView.scale = sc;
        STATE.graphView.panX = (W - (mxX - mnX) * sc) / 2 - mnX * sc;
        STATE.graphView.panY = (H - (mxY - mnY) * sc) / 2 - mnY * sc;
        
        this._graphApplyTransform();
    }

    close() {
        document.getElementById('networkGraphModal').classList.remove('active');
        this._currentGraph = null;
    }

    downloadJson() {
        const v = document.getElementById('graphJsonOutput').value;
        if (!v) return;
        
        const b = new Blob([v], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = 'graph_data.json';
        a.click();
    }

    showAutoConnections() {
        const g = this.build();
        const ac = g.edges.filter(e => e.type === 'auto_connection');
        
        if (!ac.length) {
            Utils.showStatus('Авто-связей нет');
            return;
        }
        
        Utils.showStatus(`Найдено ${ac.length} авто-связей`);
    }
}