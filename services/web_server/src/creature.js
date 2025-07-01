const CONFIG = require("./config");
const { initWeights } = require("./nn");
const { getRandomEmptyCell } = require("./grid");

async function initCreature(state, x = null, y = null, angle = 0.0, weights = null, generation = 1) {
    if (x === null || y === null) {
        const cell = getRandomEmptyCell(state);
        x = cell.x;
        y = cell.y;
    } else {
        x = Math.floor(Math.random() * CONFIG.GRID_SIZE);
        y = Math.floor(Math.random() * CONFIG.GRID_SIZE);
    }

    angle = angle !== null ? angle : (Math.random() * 2 * Math.PI) - Math.PI;

    if (!weights) {
        weights = await initWeights();
    }

    var creature = {
        id: getNextCreatureId(state),
        x,
        y,
        angle,
        energy: CONFIG.CREATURE_INITIAL_ENERGY,
        prev: {
            x,
            y,
            angle,
            energy: CONFIG.CREATURE_INITIAL_ENERGY
        },
        recentPath: [{ x, y }],
        generation,
        justReproduced: false,
        updatesToFlash: 0,
        weights,
        stats: {
            updatesSurvived: 0,
            totalFoodCollected: 0
        }
    };

    return creature;
}

function getScore(creature) {
    return creature.stats.totalFoodCollected / Math.max(1, creature.stats.updatesSurvived);
}

function getNextCreatureId(state) {
    state.lastCreatureId++;
    return state.lastCreatureId;
}

module.exports = {
    initCreature,
    getScore
};
