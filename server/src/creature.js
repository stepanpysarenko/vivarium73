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
    if (!state.creatures || state.creatures.length === 0) return 0;
    let maxId = Math.max(...state.creatures.map(c => c.id));
    return maxId + 1;
}   

module.exports = {
    initCreature,
    getScore,
    getNextCreatureId
};
