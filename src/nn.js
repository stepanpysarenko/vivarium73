const INPUT_SIZE = 17;
const HIDDEN_SIZE = 9;
const OUTPUT_SIZE = 2;
const HIDDEN_WEIGHT_COUNT = HIDDEN_SIZE * INPUT_SIZE;
const OUTPUT_WEIGHT_COUNT = OUTPUT_SIZE * HIDDEN_SIZE;
const EXPECTED_WEIGHT_COUNT = HIDDEN_WEIGHT_COUNT + OUTPUT_WEIGHT_COUNT;

function xavierUniform(fanIn, fanOut, count) {
    const limit = Math.sqrt(6 / (fanIn + fanOut));
    const weights = new Array(count);
    for (let i = 0; i < count; i++) {
        weights[i] = Math.random() * 2 * limit - limit;
    }
    return weights;
}

function initWeights() {
    const hidden = xavierUniform(INPUT_SIZE, HIDDEN_SIZE, HIDDEN_WEIGHT_COUNT);
    const output = xavierUniform(HIDDEN_SIZE, OUTPUT_SIZE, OUTPUT_WEIGHT_COUNT);
    return hidden.concat(output);
}

function clamp1(x) {
    return x < -1 ? -1 : x > 1 ? 1 : x;
}

function mutateWeights(weights) {
    return weights.map(w => clamp1(w + (Math.random() - 0.5) * 0.1));
}

function wrapAngle(angle) {
    return ((angle + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
}

function influenceVector(x, y, targets, repel) {
    let vx = 0, vy = 0;
    for (const t of targets) {
        const dx = repel ? (x - t.x) : (t.x - x);
        const dy = repel ? (y - t.y) : (t.y - y);
        const distSq = dx * dx + dy * dy;
        if (distSq > 0) {
            const strength = 1 / distSq;
            vx += dx * strength;
            vy += dy * strength;
        }
    }
    const mag = Math.hypot(vx, vy);
    if (mag > 0) {
        vx /= mag;
        vy /= mag;
    }
    return { x: vx, y: vy };
}

function angleAndMagnitude(x, y, orientation) {
    return {
        angle: wrapAngle(Math.atan2(y, x) - orientation) / Math.PI,
        magnitude: Math.min(Math.hypot(x, y) / Math.SQRT2, 1)
    };
}

function angleDelta(current, prev) {
    return wrapAngle(current - prev) / Math.PI;
}

function netMovementVector(path, visibilityRadius) {
    if (path.length < 2 || !visibilityRadius) return { x: 0, y: 0 };
    const dx = path[path.length - 1].x - path[0].x;
    const dy = path[path.length - 1].y - path[0].y;
    return { x: Math.tanh(dx / visibilityRadius), y: Math.tanh(dy / visibilityRadius) };
}

function buildInputs(c, food, obstacles, creatures, config) {
    const { CREATURE_MAX_ENERGY: maxEnergy, CREATURE_VISIBILITY_RADIUS: visibilityRadius } = config;

    const foodVec = influenceVector(c.x, c.y, food, false);
    const obsVec = influenceVector(c.x, c.y, obstacles, true);
    const creatVec = influenceVector(c.x, c.y, creatures, true);
    const netVec = netMovementVector(c.recentPath, visibilityRadius);

    const foodDir = angleAndMagnitude(foodVec.x, foodVec.y, c.angle);
    const obsDir = angleAndMagnitude(obsVec.x, obsVec.y, c.angle);
    const creatDir = angleAndMagnitude(creatVec.x, creatVec.y, c.angle);
    const netDir = angleAndMagnitude(netVec.x, netVec.y, c.angle);
    const moveDir = angleAndMagnitude(c.x - c.prev.x, c.y - c.prev.y, c.angle);

    return [
        2 * (c.energy / maxEnergy) - 1,                 // energy level [0]
        clamp1((c.energy - c.prev.energy) / maxEnergy), // energy delta [1]
        c.justReproduced ? 1.0 : -1.0,                  // just reproduced [2]
        foodDir.angle, foodDir.magnitude,               // food dir [3,4]
        obsDir.angle, obsDir.magnitude,                 // obstacle dir [5,6]
        creatDir.angle, creatDir.magnitude,             // creature dir [7,8]
        netDir.angle, netDir.magnitude,                 // net movement [9,10]
        angleDelta(c.angle, c.prev.angle),              // angle delta [11]
        moveDir.angle, moveDir.magnitude,               // last move dir [12,13]
        wrapAngle(c.wanderAngle - c.angle) / Math.PI,   // wander angle [14]
        Math.min(c.wanderStrength / Math.SQRT2, 1),     // wander strength [15]
        1.0,                                            // bias [16]
    ];
}

function think(c, food, obstacles, creatures, config) {
    const inputs = buildInputs(c, food, obstacles, creatures, config);

    const weights = c.weights;
    if (weights.length !== EXPECTED_WEIGHT_COUNT) {
        throw new Error(`Expected ${EXPECTED_WEIGHT_COUNT} weights, got ${weights.length}`);
    }

    // Hidden layer: tanh(W_hidden * inputs)
    const hidden = new Float64Array(HIDDEN_SIZE);
    for (let i = 0; i < HIDDEN_SIZE; i++) {
        let sum = 0;
        const offset = i * INPUT_SIZE;
        for (let j = 0; j < INPUT_SIZE; j++) {
            sum += weights[offset + j] * inputs[j];
        }
        hidden[i] = Math.tanh(sum);
    }

    // Output layer: tanh(W_output * hidden)
    const output = new Float64Array(OUTPUT_SIZE);
    for (let i = 0; i < OUTPUT_SIZE; i++) {
        let sum = 0;
        const offset = HIDDEN_WEIGHT_COUNT + i * HIDDEN_SIZE;
        for (let j = 0; j < HIDDEN_SIZE; j++) {
            sum += weights[offset + j] * hidden[j];
        }
        output[i] = Math.tanh(sum);
    }

    return {
        id: c.id,
        angleDelta: output[0] * config.CREATURE_MAX_TURN_ANGLE_RADIANS,
        speed: ((output[1] + 1) / 2) * config.CREATURE_MAX_SPEED
    };
}

module.exports = { initWeights, mutateWeights, think };

if (process.env.NODE_ENV === 'test') {
    Object.assign(module.exports, { EXPECTED_WEIGHT_COUNT, INPUT_SIZE, HIDDEN_SIZE, OUTPUT_SIZE, buildInputs });
}
