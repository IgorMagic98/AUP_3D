// ============================================================
// state.js — константы, состояние приложения и базовые утилиты
// ВАЖНО: подключается ПОСЛЕ three.min.js (использует THREE.Vector3)
// ============================================================

const GEOMETRY_TOLERANCE = 0.005;

function isSamePoint(p1, p2, t) {
    return p1.distanceToSquared(p2) <= (t || GEOMETRY_TOLERANCE) * (t || GEOMETRY_TOLERANCE);
}

const AXES_SETTINGS = {
    AUTO_SIZE: { ENABLED: false, RELATIVE_RATIO: .25, MIN_SIZE: .5, MAX_SIZE: 10 },
    FIXED_SIZE: 1,
    HEAD_LENGTH_RATIO: .25,
    HEAD_WIDTH_RATIO: .4,
    LABEL_SIZE_RATIO: .05,
    HEIGHT_OFFSET: .02,
    COLORS: {
        X: { line: 0xff3333, text: '#ff3333' },
        Y: { line: 0x33cc33, text: '#33cc33' },
        Z: { line: 0x3366ff, text: '#3366ff' }
    }
};

const CONFIG = {
    DEFAULTS: { LENGTH: 2, DN: 50, SPRINKLER_DN: 15 },
    LIMITS: { MIN_LEN: .1, MAX_LEN: 100, MIN_SPR: 0, MAX_SPR: 50 },
    AVAILABLE_DN: [15, 20, 25, 32, 40, 50, 65, 80, 100, 125, 150, 200, 250, 300, 350, 400],
    COLORS: {
        PIPE: 0x1a80cc, BRANCH: 0x1a991a, SPRINKLER: 0x3333ff,
        CONNECTOR: 0xe6991a, END: 0xcc4d1a, PREVIEW: 0xff6b6b,
        GROUND: 0xeaf5ea, GRID: 0xd9d9d9,
        CONNECTION_POINT: 0x00ff00, CONNECTION_POINT_SELECTED: 0xffff00,
        ROW_LEFT: 0x1a991a, ROW_RIGHT: 0xcc6600,
        SPRINKLER_NODE: 0x00cc00, VALVE: 0xff6600
    },
    QUALITY: {
        PIPE_TESS: 16, SPR_TESS: 24,
        CONNECTION_POINT_SIZE: .15, SPRINKLER_NODE_SIZE: 0.12
    }
};

const STATE = {
    objects: [],
    objectCounter: 0,
    pipelineCounter: 0,
    branchCounter: 0,
    rowCounter: 0,
    valveCounter: 0,
    nodeCounter: 0,
    currentEditId: null,
    currentEditPipeId: null,
    currentEditRowId: null,
    currentEditValveId: null,
    currentSplitPipeId: null,
    pendingBranch: null,
    pendingRow: null,
    pendingDuplicate: null,
    pendingSplitSegment: null,
    highlightedObjects: [],
    expandedFolders: new Set(),
    autoConnections: [],
    showGrid: true,
    showConnectionPoints: true,
    showRealDiameters: true,
    selectedObjectId: null,
    insertValveMode: false,
    meshes: { ground: null, grid: null, axes: null },
    pipeline: {
        active: false,
        currentPoint: new THREE.Vector3(0, 5, 0),
        axis: 'y',
        direction: '+',
        diameter: 200,
        segments: [],
        previewMesh: null,
        committedMeshes: []
    },
    connectMode: { active: false, selectedBranches: [] },
    connectPointsMode: { active: false, selectedPoints: [] },
    graphView: {
        scale: 1, panX: 0, panY: 0,
        isPanning: false, lastMouseX: 0, lastMouseY: 0,
        minScale: .1, maxScale: 5, wheelStep: .1
    },
    project: { name: null, folderHandle: null, projectFolderHandle: null }
};

function genNodeId() {
    return 'N_' + String(++STATE.nodeCounter).padStart(4, '0');
}

function findNodeAtPos(pos, nodeRegistry) {
    for (const id in nodeRegistry) {
        if (isSamePoint(pos, nodeRegistry[id])) return id;
    }
    return null;
}

const Utils = {
    clamp: (v, mn, mx) => Math.max(mn, Math.min(mx, v)),
    formatVector: v => `${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)}`,
    getDnOptions: s => CONFIG.AVAILABLE_DN.map(d =>
        `<option value="${d}" ${d === s ? 'selected' : ''}>${d}</option>`
    ).join(''),
    showStatus: (m, d = 3000) => {
        const e = document.getElementById('status');
        if (!e) return;
        e.textContent = m;
        e.classList.add('show');
        setTimeout(() => e.classList.remove('show'), d);
    }
};