const CONFIG = require("./config");

const r2Visibility = CONFIG.CREATURE_VISIBILITY_RADIUS ** 2;

function isCellOccupied(x, y, state) {
    return state.food.some(f => f.x === x && f.y === y)
        || state.obstacles.some(o => o.x === x && o.y === y);
}

function getTotalEnergy(state) {
    const creatureEnergy = state.creatures.reduce((sum, c) => sum + c.energy, 0);
    const foodEnergy = state.food.length * CONFIG.FOOD_ENERGY;
    return creatureEnergy + foodEnergy;
}

function getRandomEmptyCell(state) {
    const maxAttempts = CONFIG.GRID_SIZE ** 2 - state.food.length - state.obstacles.length;
    let cell = null;
    let attempts = 0;
    do {
        cell = {
            x: Math.floor(Math.random() * CONFIG.GRID_SIZE),
            y: Math.floor(Math.random() * CONFIG.GRID_SIZE)
        };
        attempts++;
    } while (isCellOccupied(cell.x, cell.y, state) && attempts < maxAttempts);

    return isCellOccupied(cell.x, cell.y, state) ? null : cell;
}

function updateFood(state) {
    while (getTotalEnergy(state) < CONFIG.GRID_TARGET_ENERGY && state.food.length < CONFIG.FOOD_MAX_COUNT) {
        const cell = getRandomEmptyCell(state);
        if (!cell) break;
        state.food.push(cell);
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

function getBorderObstacles() {
    var obstacles = [];
    for (let i = 0; i < CONFIG.GRID_SIZE; i++) {
        obstacles.push({ x: i, y: 0 }, { x: i, y: CONFIG.GRID_SIZE - 1 });
        obstacles.push({ x: 0, y: i }, { x: CONFIG.GRID_SIZE - 1, y: i });
    }
    return obstacles;
}

function isWithinRadius(x1, y1, x2, y2, r2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy <= r2;
}

function getVisibleObjects(objects, x, y) {
    return objects.filter(o => isWithinRadius(o.x, o.y, x, y, r2Visibility));
}

function getVisibleFood(creature, state) {
    return getVisibleObjects(state.food, creature.x, creature.y);
}

function getVisibleCreatures(creature, state) {
    return getVisibleObjects(state.creatures.filter(c => c.id != creature.id), creature.x, creature.y);
}

function getVisibleObstacles(creature, state) {
    const { x: cx, y: cy } = creature;
    const visible = getVisibleObjects(state.obstacles, cx, cy);
    visible.push(...state.borderObstacles.filter(b => isWithinRadius(b.x, b.y, cx, cy, r2Visibility)));
    return visible;
}

module.exports = {
    isCellOccupied,
    getTotalEnergy,
    getRandomEmptyCell,
    updateFood,
    getObstacles,
    getBorderObstacles,
    isWithinRadius,
    getVisibleFood,
    getVisibleCreatures,
    getVisibleObstacles
};
