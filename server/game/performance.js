const CONFIG = require("../config");
const { initCreature, getScore } = require("./creature");
const { mutateWeights } = require("./ai");

var topPerformers = [];

function appendTopPerformers(creature) {
    creature.score = getScore(creature);
    topPerformers.push(creature);
    topPerformers.sort((a, b) => b.score - a.score);

    const MAX_LENGTH = Math.max(1, Math.floor(CONFIG.CREATURE_INITIAL_COUNT * CONFIG.TOP_PERFORMERS_RATIO));
    if (topPerformers.length > MAX_LENGTH) {
        topPerformers.length = MAX_LENGTH;
    }
}

async function restartPopulation(state) {
    console.log("Restarting population with top performers...");
    if (topPerformers.length === 0) {
        console.log("No top performers. Initializing from scratch.");
        return;
    }

    state.creatures = [];
    for (let i = 0; i < CONFIG.CREATURE_INITIAL_COUNT; i++) {
        const parent = topPerformers[i % topPerformers.length];
        var weights = Math.random() <= MUTATION_RATE ? await mutateWeights(parent.weights) : parent.weights;
        const offspring = await initCreature(null, null, weights, parent.generation + 1);
        state.creatures.push(offspring);
    }

    console.log("Population restarted.");
}

module.exports = {
    appendTopPerformers,
    restartPopulation,
};
