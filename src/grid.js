function buildCreatureIndex(creatures) {
    const map = new Map();
    for (const c of creatures) {
        const key = `${Math.floor(c.x)},${Math.floor(c.y)}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(c);
    }
    return map;
}

function buildStateIndexes(state) {
    state.obstacleMap = new Map(state.obstacles.map(o => [`${o.x},${o.y}`, o]));
    state.foodMap = new Map(state.food.map(f => [`${f.x},${f.y}`, f]));
    state.creatureMap = buildCreatureIndex(state.creatures || []);
}

function isCellOccupied(x, y, state) {
    const key = `${x},${y}`;
    return state.foodMap.has(key) || state.obstacleMap.has(key);
}

function getTotalEnergy(state, config) {
    const creatureEnergy = state.creatures.reduce((sum, c) => sum + c.energy, 0);
    const foodEnergy = state.food.length * config.FOOD_ENERGY;
    return creatureEnergy + foodEnergy;
}

function getRandomEmptyCell(state, config) {
    const maxAttempts = config.GRID_SIZE ** 2 - state.food.length - state.obstacles.length;
    let cell = null;
    let attempts = 0;
    do {
        cell = {
            x: Math.floor(Math.random() * config.GRID_SIZE),
            y: Math.floor(Math.random() * config.GRID_SIZE)
        };
        attempts++;
    } while (isCellOccupied(cell.x, cell.y, state) && attempts < maxAttempts);

    return isCellOccupied(cell.x, cell.y, state) ? null : cell;
}

function updateFood(state, config) {
    while (getTotalEnergy(state, config) < config.GRID_TARGET_ENERGY && state.food.length < config.FOOD_MAX_COUNT) {
        const cell = getRandomEmptyCell(state, config);
        if (!cell) break;
        state.food.push(cell);
        state.foodMap.set(`${cell.x},${cell.y}`, cell);
    }
}

function getObstacles() {
    return [
        // vertical segments (6)
        { x: 6, y: 6 }, { x: 6, y: 7 }, { x: 6, y: 8 }, { x: 6, y: 9 },
        { x: 22, y: 6 }, { x: 22, y: 7 }, { x: 22, y: 8 }, { x: 22, y: 9 },
        { x: 6, y: 28 }, { x: 6, y: 29 }, { x: 6, y: 30 }, { x: 6, y: 31 },
        { x: 22, y: 36 }, { x: 22, y: 37 }, { x: 22, y: 38 }, { x: 22, y: 39 },
        { x: 38, y: 28 }, { x: 38, y: 29 }, { x: 38, y: 30 }, { x: 38, y: 31 },
        { x: 42, y: 18 }, { x: 42, y: 19 }, { x: 42, y: 20 }, { x: 42, y: 21 },

        // horizontal segments (5)
        { x: 10, y: 12 }, { x: 11, y: 12 }, { x: 12, y: 12 }, { x: 13, y: 12 },
        { x: 28, y: 12 }, { x: 29, y: 12 }, { x: 30, y: 12 }, { x: 31, y: 12 },
        { x: 10, y: 22 }, { x: 11, y: 22 }, { x: 12, y: 22 }, { x: 13, y: 22 },
        { x: 28, y: 22 }, { x: 29, y: 22 }, { x: 30, y: 22 }, { x: 31, y: 22 },
        { x: 18, y: 42 }, { x: 19, y: 42 }, { x: 20, y: 42 }, { x: 21, y: 42 },

        // l-shapes (4, balanced corners)
        { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 4, y: 5 }, { x: 4, y: 6 },
        { x: 44, y: 4 }, { x: 43, y: 4 }, { x: 44, y: 5 }, { x: 44, y: 6 },
        { x: 4, y: 44 }, { x: 5, y: 44 }, { x: 4, y: 43 }, { x: 4, y: 42 },
        { x: 44, y: 44 }, { x: 43, y: 44 }, { x: 44, y: 43 }, { x: 44, y: 42 },

        // bends (2)
        { x: 17, y: 17 }, { x: 18, y: 17 }, { x: 19, y: 17 }, { x: 20, y: 17 }, { x: 20, y: 18 }, { x: 20, y: 19 },
        { x: 30, y: 32 }, { x: 30, y: 33 }, { x: 30, y: 34 }, { x: 31, y: 34 }, { x: 32, y: 34 }, { x: 33, y: 34 }
    ];
}

function getBorderObstacles(config) {
    const obstacles = [];
    for (let i = 0; i < config.GRID_SIZE; i++) {
        obstacles.push({ x: i, y: 0 }, { x: i, y: config.GRID_SIZE - 1 });
        obstacles.push({ x: 0, y: i }, { x: config.GRID_SIZE - 1, y: i });
    }
    return obstacles;
}

function isWithinRadius(x1, y1, x2, y2, r2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy <= r2;
}

function isWithinFOV(creatureX, creatureY, creatureAngle, targetX, targetY, fovRadians) {
    const dx = targetX - creatureX;
    const dy = targetY - creatureY;
    const angleToTarget = Math.atan2(dy, dx);

    let angleDiff = angleToTarget - creatureAngle;

    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    return Math.abs(angleDiff) <= fovRadians / 2;
}

function getVisibleObjects(objects, creature, config) {
    const r2Visibility = config.CREATURE_VISIBILITY_RADIUS ** 2;
    const { x, y, angle } = creature;
    const fov = config.CREATURE_VISIBILITY_FOV_RADIANS;

    return objects.filter(obj => {
        if (!isWithinRadius(obj.x, obj.y, x, y, r2Visibility)) {
            return false;
        }
        return isWithinFOV(x, y, angle, obj.x, obj.y, fov);
    });
}

function getVisibleFood(creature, state, config) {
    return getVisibleObjects(state.food, creature, config);
}

function getVisibleCreatures(creature, state, config) {
    const otherCreatures = state.creatures.filter(c => c.id !== creature.id);
    return getVisibleObjects(otherCreatures, creature, config);
}

function getVisibleObstacles(creature, state, config) {
    const allObstacles = [...state.obstacles, ...state.borderObstacles];
    return getVisibleObjects(allObstacles, creature, config);
}

module.exports = {
    buildCreatureIndex,
    buildStateIndexes,
    isCellOccupied,
    getRandomEmptyCell,
    updateFood,
    getObstacles,
    getBorderObstacles,
    isWithinRadius,
    isWithinFOV,
    getVisibleFood,
    getVisibleCreatures,
    getVisibleObstacles
};
