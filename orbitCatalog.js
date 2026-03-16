const PRESET_FIGURE_EIGHT = [
    { mass: 1, x: -0.97000436, y: 0.24308753, vx: 0.4662036850, vy: 0.4323657300 },
    { mass: 1, x:  0.97000436, y: -0.24308753, vx: 0.4662036850, vy: 0.4323657300 },
    { mass: 1, x:  0,          y: 0,           vx: -0.93240737,  vy: -0.86473146 }
];

function rotatePoint(x, y, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
        x: c * x - s * y,
        y: s * x + c * y
    };
}

function transformBodiesForScaleAndRotation(bodies, { scale = 1, rotation = 0 }) {
    const velocityScale = 1 / Math.sqrt(scale);

    return bodies.map(body => {
        const p = rotatePoint(body.x * scale, body.y * scale, rotation);
        const v = rotatePoint(body.vx * velocityScale, body.vy * velocityScale, rotation);

        return {
            mass: body.mass,
            x: p.x,
            y: p.y,
            vx: v.x,
            vy: v.y
        };
    });
}

function buildSymmetricChoreography({ x, y, vx, vy, mass = 1, scale = 1, rotation = 0 }) {
    const base = [
        { mass, x: x,      y: y,  vx: vx,      vy: vy },
        { mass, x: x,      y: -y, vx: vx,      vy: -vy },
        { mass, x: -2 * x, y: 0,  vx: -2 * vx, vy: 0 }
    ];

    return transformBodiesForScaleAndRotation(base, { scale, rotation });
}

function makeOrbitPreset({
                             id,
                             family,
                             name,
                             description,
                             source,
                             settings,
                             bodies
                         }) {
    return {
        id,
        family,
        name,
        description,
        source,
        meta: `Семейство: ${family}${source ? ` · Источник: ${source}` : ''}`,
        settings: {
            G: 1,
            dt: 0.002,
            scale: 160,
            timeScale: 1,
            trailLength: 700,
            cameraMode: 'com',
            ...settings
        },
        bodies
    };
}

const ORBIT_PRESETS = [
    makeOrbitPreset({
        id: 'figure-eight',
        family: 'Хореографии',
        name: 'Восьмёрка',
        description: 'Классическая периодическая хореография трёх одинаковых тел.',
        source: 'Moore / Chenciner / Montgomery',
        settings: {
            dt: 0.002,
            scale: 160,
            trailLength: 700,
            cameraMode: 'com'
        },
        bodies: PRESET_FIGURE_EIGHT
    }),

    makeOrbitPreset({
        id: 'figure-eight-rotated',
        family: 'Хореографии',
        name: 'Восьмёрка 45°',
        description: 'Та же орбита, повёрнутая на 45°.',
        source: 'Moore / Chenciner / Montgomery',
        settings: {
            dt: 0.002,
            scale: 155,
            trailLength: 700,
            cameraMode: 'com'
        },
        bodies: transformBodiesForScaleAndRotation(PRESET_FIGURE_EIGHT, {
            scale: 1,
            rotation: Math.PI / 4
        })
    }),

    // ===== СЮДА ДОБАВЛЯЙ НОВЫЕ НАСТОЯЩИЕ ХОРЕОГРАФИИ =====

    /*
    makeOrbitPreset({
        id: 'butterfly-I',
        family: 'Хореографии',
        name: 'Butterfly I',
        description: 'Периодическая хореография семейства Butterfly.',
        source: 'Šuvakov–Dmitrašinović',
        settings: {
            dt: 0.001,
            scale: 220,
            trailLength: 1200,
            cameraMode: 'com'
        },
        bodies: buildSymmetricChoreography({
            x: ...,
            y: ...,
            vx: ...,
            vy: ...
        })
    }),

    makeOrbitPreset({
        id: 'moth-I',
        family: 'Хореографии',
        name: 'Moth I',
        description: 'Периодическая хореография семейства Moth.',
        source: 'Šuvakov–Dmitrašinović',
        settings: {
            dt: 0.001,
            scale: 220,
            trailLength: 1200,
            cameraMode: 'com'
        },
        bodies: buildSymmetricChoreography({
            x: ...,
            y: ...,
            vx: ...,
            vy: ...
        })
    }),
    */
];

window.PRESET_FIGURE_EIGHT = PRESET_FIGURE_EIGHT;
window.ORBIT_PRESETS = ORBIT_PRESETS;