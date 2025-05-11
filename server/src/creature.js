const CONFIG = require("./config");
const { initWeights } = require("./ai");

let lastCreatureId = 0;

async function initCreature(x = null, y = null, weights = null, generation = 1) {
    if (!weights) {
        weights = await initWeights();
    }

    x = (x !== null) ? x : Math.floor(Math.random() * CONFIG.GRID_SIZE);
    y = (y !== null) ? y : Math.floor(Math.random() * CONFIG.GRID_SIZE);

    var creature = {
        id: lastCreatureId++,
        x,
        y,
        facingAngle: 0.0,
        energy: CONFIG.CREATURE_INITIAL_ENERGY,
        prev: {
            x,
            y,
            facingAngle: 0.0,
            energy: CONFIG.CREATURE_INITIAL_ENERGY
        },
        recentPath: [{ x, y }],
        generation,
        justReproduced: false,
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

module.exports = {
    initCreature,
    getScore
};
