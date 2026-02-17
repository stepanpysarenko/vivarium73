const { getVisibleFood, getVisibleObstacles, getVisibleCreatures } = require("./grid");

const INPUT_SIZE = 17;
const HIDDEN_SIZE = 9;
const OUTPUT_SIZE = 2;
const HIDDEN_WEIGHT_COUNT = HIDDEN_SIZE * INPUT_SIZE;
const OUTPUT_WEIGHT_COUNT = OUTPUT_SIZE * HIDDEN_SIZE;
const EXPECTED_WEIGHT_COUNT = HIDDEN_WEIGHT_COUNT + OUTPUT_WEIGHT_COUNT;
const SQRT2 = Math.SQRT2;

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
    return [vx, vy];
}

function angleAndMagnitude(x, y, orientation) {
    const angle = Math.atan2(y, x);
    const relAngle = wrapAngle(angle - orientation);
    const magnitude = Math.hypot(x, y);
    return [relAngle / Math.PI, Math.min(magnitude / SQRT2, 1)];
}

function angleDelta(current, prev) {
    return wrapAngle(current - prev) / Math.PI;
}

function netMovementVector(path, visibilityRadius) {
    if (path.length < 2) return [0, 0];
    const dx = path[path.length - 1].x - path[0].x;
    const dy = path[path.length - 1].y - path[0].y;
    return [Math.tanh(dx / visibilityRadius), Math.tanh(dy / visibilityRadius)];
}

function think(creature, config) {
    const maxEnergy = config.CREATURE_MAX_ENERGY;
    const maxTurnAngle = config.CREATURE_MAX_TURN_ANGLE_RADIANS;
    const maxSpeed = config.CREATURE_MAX_SPEED;
    const visibilityRadius = config.CREATURE_VISIBILITY_RADIUS;

    const energyLevel = 2 * (creature.energy / maxEnergy) - 1;
    const energyDx = Math.max(-1, Math.min(1, (creature.energy - creature.prevEnergy) / maxEnergy));
    const justReproduced = creature.justReproduced ? 1.0 : -1.0;

    const [fx, fy] = influenceVector(creature.x, creature.y, creature.food, false);
    const [foodAngle, foodMagnitude] = angleAndMagnitude(fx, fy, creature.angle);

    const [ox, oy] = influenceVector(creature.x, creature.y, creature.obstacles, true);
    const [obstacleAngle, obstacleMagnitude] = angleAndMagnitude(ox, oy, creature.angle);

    const [cx, cy] = influenceVector(creature.x, creature.y, creature.creatures, true);
    const [creatureAngle, creatureMagnitude] = angleAndMagnitude(cx, cy, creature.angle);

    const [netDx, netDy] = netMovementVector(creature.recentPath, visibilityRadius);
    const [netAngle, netMagnitude] = angleAndMagnitude(netDx, netDy, creature.angle);

    const moveDx = creature.x - creature.prevX;
    const moveDy = creature.y - creature.prevY;
    const [moveAngle, moveMagnitude] = angleAndMagnitude(moveDx, moveDy, creature.angle);

    const angleDeltaVal = angleDelta(creature.angle, creature.prevAngle);

    const wanderAngle = wrapAngle(creature.wanderAngle - creature.angle) / Math.PI;
    const wanderMagnitude = Math.min(creature.wanderStrength / SQRT2, 1);

    const inputs = [
        energyLevel, energyDx, justReproduced,
        foodAngle, foodMagnitude,
        obstacleAngle, obstacleMagnitude,
        creatureAngle, creatureMagnitude,
        netAngle, netMagnitude,
        angleDeltaVal,
        moveAngle, moveMagnitude,
        wanderAngle, wanderMagnitude,
        1.0
    ];

    const weights = creature.weights;
    if (weights.length !== EXPECTED_WEIGHT_COUNT) {
        throw new Error(`Expected ${EXPECTED_WEIGHT_COUNT} weights, got ${weights.length}`);
    }

    // Hidden layer: tanh(W_hidden * inputs)
    const hidden = new Array(HIDDEN_SIZE);
    for (let i = 0; i < HIDDEN_SIZE; i++) {
        let sum = 0;
        const offset = i * INPUT_SIZE;
        for (let j = 0; j < INPUT_SIZE; j++) {
            sum += weights[offset + j] * inputs[j];
        }
        hidden[i] = Math.tanh(sum);
    }

    // Output layer: tanh(W_output * hidden)
    const output = new Array(OUTPUT_SIZE);
    for (let i = 0; i < OUTPUT_SIZE; i++) {
        let sum = 0;
        const offset = HIDDEN_WEIGHT_COUNT + i * HIDDEN_SIZE;
        for (let j = 0; j < HIDDEN_SIZE; j++) {
            sum += weights[offset + j] * hidden[j];
        }
        output[i] = Math.tanh(sum);
    }

    return {
        id: creature.id,
        angleDelta: output[0] * maxTurnAngle,
        speed: ((output[1] + 1) / 2) * maxSpeed
    };
}

function getMovements(state, config) {
    return state.creatures.map(c => think({
        id: c.id,
        x: c.x,
        y: c.y,
        angle: c.angle,
        wanderAngle: c.wanderAngle,
        wanderStrength: c.wanderStrength,
        energy: c.energy,
        prevX: c.prev.x,
        prevY: c.prev.y,
        prevAngle: c.prev.angle,
        recentPath: c.recentPath,
        prevEnergy: c.prev.energy,
        justReproduced: c.justReproduced,
        weights: c.weights,
        food: getVisibleFood(c, state, config),
        obstacles: getVisibleObstacles(c, state, config),
        creatures: getVisibleCreatures(c, state, config)
    }, config));
}

module.exports = {
    initWeights,
    mutateWeights,
    getMovements
};

if (process.env.NODE_ENV === 'test') {
    module.exports.EXPECTED_WEIGHT_COUNT = EXPECTED_WEIGHT_COUNT;
    module.exports.INPUT_SIZE = INPUT_SIZE;
    module.exports.HIDDEN_SIZE = HIDDEN_SIZE;
    module.exports.OUTPUT_SIZE = OUTPUT_SIZE;
}
