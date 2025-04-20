const CONFIG = require("./config");

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

function initObstacles(state) {
    state.obstacles = [
        { x: 8, y: 10 }, { x: 8, y: 11 }, { x: 8, y: 12 }, { x: 8, y: 13 }, { x: 9, y: 13 }, { x: 10, y: 13 }, { x: 11, y: 13 }, { x: 12, y: 13 },
        { x: 30, y: 6 }, { x: 30, y: 7 }, { x: 30, y: 8 }, { x: 30, y: 9 }, { x: 31, y: 9 }, { x: 32, y: 9 }, { x: 33, y: 9 }, { x: 34, y: 9 },
        { x: 41, y: 25 }, { x: 42, y: 25 }, { x: 43, y: 25 }, { x: 44, y: 25 }, { x: 44, y: 26 }, { x: 44, y: 27 }, { x: 44, y: 28 }, { x: 44, y: 29 },
        { x: 18, y: 40 }, { x: 19, y: 40 }, { x: 20, y: 40 },
        { x: 6, y: 18 }, { x: 6, y: 19 }, { x: 6, y: 20 },
        { x: 32, y: 16 }, { x: 33, y: 16 }, { x: 34, y: 16 }, { x: 35, y: 16 },
        { x: 22, y: 28 }, { x: 22, y: 29 }, { x: 22, y: 30 },
        { x: 14, y: 33 }, { x: 15, y: 33 }, { x: 16, y: 33 }, { x: 17, y: 33 },
        { x: 38, y: 8 }, { x: 38, y: 9 }, { x: 38, y: 10 },
        { x: 10, y: 22 }, { x: 10, y: 23 }, { x: 10, y: 24 },
        { x: 24, y: 44 }, { x: 25, y: 44 }, { x: 26, y: 44 }
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
    getVisibleObstacles,
    isCellOccupied
};
