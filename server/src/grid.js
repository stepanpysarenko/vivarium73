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
        // horizontal lines
        ...Array.from({ length: 8 }, (_, i) => ({ x: 3 + i, y: 3 })),
        ...Array.from({ length: 8 }, (_, i) => ({ x: 10 + i, y: 10 })),
        ...Array.from({ length: 9 }, (_, i) => ({ x: 20 + i, y: 25 })),
        ...Array.from({ length: 10 }, (_, i) => ({ x: 5 + i, y: 40 })),
        ...Array.from({ length: 8 }, (_, i) => ({ x: 30 + i, y: 5 })),

        // vertical lines
        ...Array.from({ length: 8 }, (_, i) => ({ x: 12, y: 2 + i })),
        ...Array.from({ length: 9 }, (_, i) => ({ x: 22, y: 10 + i })),
        ...Array.from({ length: 8 }, (_, i) => ({ x: 18, y: 35 + i })),
        ...Array.from({ length: 10 }, (_, i) => ({ x: 35, y: 15 + i })),
        ...Array.from({ length: 10 }, (_, i) => ({ x: 38, y: 17 + i })),

        // L-shapes
        ...Array.from({ length: 6 }, (_, i) => ({ x: 45 + i, y: 5 })),
        ...Array.from({ length: 6 }, (_, i) => ({ x: 50, y: 5 + i })),

        ...Array.from({ length: 5 }, (_, i) => ({ x: 25 + i, y: 45 })),
        ...Array.from({ length: 5 }, (_, i) => ({ x: 30, y: 45 + i })),

        ...Array.from({ length: 4 }, (_, i) => ({ x: 38 + i, y: 12 })),
        ...Array.from({ length: 4 }, (_, i) => ({ x: 41, y: 12 + i })),

        ...Array.from({ length: 6 }, (_, i) => ({ x: 38 + i, y: 33 })),
        ...Array.from({ length: 7 }, (_, i) => ({ x: 44, y: 33 + i })),

        // room
        ...Array.from({ length: 7 }, (_, i) => ({ x: 7 + i, y: 18 })),
        ...Array.from({ length: 6 }, (_, i) => ({ x: 13, y: 18 + i })),
        ...Array.from({ length: 8 }, (_, i) => ({ x: 5, y: 18 + i })),
        ...Array.from({ length: 6 }, (_, i) => ({ x: 6 + i, y: 25 })),
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
