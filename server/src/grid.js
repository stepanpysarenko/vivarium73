const CONFIG = require("./config");

function isCellOccupied(x, y, state) {
    return state.food.some(f => f.x === x && f.y === y) ||
        state.obstacles.some(o => o.x === x && o.y === y);
}

function initFood(state) {
    let food = null;
    while (!food || isCellOccupied(food.x, food.y, state)) {
        food = {
            x: Math.floor(Math.random() * (CONFIG.GRID_SIZE - 2)) + 1,
            y: Math.floor(Math.random() * (CONFIG.GRID_SIZE - 2)) + 1
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

function getVisibleCreatures(creature, state) {
    return state.creatures.filter(c =>
        Math.hypot(c.x - creature.x, c.y - creature.y) <= CONFIG.CREATURE_VISIBILITY_RADIUS
    );
}

module.exports = {
    initObstacles,
    updateFood,
    getVisibleFood,
    getVisibleObstacles,
    getVisibleCreatures,
    isCellOccupied
};
