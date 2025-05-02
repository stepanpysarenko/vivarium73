const CONFIG = require("./config");

function isCellOccupied(x, y, state) {
    return state.food.some(f => f.x === x && f.y === y) ||
        state.obstacles.some(o => o.x === x && o.y === y);
}

function initFood(state) {
    let food = null;
    while (!food || isCellOccupied(food.x, food.y, state)) {
        food = {
            x: Math.floor(Math.random() * (CONFIG.GRID_SIZE - 1)) + 1,
            y: Math.floor(Math.random() * (CONFIG.GRID_SIZE - 1)) + 1
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
        // vertical lines
        { x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 },
        { x: 10, y: 12 }, { x: 10, y: 13 }, { x: 10, y: 14 }, { x: 10, y: 15 },
        { x: 20, y: 8 }, { x: 20, y: 9 }, { x: 20, y: 10 }, { x: 20, y: 11 }, { x: 20, y: 12 },
        { x: 30, y: 20 }, { x: 30, y: 21 }, { x: 30, y: 22 },
        { x: 38, y: 5 }, { x: 38, y: 6 }, { x: 38, y: 7 }, { x: 38, y: 8 },

        // horizontal lines
        { x: 6, y: 18 }, { x: 7, y: 18 }, { x: 8, y: 18 },
        { x: 14, y: 25 }, { x: 15, y: 25 }, { x: 16, y: 25 }, { x: 17, y: 25 },
        { x: 23, y: 15 }, { x: 24, y: 15 }, { x: 25, y: 15 }, { x: 26, y: 15 },
        { x: 33, y: 30 }, { x: 34, y: 30 }, { x: 35, y: 30 },
        { x: 10, y: 35 }, { x: 11, y: 35 }, { x: 12, y: 35 }, { x: 13, y: 35 },

        // L-shapes
        { x: 6, y: 40 }, { x: 7, y: 40 }, { x: 6, y: 41 }, { x: 6, y: 42 },
        { x: 40, y: 10 }, { x: 39, y: 10 }, { x: 40, y: 11 }, { x: 40, y: 12 },
        { x: 36, y: 35 }, { x: 37, y: 35 }, { x: 37, y: 36 }, { x: 37, y: 37 },
        { x: 15, y: 40 }, { x: 16, y: 40 }, { x: 15, y: 41 }, { x: 15, y: 42 }
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
