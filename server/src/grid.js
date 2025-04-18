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

function initObstacles() {
    return [
        { x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 }, { x: 5, y: 8 }, { x: 6, y: 8 }, { x: 7, y: 8 }, { x: 8, y: 8 }, { x: 9, y: 8 },
        { x: 15, y: 15 }, { x: 16, y: 15 }, { x: 17, y: 15 }, { x: 18, y: 15 }, { x: 18, y: 16 }, { x: 18, y: 17 }, { x: 18, y: 18 }, { x: 18, y: 19 },
        { x: 43, y: 40 }, { x: 43, y: 39 }, { x: 43, y: 38 }, { x: 43, y: 37 }, { x: 42, y: 37 }, { x: 41, y: 37 }, { x: 40, y: 37 }, { x: 39, y: 37 },
        { x: 10, y: 25 }, { x: 11, y: 25 }, { x: 12, y: 25 },
        { x: 25, y: 10 }, { x: 25, y: 11 }, { x: 25, y: 12 },
        { x: 35, y: 22 }, { x: 36, y: 22 }, { x: 37, y: 22 }, { x: 38, y: 22 },
        { x: 20, y: 35 }, { x: 20, y: 36 }, { x: 20, y: 37 },
        { x: 30, y: 30 }, { x: 31, y: 30 }, { x: 32, y: 30 }, { x: 33, y: 30 },
        { x: 12, y: 40 }, { x: 12, y: 41 }, { x: 12, y: 42 },
        { x: 40, y: 12 }, { x: 40, y: 13 }, { x: 40, y: 14 },
        { x: 27, y: 43 }, { x: 28, y: 43 }, { x: 29, y: 43 }
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
