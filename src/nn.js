const { getVisibleFood, getVisibleObstacles, getVisibleCreatures } = require("./grid");

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

function mutateWeights(weights) {
    return weights.map(w =>
        Math.max(-1, Math.min(1, w + (Math.random() - 0.5) * 0.1))
    );
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

function think(c, food, obstacles, creatures, config) {
    const maxEnergy = config.CREATURE_MAX_ENERGY;
    const maxTurnAngle = config.CREATURE_MAX_TURN_ANGLE_RADIANS;
    const maxSpeed = config.CREATURE_MAX_SPEED;
    const visibilityRadius = config.CREATURE_VISIBILITY_RADIUS;

    const energyLevel = 2 * (c.energy / maxEnergy) - 1;
    const energyDx = Math.max(-1, Math.min(1, (c.energy - c.prev.energy) / maxEnergy));
    const justReproduced = c.justReproduced ? 1.0 : -1.0;

    const foodVec  = influenceVector(c.x, c.y, food, false);
    const foodDir  = angleAndMagnitude(foodVec.x, foodVec.y, c.angle);

    const obsVec   = influenceVector(c.x, c.y, obstacles, true);
    const obsDir   = angleAndMagnitude(obsVec.x, obsVec.y, c.angle);

    const creatVec = influenceVector(c.x, c.y, creatures, true);
    const creatDir = angleAndMagnitude(creatVec.x, creatVec.y, c.angle);

    const netVec   = netMovementVector(c.recentPath, visibilityRadius);
    const netDir   = angleAndMagnitude(netVec.x, netVec.y, c.angle);

    const moveDir  = angleAndMagnitude(c.x - c.prev.x, c.y - c.prev.y, c.angle);

    const angleDeltaVal = angleDelta(c.angle, c.prev.angle);

    const wanderAngle     = wrapAngle(c.wanderAngle - c.angle) / Math.PI;
    const wanderMagnitude = Math.min(c.wanderStrength / Math.SQRT2, 1);

    const inputs = [
        energyLevel, energyDx, justReproduced,
        foodDir.angle,  foodDir.magnitude,
        obsDir.angle,   obsDir.magnitude,
        creatDir.angle, creatDir.magnitude,
        netDir.angle,   netDir.magnitude,
        angleDeltaVal,
        moveDir.angle,  moveDir.magnitude,
        wanderAngle, wanderMagnitude,
        1.0
    ];

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
        angleDelta: output[0] * maxTurnAngle,
        speed: ((output[1] + 1) / 2) * maxSpeed
    };
}

function getMovements(state, config) {
    return state.creatures.map(c => think(
        c,
        getVisibleFood(c, state, config),
        getVisibleObstacles(c, state, config),
        getVisibleCreatures(c, state, config),
        config
    ));
}

module.exports = { initWeights, mutateWeights, getMovements };

if (process.env.NODE_ENV === 'test') {
    Object.assign(module.exports, { EXPECTED_WEIGHT_COUNT, INPUT_SIZE, HIDDEN_SIZE, OUTPUT_SIZE });
}
