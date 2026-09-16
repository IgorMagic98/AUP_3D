// ============================================================
// factory.js — Фабрика для создания 3D-объектов (трубы, ветки, рядки, узлы)
// Зависимости: THREE (глобальный), CONFIG, AXES_SETTINGS, genNodeId (из state.js)
// ============================================================

const Factory = {
  createOrientedCylinder(s, e, r, m, n) { 
    const l = s.distanceTo(e); 
    if (l < .001) return null; 
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, CONFIG.QUALITY.PIPE_TESS), m); 
    mesh.name = n; 
    mesh.position.copy(s).lerp(e, .5); 
    const d = new THREE.Vector3().subVectors(e, s).normalize(); 
    const u = new THREE.Vector3(0, 1, 0); 
    if (d.dot(u) > .999) mesh.quaternion.identity(); 
    else if (d.dot(u) < -.999) mesh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI); 
    else mesh.quaternion.setFromUnitVectors(u, d); 
    return mesh 
  },
  createCustomAxes(size) { 
    const g = new THREE.Group(); 
    const o = new THREE.Vector3(0, 0, 0); 
    const hl = size * AXES_SETTINGS.HEAD_LENGTH_RATIO; 
    const hw = hl * AXES_SETTINGS.HEAD_WIDTH_RATIO; 
    const cs = (t, c) => { 
      const cv = document.createElement('canvas'), cx = cv.getContext('2d'); 
      cv.width = 128; cv.height = 128; 
      cx.font = 'Bold 64px Arial'; cx.fillStyle = c; cx.textAlign = 'center'; cx.textBaseline = 'middle'; 
      cx.fillText(t, 64, 64); 
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true })); 
      sp.scale.setScalar(Math.max(1, size * AXES_SETTINGS.LABEL_SIZE_RATIO)); 
      return sp 
    }; 
    [['x', new THREE.Vector3(1, 0, 0), AXES_SETTINGS.COLORS.X], ['y', new THREE.Vector3(0, 1, 0), AXES_SETTINGS.COLORS.Y], ['z', new THREE.Vector3(0, 0, 1), AXES_SETTINGS.COLORS.Z]].forEach(([a, d, c]) => { 
      g.add(new THREE.ArrowHelper(d, o, size, c.line, hl, hw)); 
      const l = cs(a.toUpperCase(), c.text); 
      const off = size + hl; 
      l.position.set(a === 'x' ? off : 0, a === 'y' ? off : 0, a === 'z' ? off : 0); 
      g.add(l) 
    }); 
    return g 
  },
  createPipeline(segments, id) { 
    if (!segments || !segments.length) return null; 
    const root = new THREE.Group(); 
    root.name = `pipeline_${id}`; 
    root.userData = { id, type: 'pipeline', segments: [], nodePositions: {}, totalLength: 0, isClosedLoop: false, createdAt: new Date().toISOString() }; 
    const mat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.PIPE, metalness: .2, roughness: .8 }); 
    let totalLen = 0; 
    segments.forEach((seg, i) => { 
      if (!seg || !seg.start || !seg.end) return; 
      const len = seg.start.distanceTo(seg.end); 
      totalLen += len; 
      const radius = seg.diameter / 2000; 
      const mesh = Factory.createOrientedCylinder(seg.start, seg.end, radius, mat, `pipe_${id}_s${i}`); 
      if (mesh) { 
        mesh.userData = { type: 'pipeSegment', pipelineId: id, index: i, isPipeline: true, start: seg.start.clone(), end: seg.end.clone(), length: len, diameter: seg.diameter, elemName: `Сегмент #${i + 1}` }; 
        root.add(mesh) 
      } 
      const cs = Math.max(CONFIG.QUALITY.CONNECTION_POINT_SIZE, radius * 3); 
      const conn = new THREE.Mesh(new THREE.SphereGeometry(cs, 16, 16), new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.CONNECTION_POINT, emissive: 0x004d00, emissiveIntensity: .5 })); 
      conn.position.copy(seg.end); 
      conn.userData = { type: 'connectionPoint', pipelineId: id, index: i, diameter: seg.diameter, elemName: `Узел #${i + 1}` }; 
      root.add(conn); 
      root.userData.segments.push({ id: `seg_${id}_${i}`, startNodeId: seg.startNodeId, endNodeId: seg.endNodeId, startPos: { x: seg.start.x, y: seg.start.y, z: seg.start.z }, endPos: { x: seg.end.x, y: seg.end.y, z: seg.end.z }, length: len, diameter: seg.diameter }); 
      root.userData.nodePositions[seg.startNodeId] = { x: seg.start.x, y: seg.start.y, z: seg.start.z }; 
      root.userData.nodePositions[seg.endNodeId] = { x: seg.end.x, y: seg.end.y, z: seg.end.z } 
    }); 
    root.userData.totalLength = totalLen; 
    return root 
  },
  createBranch(lengths, diameters, id) { 
    const root = new THREE.Group(); 
    root.name = `branch_${id}`; 
    const attachNodeId = genNodeId(); 
    root.userData = { id, type: 'branch', segments: [], nodePositions: {}, attachNodeId: attachNodeId, totalLength: lengths.reduce((a, b) => a + b, 0), connectedTo: null, createdAt: new Date().toISOString() }; 
    const pm = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.BRANCH, metalness: .2, roughness: .8 }); 
    const sm = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.SPRINKLER, emissive: 0x1a1a4d, emissiveIntensity: .2 }); 
    const nodeMat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.SPRINKLER_NODE, emissive: 0x004d00, emissiveIntensity: .6 }); 
    let curX = 0; 
    const an = new THREE.Mesh(new THREE.SphereGeometry(.12, 16, 16), new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.CONNECTOR, emissive: 0x4d3300, emissiveIntensity: .4 })); 
    an.position.set(0, 0, 0); 
    an.userData = { type: 'attachNode', branchId: id, elemName: 'Узел привязки' }; 
    root.add(an); 
    root.userData.nodePositions[attachNodeId] = { x: 0, y: 0, z: 0 }; 
    let prevNodeId = attachNodeId; 
    lengths.forEach((len, i) => { 
      const dn = diameters[i] || CONFIG.DEFAULTS.DN; 
      const r = dn / 2000; 
      const ss = new THREE.Vector3(curX, 0, 0); 
      const se = new THREE.Vector3(curX + len, 0, 0); 
      const sg = Factory.createOrientedCylinder(ss, se, r, pm, `bSeg_${id}_${i}`); 
      const sprNodeId = genNodeId(); 
      if (sg) { 
        sg.userData = { type: 'branchSegment', branchId: id, index: i, start: ss.clone(), end: se.clone(), length: len, diameter: dn, elemName: `Сегмент #${i + 1}` }; 
        root.add(sg) 
      } 
      const sprX = curX + len, sprR = CONFIG.DEFAULTS.SPRINKLER_DN / 2000; 
      const sprPipe = Factory.createOrientedCylinder(new THREE.Vector3(sprX, 0, 0), new THREE.Vector3(sprX, -.25, 0), sprR, pm, `spr_${id}_${i}`); 
      if (sprPipe) root.add(sprPipe); 
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(sprR * 10, .15, CONFIG.QUALITY.SPR_TESS), sm); 
      arrow.position.set(sprX, -.33, 0); 
      arrow.rotation.x = Math.PI; 
      arrow.userData = { type: 'branchSprinkler', branchId: id, sprinklerIndex: i, elemName: `Ороситель #${i + 1}` }; 
      root.add(arrow); 
      const sprNode = new THREE.Mesh(new THREE.SphereGeometry(CONFIG.QUALITY.SPRINKLER_NODE_SIZE, 16, 16), nodeMat); 
      sprNode.position.set(sprX, 0, 0); 
      sprNode.userData = { type: 'connectionPoint', branchId: id, sprinklerIndex: i, diameter: CONFIG.DEFAULTS.SPRINKLER_DN, elemName: `Узел оросителя №${i + 1}` }; 
      root.add(sprNode); 
      root.userData.segments.push({ id: `bseg_${id}_${i}`, startNodeId: prevNodeId, endNodeId: sprNodeId, startPos: { x: curX, y: 0, z: 0 }, endPos: { x: curX + len, y: -.5, z: 0 }, length: len, diameter: dn }); 
      root.userData.nodePositions[sprNodeId] = { x: curX + len, y: -.5, z: 0 }; 
      prevNodeId = sprNodeId; 
      curX += len 
    }); 
    return root 
  },
  createSprinklerRow(ll, ld, rl, rd, id) { 
    const root = new THREE.Group(); 
    root.name = `row_${id}`; 
    const attachNodeId = genNodeId(); 
    root.userData = { id, type: 'sprinkler_row', segments: [], nodePositions: {}, attachNodeId: attachNodeId, leftSegments: [], rightSegments: [], leftLengths: [...ll], leftDiameters: [...ld], rightLengths: [...rl], rightDiameters: [...rd], totalLength: ll.reduce((a, b) => a + b, 0) + rl.reduce((a, b) => a + b, 0), connectedTo: null, createdAt: new Date().toISOString() }; 
    const plm = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.ROW_LEFT, metalness: .2, roughness: .8 }); 
    const prm = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.ROW_RIGHT, metalness: .2, roughness: .8 }); 
    const sm = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.SPRINKLER, emissive: 0x1a1a4d, emissiveIntensity: .2 }); 
    const nodeMat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.SPRINKLER_NODE, emissive: 0x004d00, emissiveIntensity: .6 }); 
    const an = new THREE.Mesh(new THREE.SphereGeometry(.15, 16, 16), new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.CONNECTOR, emissive: 0x4d3300, emissiveIntensity: .4 })); 
    an.position.set(0, 0, 0); 
    an.userData = { type: 'attachNode', rowId: id, elemName: 'Узел привязки (центр)' }; 
    root.add(an); 
    root.userData.nodePositions[attachNodeId] = { x: 0, y: 0, z: 0 }; 
    let prevL = attachNodeId; 
    let curX = 0; 
    ll.forEach((len, i) => { 
      const dn = ld[i] || CONFIG.DEFAULTS.DN; 
      const r = dn / 2000; 
      const ss = new THREE.Vector3(curX, 0, 0); 
      const se = new THREE.Vector3(curX - len, 0, 0); 
      const sg = Factory.createOrientedCylinder(ss, se, r, plm, `rowL_${id}_${i}`); 
      const nid = genNodeId(); 
      if (sg) { 
        sg.userData = { type: 'rowSegment', rowId: id, side: 'left', index: i, elemName: `◀ Сегмент #${i + 1}` }; 
        root.add(sg) 
      } 
      const sprR = CONFIG.DEFAULTS.SPRINKLER_DN / 2000; 
      const sp = Factory.createOrientedCylinder(new THREE.Vector3(curX - len, 0, 0), new THREE.Vector3(curX - len, -.25, 0), sprR, plm, `rowLSpr_${id}_${i}`); 
      if (sp) root.add(sp); 
      const ar = new THREE.Mesh(new THREE.ConeGeometry(sprR * 10, .15, CONFIG.QUALITY.SPR_TESS), sm); 
      ar.position.set(curX - len, -.33, 0); 
      ar.rotation.x = Math.PI; 
      root.add(ar); 
      const sprNode = new THREE.Mesh(new THREE.SphereGeometry(CONFIG.QUALITY.SPRINKLER_NODE_SIZE, 16, 16), nodeMat); 
      sprNode.position.set(curX - len, 0, 0); 
      sprNode.userData = { type: 'connectionPoint', rowId: id, side: 'left', sprinklerIndex: i, diameter: CONFIG.DEFAULTS.SPRINKLER_DN, elemName: `Узел оросителя Л#${i + 1}` }; 
      root.add(sprNode); 
      root.userData.leftSegments.push({ id: `lseg_${id}_${i}`, startNodeId: prevL, endNodeId: nid, length: len, diameter: dn }); 
      root.userData.segments.push(root.userData.leftSegments[root.userData.leftSegments.length - 1]); 
      root.userData.nodePositions[nid] = { x: curX - len, y: -.5, z: 0 }; 
      prevL = nid; 
      curX -= len 
    }); 
    let prevR = attachNodeId; 
    curX = 0; 
    rl.forEach((len, i) => { 
      const dn = rd[i] || CONFIG.DEFAULTS.DN; 
      const r = dn / 2000; 
      const ss = new THREE.Vector3(curX, 0, 0); 
      const se = new THREE.Vector3(curX + len, 0, 0); 
      const sg = Factory.createOrientedCylinder(ss, se, r, prm, `rowR_${id}_${i}`); 
      const nid = genNodeId(); 
      if (sg) { 
        sg.userData = { type: 'rowSegment', rowId: id, side: 'right', index: i, elemName: `Сегмент #${i + 1} ▶` }; 
        root.add(sg) 
      } 
      const sprR = CONFIG.DEFAULTS.SPRINKLER_DN / 2000; 
      const sp = Factory.createOrientedCylinder(new THREE.Vector3(curX + len, 0, 0), new THREE.Vector3(curX + len, -.25, 0), sprR, prm, `rowRSpr_${id}_${i}`); 
      if (sp) root.add(sp); 
      const ar = new THREE.Mesh(new THREE.ConeGeometry(sprR * 10, .15, CONFIG.QUALITY.SPR_TESS), sm); 
      ar.position.set(curX + len, -.33, 0); 
      ar.rotation.x = Math.PI; 
      root.add(ar); 
      const sprNode = new THREE.Mesh(new THREE.SphereGeometry(CONFIG.QUALITY.SPRINKLER_NODE_SIZE, 16, 16), nodeMat); 
      sprNode.position.set(curX + len, 0, 0); 
      sprNode.userData = { type: 'connectionPoint', rowId: id, side: 'right', sprinklerIndex: i, diameter: CONFIG.DEFAULTS.SPRINKLER_DN, elemName: `Узел оросителя П#${i + 1}` }; 
      root.add(sprNode); 
      root.userData.rightSegments.push({ id: `rseg_${id}_${i}`, startNodeId: prevR, endNodeId: nid, length: len, diameter: dn }); 
      root.userData.segments.push(root.userData.rightSegments[root.userData.rightSegments.length - 1]); 
      root.userData.nodePositions[nid] = { x: curX + len, y: 2, z: 0 }; 
      prevR = nid; 
      curX += len 
    }); 
    return root 
  },
  createControlValve(length, diameter, id) { 
    const root = new THREE.Group(); 
    root.name = `valve_${id}`; 
    const inNodeId = genNodeId(); 
    const outNodeId = genNodeId(); 
    root.userData = { id, type: 'control_valve', totalLength: length * 2, diameter: diameter, nodePositions: {}, createdAt: new Date().toISOString() }; 
    const pipeMat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.VALVE, metalness: 0.3, roughness: 0.7 }); 
    const nodeMat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.CONNECTION_POINT, emissive: 0x004d00, emissiveIntensity: 0.3, metalness: 0.5, roughness: 0.5 }); 
    const radius = diameter / 2000; 
    const verticalOffset = length; 
    const diagonalLength = Math.sqrt(length * length + length * length); 
    const topPipe = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 16), pipeMat); 
    topPipe.rotation.z = Math.PI / 2; 
    topPipe.position.set(-length / 2, verticalOffset, 0); 
    topPipe.castShadow = true; 
    topPipe.userData = { type: 'valveSegment', valveId: id, segment: 'top', diameter: diameter, elemName: 'Верхний сегмент' }; 
    root.add(topPipe); 
    const diagPipe = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, diagonalLength, 16), pipeMat); 
    diagPipe.rotation.z = Math.atan2(-length, length); 
    diagPipe.position.set(length / 2, length / 2, 0); 
    diagPipe.castShadow = true; 
    diagPipe.userData = { type: 'valveSegment', valveId: id, segment: 'diagonal', diameter: diameter, elemName: 'Диагональный сегмент' }; 
    root.add(diagPipe); 
    const bottomPipe = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 16), pipeMat); 
    bottomPipe.rotation.z = Math.PI / 2; 
    bottomPipe.position.set(length * 1.5, 0, 0); 
    bottomPipe.castShadow = true; 
    bottomPipe.userData = { type: 'valveSegment', valveId: id, segment: 'bottom', diameter: diameter, elemName: 'Нижний сегмент' }; 
    root.add(bottomPipe); 
    const node1 = new THREE.Mesh(new THREE.SphereGeometry(radius * 2.5, 16, 16), nodeMat); 
    node1.position.set(-length, verticalOffset, 0); 
    node1.castShadow = true; 
    node1.userData = { type: 'connectionPoint', valveId: id, nodeIndex: 0, diameter: diameter, elemName: 'Узел входа' }; 
    root.add(node1); 
    root.userData.nodePositions[inNodeId] = { x: -length, y: verticalOffset, z: 0 }; 
    const node2 = new THREE.Mesh(new THREE.SphereGeometry(radius * 2.5, 16, 16), nodeMat); 
    node2.position.set(length * 2, 0, 0); 
    node2.castShadow = true; 
    node2.userData = { type: 'connectionPoint', valveId: id, nodeIndex: 1, diameter: diameter, elemName: 'Узел выхода' }; 
    root.add(node2); 
    root.userData.nodePositions[outNodeId] = { x: length * 2, y: 0, z: 0 }; 
    return root; 
  },
  createConnectionPipeline(sp, ep, dn, id) { 
    const sn = genNodeId(); 
    const en = genNodeId(); 
    return this.createPipeline([{ start: sp.clone(), end: ep.clone(), diameter: dn, startNodeId: sn, endNodeId: en }], id) 
  }
};