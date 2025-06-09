const CONFIG = require("./config");
const { initWeights } = require("./ai");

async function initCreature(id, x = null, y = null, weights = null, generation = 1) {
    if (!weights) {
        weights = await initWeights();
    }

    x = (x !== null) ? x : Math.floor(Math.random() * CONFIG.GRID_SIZE);
    y = (y !== null) ? y : Math.floor(Math.random() * CONFIG.GRID_SIZE);

    var creature = {
        id,
        x,
        y,
        angle: 0.0,
        energy: CONFIG.CREATURE_INITIAL_ENERGY,
        prev: {
            x,
            y,
            angle: 0.0,
            energy: CONFIG.CREATURE_INITIAL_ENERGY
        },
        recentPath: [{ x, y }],
        generation,
        justReproduced: false,
        updatesToFlash: 0,
        weights,
        stats: {
            turnsSurvived: 0,
            totalFoodCollected: 0
        }
    };

    return creature;
}

function getScore(creature) {
    return creature.stats.totalFoodCollected / Math.max(1, creature.stats.turnsSurvived);
}

function getNextCreatureId(state) {
    state.lastCreatureId++;
    return state.lastCreatureId;
}

module.exports = {
    initCreature,
    getScore,
    getNextCreatureId
};
