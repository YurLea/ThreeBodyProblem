const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d', {alpha: false});

const ui = {
    gInput: document.getElementById('gInput'),
    dtInput: document.getElementById('dtInput'),
    timeScaleInput: document.getElementById('timeScaleInput'),
    scaleInput: document.getElementById('scaleInput'),
    launchScaleInput: document.getElementById('launchScaleInput'),
    vectorScaleInput: document.getElementById('vectorScaleInput'),
    trailLengthInput: document.getElementById('trailLengthInput'),
    showTrailsInput: document.getElementById('showTrailsInput'),
    showVectorsInput: document.getElementById('showVectorsInput'),
    cameraModeInput: document.getElementById('cameraModeInput'),

    selectBody0: document.getElementById('selectBody0'),
    selectBody1: document.getElementById('selectBody1'),
    selectBody2: document.getElementById('selectBody2'),

    pauseBtn: document.getElementById('pauseBtn'),
    applyBtn: document.getElementById('applyBtn'),
    resetBtn: document.getElementById('resetBtn'),
    presetBtn: document.getElementById('presetBtn'),
    orbitsBtn: document.getElementById('orbitsBtn'),
    helpBtn: document.getElementById('helpBtn'),

    helpOverlay: document.getElementById('helpOverlay'),
    helpCloseBtn: document.getElementById('helpCloseBtn'),
    helpOkBtn: document.getElementById('helpOkBtn'),

    orbitsOverlay: document.getElementById('orbitsOverlay'),
    orbitsCloseBtn: document.getElementById('orbitsCloseBtn'),
    orbitsOkBtn: document.getElementById('orbitsOkBtn'),
    orbitList: document.getElementById('orbitList'),

    stats: document.getElementById('stats')
};

const bodyInputs = [
    {
        m: document.getElementById('m1Input'),
        x: document.getElementById('x1Input'),
        y: document.getElementById('y1Input'),
        vx: document.getElementById('vx1Input'),
        vy: document.getElementById('vy1Input')
    },
    {
        m: document.getElementById('m2Input'),
        x: document.getElementById('x2Input'),
        y: document.getElementById('y2Input'),
        vx: document.getElementById('vx2Input'),
        vy: document.getElementById('vy2Input')
    },
    {
        m: document.getElementById('m3Input'),
        x: document.getElementById('x3Input'),
        y: document.getElementById('y3Input'),
        vx: document.getElementById('vx3Input'),
        vy: document.getElementById('vy3Input')
    }
];

const bodyInputElements = bodyInputs.flatMap(({m, x, y, vx, vy}) => [m, x, y, vx, vy]);
const selectButtons = [ui.selectBody0, ui.selectBody1, ui.selectBody2];

const viewport = {
    width: 0,
    height: 0,
    dpr: 1
};

const state = {
    G: 1,
    dt: 0.002,
    timeScale: 1,
    scale: 160,
    launchScale: 1.2,
    vectorScale: 0.35,
    showTrails: true,
    showVectors: false,
    trailMaxLength: 400,
    trailSampleEvery: 1,
    cameraMode: 'com',
    softening: 0.001,
    paused: false
};

const BODY_COLORS = ['#ff6b6b', '#ffd166', '#4cc9f0'];

const orbitPresets = window.ORBIT_PRESETS || [];

function getOrbitPresetById(id) {
    return orbitPresets.find(preset => preset.id === id) || null;
}

function buildLagrangeTrianglePreset({side = 2, mass = 1, clockwise = false}) {
    const R = side / Math.sqrt(3);
    const v = Math.sqrt(mass / side); // G = 1 в пресете

    const bodies = [
        {mass, x: R, y: 0, vx: 0, vy: v},
        {mass, x: -R / 2, y: side / 2, vx: -Math.sqrt(3) * v / 2, vy: -v / 2},
        {mass, x: -R / 2, y: -side / 2, vx: Math.sqrt(3) * v / 2, vy: -v / 2}
    ];

    if (!clockwise) {
        return bodies;
    }

    return bodies.map(body => ({
        ...body,
        vx: -body.vx,
        vy: -body.vy
    }));
}

function buildEulerCollinearPreset({r = 1, mass = 1, clockwise = false}) {
    const omega = Math.sqrt(5 * mass / (4 * Math.pow(r, 3))); // G = 1
    const v = omega * r;

    const bodies = [
        {mass, x: -r, y: 0, vx: 0, vy: v},
        {mass, x: 0, y: 0, vx: 0, vy: 0},
        {mass, x: r, y: 0, vx: 0, vy: -v}
    ];

    if (!clockwise) {
        return bodies;
    }

    return bodies.map(body => ({
        ...body,
        vx: -body.vx,
        vy: -body.vy
    }));
}

function loadOrbitPreset(preset) {
    ui.gInput.value = preset.settings?.G ?? 1;
    ui.dtInput.value = preset.settings?.dt ?? 0.002;
    ui.scaleInput.value = preset.settings?.scale ?? 160;
    ui.timeScaleInput.value = preset.settings?.timeScale ?? 1;
    ui.trailLengthInput.value = preset.settings?.trailLength ?? 700;

    if (preset.settings?.cameraMode) {
        ui.cameraModeInput.value = preset.settings.cameraMode;
    }

    initialBodies = preset.bodies.map((body, index) => createInitialBodyConfig(body, index));
    writeBodyInputsFromInitial();
    applyGlobalSettings();
    resetSimulation();
    closeOrbitsModal();
}

function renderOrbitPresets() {
    ui.orbitList.innerHTML = '';

    if (!orbitPresets.length) {
        ui.orbitList.innerHTML = '<p>Каталог орбит пуст.</p>';
        return;
    }

    const groups = new Map();

    for (const preset of orbitPresets) {
        const family = preset.family || 'Без категории';

        if (!groups.has(family)) {
            groups.set(family, []);
        }

        groups.get(family).push(preset);
    }

    for (const [family, presets] of groups.entries()) {
        const group = document.createElement('div');
        group.className = 'orbit-group';

        const title = document.createElement('h3');
        title.className = 'orbit-group-title';
        title.textContent = family;
        group.appendChild(title);

        for (const preset of presets) {
            const card = document.createElement('div');
            card.className = 'orbit-card';

            const sourceBlock = preset.source
                ? `<div class="orbit-source">Источник: ${preset.source}</div>`
                : '';

            card.innerHTML = `
    <h3>${preset.name}</h3>
    <p>${preset.description}</p>
    <div class="orbit-meta">${preset.meta || ''}</div>
`;

            const btn = card.querySelector('button');
            btn.addEventListener('click', () => loadOrbitPreset(preset));

            group.appendChild(card);
        }

        ui.orbitList.appendChild(group);
    }
}

const drag = {
    active: false,
    pointerId: null,
    startWorld: null,
    currentWorld: null,
    camera: null,
    wasPaused: false
};

let initialBodies = [];
let bodies = [];
let selectedBodyIndex = 0;
let simTime = 0;
let lastTime = performance.now();
let accumulator = 0;

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    viewport.width = rect.width;
    viewport.height = rect.height;
    viewport.dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(viewport.width * viewport.dpr);
    canvas.height = Math.round(viewport.height * viewport.dpr);

    ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
}

function eventToCanvasPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

function readNumber(input, fallback, min = -Infinity, max = Infinity) {
    const value = Number(input.value);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
}

function formatNumber(value, digits = 6) {
    return Number(value.toFixed(digits)).toString();
}

function createInitialBodyConfig(raw, index) {
    return {
        mass: raw.mass,
        x: raw.x,
        y: raw.y,
        vx: raw.vx,
        vy: raw.vy,
        color: BODY_COLORS[index],
        label: `Тело ${index + 1}`
    };
}

function loadPresetFigureEight() {
    const preset = getOrbitPresetById('figure-eight');

    if (!preset) {
        console.error('Пресет figure-eight не найден в orbitCatalog.js');
        return;
    }

    loadOrbitPreset(preset);
}

function mirrorBodiesX(bodies) {
    return bodies.map(body => ({
        mass: body.mass,
        x: body.x,
        y: -body.y,
        vx: body.vx,
        vy: -body.vy
    }));
}

function mirrorBodiesY(bodies) {
    return bodies.map(body => ({
        mass: body.mass,
        x: -body.x,
        y: body.y,
        vx: -body.vx,
        vy: body.vy
    }));
}

function reverseVelocities(bodies) {
    return bodies.map(body => ({
        mass: body.mass,
        x: body.x,
        y: body.y,
        vx: -body.vx,
        vy: -body.vy
    }));
}

function writeBodyInputsFromInitial() {
    initialBodies.forEach((body, i) => {
        bodyInputs[i].m.value = formatNumber(body.mass, 6);
        bodyInputs[i].x.value = formatNumber(body.x, 8);
        bodyInputs[i].y.value = formatNumber(body.y, 8);
        bodyInputs[i].vx.value = formatNumber(body.vx, 8);
        bodyInputs[i].vy.value = formatNumber(body.vy, 8);
    });
}

function readInitialBodiesFromInputs() {
    return bodyInputs.map((refs, i) => {
        const fallback = initialBodies[i];
        return createInitialBodyConfig({
            mass: readNumber(refs.m, fallback.mass, 0.0001),
            x: readNumber(refs.x, fallback.x),
            y: readNumber(refs.y, fallback.y),
            vx: readNumber(refs.vx, fallback.vx),
            vy: readNumber(refs.vy, fallback.vy)
        }, i);
    });
}

function createSimulationBody(initial, index) {
    return {
        index,
        label: initial.label,
        color: initial.color,
        mass: initial.mass,
        x: initial.x,
        y: initial.y,
        vx: initial.vx,
        vy: initial.vy,
        ax: 0,
        ay: 0,
        trail: [{x: initial.x, y: initial.y}],
        trailTick: 0
    };
}

function computeAccelerations(sourceBodies) {
    const acc = sourceBodies.map(() => ({ax: 0, ay: 0}));
    const eps2 = state.softening * state.softening;

    for (let i = 0; i < sourceBodies.length; i++) {
        for (let j = i + 1; j < sourceBodies.length; j++) {
            const bi = sourceBodies[i];
            const bj = sourceBodies[j];

            const dx = bj.x - bi.x;
            const dy = bj.y - bi.y;

            const distSq = dx * dx + dy * dy + eps2;
            const dist = Math.sqrt(distSq);
            const invDist3 = 1 / (distSq * dist);
            const factor = state.G * invDist3;

            acc[i].ax += factor * bj.mass * dx;
            acc[i].ay += factor * bj.mass * dy;

            acc[j].ax -= factor * bi.mass * dx;
            acc[j].ay -= factor * bi.mass * dy;
        }
    }

    return acc;
}

function recomputeAccelerationsCurrent() {
    if (!bodies.length) return;

    const acc = computeAccelerations(bodies);
    for (let i = 0; i < bodies.length; i++) {
        bodies[i].ax = acc[i].ax;
        bodies[i].ay = acc[i].ay;
    }
}

function trimTrails() {
    for (const body of bodies) {
        if (body.trail.length > state.trailMaxLength) {
            body.trail = body.trail.slice(-state.trailMaxLength);
        }
    }
}

function resetSimulation() {
    bodies = initialBodies.map((body, index) => createSimulationBody(body, index));
    recomputeAccelerationsCurrent();
    trimTrails();
    simTime = 0;
    accumulator = 0;
    lastTime = performance.now();
}

function applyGlobalSettings() {
    state.G = readNumber(ui.gInput, 1, 0.0001);
    state.dt = readNumber(ui.dtInput, 0.002, 0.0001);
    state.timeScale = readNumber(ui.timeScaleInput, 1, 0.1);
    state.scale = readNumber(ui.scaleInput, 160, 10);
    state.launchScale = readNumber(ui.launchScaleInput, 1.2, 0.01);
    state.vectorScale = readNumber(ui.vectorScaleInput, 0.35, 0.01);
    state.trailMaxLength = Math.floor(readNumber(ui.trailLengthInput, 400, 20, 4000));
    state.showTrails = ui.showTrailsInput.checked;
    state.showVectors = ui.showVectorsInput.checked;
    state.cameraMode = ui.cameraModeInput.value;

    trimTrails();
    recomputeAccelerationsCurrent();
}

function applyBodiesAndReset() {
    initialBodies = readInitialBodiesFromInputs();
    resetSimulation();
}

function setPauseButtonText() {
    ui.pauseBtn.textContent = state.paused ? 'Продолжить' : 'Пауза';
}

function togglePause() {
    state.paused = !state.paused;
    setPauseButtonText();
    lastTime = performance.now();
}

function setSelectedBody(index) {
    selectedBodyIndex = index;
    selectButtons.forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
    });
}

function getCameraCenter(sourceBodies = (bodies.length ? bodies : initialBodies)) {
    if (!sourceBodies.length) {
        return {x: 0, y: 0};
    }

    if (state.cameraMode === 'origin') {
        return {x: 0, y: 0};
    }

    if (state.cameraMode === 'body0' && sourceBodies[0]) {
        return {x: sourceBodies[0].x, y: sourceBodies[0].y};
    }

    if (state.cameraMode === 'body1' && sourceBodies[1]) {
        return {x: sourceBodies[1].x, y: sourceBodies[1].y};
    }

    if (state.cameraMode === 'body2' && sourceBodies[2]) {
        return {x: sourceBodies[2].x, y: sourceBodies[2].y};
    }

    let totalMass = 0;
    let cx = 0;
    let cy = 0;

    for (const body of sourceBodies) {
        totalMass += body.mass;
        cx += body.mass * body.x;
        cy += body.mass * body.y;
    }

    if (totalMass === 0) {
        return {x: 0, y: 0};
    }

    return {
        x: cx / totalMass,
        y: cy / totalMass
    };
}

function worldToScreenWithCamera(x, y, camera) {
    return {
        x: viewport.width / 2 + (x - camera.x) * state.scale,
        y: viewport.height / 2 - (y - camera.y) * state.scale
    };
}

function screenToWorldWithCamera(px, py, camera) {
    return {
        x: camera.x + (px - viewport.width / 2) / state.scale,
        y: camera.y + (viewport.height / 2 - py) / state.scale
    };
}

function worldToScreen(x, y) {
    return worldToScreenWithCamera(x, y, getCameraCenter());
}

function bodyRadius(body) {
    return Math.max(5, 4 + 1.5 * Math.log1p(body.mass));
}

function drawArrow(x1, y1, x2, y2, color, width = 1.5) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);

    if (length < 1) return;

    const ux = dx / length;
    const uy = dy / length;
    const head = Math.min(10, length * 0.35);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
        x2 - ux * head - uy * head * 0.45,
        y2 - uy * head + ux * head * 0.45
    );
    ctx.lineTo(
        x2 - ux * head + uy * head * 0.45,
        y2 - uy * head - ux * head * 0.45
    );
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

function drawAxes() {
    const origin = worldToScreen(0, 0);

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(0, origin.y);
    ctx.lineTo(viewport.width, origin.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(origin.x, 0);
    ctx.lineTo(origin.x, viewport.height);
    ctx.stroke();

    ctx.restore();
}

function drawTrail(body) {
    if (body.trail.length < 2) return;

    ctx.save();
    ctx.strokeStyle = body.color;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    for (let i = 0; i < body.trail.length; i++) {
        const p = worldToScreen(body.trail[i].x, body.trail[i].y);
        if (i === 0) {
            ctx.moveTo(p.x, p.y);
        } else {
            ctx.lineTo(p.x, p.y);
        }
    }
    ctx.stroke();
    ctx.restore();
}

function drawVelocityVector(body) {
    const start = worldToScreen(body.x, body.y);
    const end = worldToScreen(
        body.x + body.vx * state.vectorScale,
        body.y + body.vy * state.vectorScale
    );

    drawArrow(start.x, start.y, end.x, end.y, body.color, 1.6);
}

function drawBody(body) {
    const p = worldToScreen(body.x, body.y);
    const r = bodyRadius(body);

    if (body.index === selectedBodyIndex) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = body.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = body.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#e8eefc';
    ctx.font = '12px Inter, Arial, sans-serif';
    ctx.fillText(String(body.index + 1), p.x + r + 5, p.y - r - 4);
    ctx.restore();
}

function drawDragPreview() {
    if (!drag.active || !drag.startWorld || !drag.currentWorld || !drag.camera) return;

    const start = worldToScreenWithCamera(drag.startWorld.x, drag.startWorld.y, drag.camera);
    const current = worldToScreenWithCamera(drag.currentWorld.x, drag.currentWorld.y, drag.camera);

    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(current.x, current.y);
    ctx.stroke();
    ctx.restore();

    drawArrow(start.x, start.y, current.x, current.y, '#ffffff', 1.3);

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(start.x, start.y, 4, 0, Math.PI * 2);
    ctx.fill();

    const vx = (drag.currentWorld.x - drag.startWorld.x) * state.launchScale;
    const vy = (drag.currentWorld.y - drag.startWorld.y) * state.launchScale;
    const v = Math.hypot(vx, vy);

    ctx.font = '13px Inter, Arial, sans-serif';
    ctx.fillText(`Тело ${selectedBodyIndex + 1}: v0 = ${v.toFixed(3)}`, current.x + 10, current.y - 10);
    ctx.restore();
}

function computeSystemStats(sourceBodies = bodies) {
    if (!sourceBodies.length) {
        return {
            totalMass: 0,
            comx: 0,
            comy: 0,
            momentum: 0,
            kinetic: 0,
            potential: 0,
            energy: 0
        };
    }

    let totalMass = 0;
    let comx = 0;
    let comy = 0;
    let px = 0;
    let py = 0;
    let kinetic = 0;
    let potential = 0;

    for (const body of sourceBodies) {
        totalMass += body.mass;
        comx += body.mass * body.x;
        comy += body.mass * body.y;
        px += body.mass * body.vx;
        py += body.mass * body.vy;
        kinetic += 0.5 * body.mass * (body.vx * body.vx + body.vy * body.vy);
    }

    if (totalMass > 0) {
        comx /= totalMass;
        comy /= totalMass;
    }

    for (let i = 0; i < sourceBodies.length; i++) {
        for (let j = i + 1; j < sourceBodies.length; j++) {
            const bi = sourceBodies[i];
            const bj = sourceBodies[j];
            const dx = bj.x - bi.x;
            const dy = bj.y - bi.y;
            const dist = Math.sqrt(dx * dx + dy * dy + state.softening * state.softening);
            potential -= state.G * bi.mass * bj.mass / dist;
        }
    }

    return {
        totalMass,
        comx,
        comy,
        momentum: Math.hypot(px, py),
        kinetic,
        potential,
        energy: kinetic + potential
    };
}

function updateStats() {
    const stats = computeSystemStats();

    ui.stats.innerHTML = `
        t = <b>${simTime.toFixed(3)}</b><br>
        Тел: <b>3</b><br>
        G = ${state.G.toFixed(3)}<br>
        dt = ${state.dt.toFixed(4)}<br>
        E = ${stats.energy.toFixed(6)}<br>
        |P| = ${stats.momentum.toFixed(6)}<br>
        COM = (${stats.comx.toFixed(3)}, ${stats.comy.toFixed(3)})<br>
        Редактируется: <b>Тело ${selectedBodyIndex + 1}</b>
    `;
}

function hasInvalidState() {
    return bodies.some(body =>
        !Number.isFinite(body.x) ||
        !Number.isFinite(body.y) ||
        !Number.isFinite(body.vx) ||
        !Number.isFinite(body.vy) ||
        !Number.isFinite(body.ax) ||
        !Number.isFinite(body.ay)
    );
}

function physicsStep(dt) {
    const prevAcc = bodies.map(body => ({ax: body.ax, ay: body.ay}));

    for (const body of bodies) {
        body.x += body.vx * dt + 0.5 * body.ax * dt * dt;
        body.y += body.vy * dt + 0.5 * body.ay * dt * dt;
    }

    const newAcc = computeAccelerations(bodies);

    for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];

        body.vx += 0.5 * (prevAcc[i].ax + newAcc[i].ax) * dt;
        body.vy += 0.5 * (prevAcc[i].ay + newAcc[i].ay) * dt;
        body.ax = newAcc[i].ax;
        body.ay = newAcc[i].ay;

        body.trailTick += 1;
        if (body.trailTick >= state.trailSampleEvery) {
            body.trailTick = 0;
            body.trail.push({x: body.x, y: body.y});

            if (body.trail.length > state.trailMaxLength) {
                body.trail.shift();
            }
        }
    }

    simTime += dt;

    if (hasInvalidState()) {
        state.paused = true;
        setPauseButtonText();
    }
}

function render() {
    ctx.fillStyle = '#050816';
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    drawAxes();

    if (state.showTrails) {
        for (const body of bodies) {
            drawTrail(body);
        }
    }

    if (state.showVectors) {
        for (const body of bodies) {
            drawVelocityVector(body);
        }
    }

    for (const body of bodies) {
        drawBody(body);
    }

    drawDragPreview();
    updateStats();
}

function clearDragState() {
    drag.active = false;
    drag.pointerId = null;
    drag.startWorld = null;
    drag.currentWorld = null;
    drag.camera = null;
}

function startDrag(event) {
    if (event.button !== 0) return;

    const pos = eventToCanvasPosition(event);
    drag.camera = getCameraCenter();
    drag.startWorld = screenToWorldWithCamera(pos.x, pos.y, drag.camera);
    drag.currentWorld = drag.startWorld;
    drag.active = true;
    drag.pointerId = event.pointerId;
    drag.wasPaused = state.paused;

    state.paused = true;
    setPauseButtonText();

    canvas.setPointerCapture(event.pointerId);
}

function moveDrag(event) {
    if (!drag.active || event.pointerId !== drag.pointerId) return;

    const pos = eventToCanvasPosition(event);
    drag.currentWorld = screenToWorldWithCamera(pos.x, pos.y, drag.camera);
}

function endDrag(event) {
    if (!drag.active || event.pointerId !== drag.pointerId) return;

    const pos = eventToCanvasPosition(event);
    drag.currentWorld = screenToWorldWithCamera(pos.x, pos.y, drag.camera);

    const vx = (drag.currentWorld.x - drag.startWorld.x) * state.launchScale;
    const vy = (drag.currentWorld.y - drag.startWorld.y) * state.launchScale;

    initialBodies[selectedBodyIndex].x = drag.startWorld.x;
    initialBodies[selectedBodyIndex].y = drag.startWorld.y;
    initialBodies[selectedBodyIndex].vx = vx;
    initialBodies[selectedBodyIndex].vy = vy;

    writeBodyInputsFromInitial();
    resetSimulation();

    state.paused = drag.wasPaused;
    setPauseButtonText();

    clearDragState();
}

function cancelDrag() {
    if (drag.active) {
        state.paused = drag.wasPaused;
        setPauseButtonText();
    }
    clearDragState();
}

function animate(now) {
    let elapsed = (now - lastTime) / 1000;
    lastTime = now;

    if (elapsed > 0.05) elapsed = 0.05;

    if (!state.paused) {
        accumulator += elapsed * state.timeScale;

        let substeps = 0;
        const maxSubsteps = 1000;

        while (accumulator >= state.dt && substeps < maxSubsteps && !state.paused) {
            physicsStep(state.dt);
            accumulator -= state.dt;
            substeps += 1;
        }

        if (substeps === maxSubsteps) {
            accumulator = 0;
        }
    }

    render();
    requestAnimationFrame(animate);
}

function openHelpModal() {
    ui.helpOverlay.classList.remove('hidden');
}

function closeHelpModal() {
    ui.helpOverlay.classList.add('hidden');
}

function openOrbitsModal() {
    ui.orbitsOverlay.classList.remove('hidden');
}

function closeOrbitsModal() {
    ui.orbitsOverlay.classList.add('hidden');
}

function init() {
    resizeCanvas();
    setSelectedBody(0);
    loadPresetFigureEight();
    renderOrbitPresets();
    applyGlobalSettings();
    setPauseButtonText();
    render();

    window.addEventListener('resize', () => {
        resizeCanvas();
        render();
    });

    [
        ui.gInput,
        ui.dtInput,
        ui.timeScaleInput,
        ui.scaleInput,
        ui.launchScaleInput,
        ui.vectorScaleInput,
        ui.trailLengthInput,
        ui.showTrailsInput,
        ui.showVectorsInput,
        ui.cameraModeInput
    ].forEach(input => {
        input.addEventListener('input', applyGlobalSettings);
        input.addEventListener('change', applyGlobalSettings);
    });

    bodyInputElements.forEach(input => {
        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                applyBodiesAndReset();
            }
        });
    });

    ui.selectBody0.addEventListener('click', () => setSelectedBody(0));
    ui.selectBody1.addEventListener('click', () => setSelectedBody(1));
    ui.selectBody2.addEventListener('click', () => setSelectedBody(2));

    ui.pauseBtn.addEventListener('click', togglePause);
    ui.applyBtn.addEventListener('click', applyBodiesAndReset);
    ui.resetBtn.addEventListener('click', resetSimulation);
    ui.orbitsBtn.addEventListener('click', openOrbitsModal);
    ui.presetBtn.addEventListener('click', loadPresetFigureEight);


    canvas.addEventListener('pointerdown', startDrag);
    canvas.addEventListener('pointermove', moveDrag);
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', cancelDrag);

    ui.helpBtn.addEventListener('click', openHelpModal);
    ui.helpCloseBtn.addEventListener('click', closeHelpModal);
    ui.helpOkBtn.addEventListener('click', closeHelpModal);

    ui.helpOverlay.addEventListener('click', event => {
        if (event.target === ui.helpOverlay) {
            closeHelpModal();
        }
    });

    ui.orbitsCloseBtn.addEventListener('click', closeOrbitsModal);
    ui.orbitsOkBtn.addEventListener('click', closeOrbitsModal);

    ui.orbitsOverlay.addEventListener('click', event => {
        if (event.target === ui.orbitsOverlay) {
            closeOrbitsModal();
        }
    });

    window.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            if (!ui.helpOverlay.classList.contains('hidden')) {
                closeHelpModal();
            }
            if (!ui.orbitsOverlay.classList.contains('hidden')) {
                closeOrbitsModal();
            }
        }

        if (
            event.code === 'Space' &&
            event.target.tagName !== 'INPUT' &&
            event.target.tagName !== 'BUTTON' &&
            event.target.tagName !== 'SELECT'
        ) {
            event.preventDefault();
            togglePause();
        }
    });

    requestAnimationFrame(animate);
}

init();