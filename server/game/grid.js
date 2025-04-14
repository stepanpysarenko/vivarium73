const CONFIG = require("../config");

function isCellOccupied(x, y, state) {
    return state.food.some(f => f.x === x && f.y === y) ||
        state.obstacles.some(o => o.x === x && o.y === y);
}

function initFood(state) {
    let food = null;
    while (!food || isCellOccupied(food.x, food.y, state)) {
        food = {
            x: Math.floor(Math.random() * CONFIG.GRID_SIZE),
            y: Math.floor(Math.random() * CONFIG.GRID_SIZE)
        };
    }
    return food;
}

function updateFood(state) {
    const totalEnergy = state.creatures.reduce((sum, c) => sum + c.energy, 0);
    while ((totalEnergy + state.food.length * CONFIG.FOOD_ENERGY < CONFIG.TOTAL_ENERGY) &&
        state.food.length < CONFIG.FOOD_MAX_COUNT) {
        state.food.push(initFood(state));
    }
}

function initObstacles() {
    return [
        { x: 10, y: 10 }, { x: 11, y: 11 }, { x: 12, y: 12 }, { x: 13, y: 13 },
        { x: 35, y: 5 }, { x: 35, y: 6 }, { x: 35, y: 7 },
        { x: 5, y: 40 }, { x: 6, y: 40 }, { x: 7, y: 40 }, { x: 8, y: 40 }, { x: 9, y: 40 }, { x: 10, y: 40 },
        { x: 18, y: 32 }, { x: 19, y: 31 }, { x: 20, y: 30 }, { x: 21, y: 29 },
        { x: 25, y: 10 }, { x: 25, y: 11 }, { x: 25, y: 12 }, { x: 25, y: 13 }, { x: 25, y: 14 },
        { x: 40, y: 20 }, { x: 41, y: 20 }, { x: 42, y: 20 },
        { x: 38, y: 38 }, { x: 39, y: 39 }, { x: 40, y: 40 }
    ];
}

function getVisibleFood(creature, state) {
    return state.food.filter(f =>
        Math.hypot(f.x - creature.x, f.y - creature.y) <= CONFIG.CREATURE_VISIBILITY_RADIUS
    );
}

function getVisibleObstacles(creature, state) {
    const obstacles = state.obstacles.filter(o =>
        Math.hypot(o.x - creature.x, o.y - creature.y) <= CONFIG.CREATURE_VISIBILITY_RADIUS
    );

    // add borders
    for (let i = 0; i < CONFIG.GRID_SIZE; i++) {
        if (Math.hypot(i - creature.x, 0 - creature.y) <= CONFIG.CREATURE_VISIBILITY_RADIUS)
            obstacles.push({ x: i, y: 0 });
        if (Math.hypot(i - creature.x, CONFIG.GRID_SIZE - 1 - creature.y) <= CONFIG.CREATURE_VISIBILITY_RADIUS)
            obstacles.push({ x: i, y: CONFIG.GRID_SIZE - 1 });
        if (Math.hypot(0 - creature.x, i - creature.y) <= CONFIG.CREATURE_VISIBILITY_RADIUS)
            obstacles.push({ x: 0, y: i });
        if (Math.hypot(CONFIG.GRID_SIZE - 1 - creature.x, i - creature.y) <= CONFIG.CREATURE_VISIBILITY_RADIUS)
            obstacles.push({ x: CONFIG.GRID_SIZE - 1, y: i });
    }

    return obstacles;
}

module.exports = {
    initObstacles,
    updateFood,
    getVisibleFood,
    getVisibleObstacles
};
