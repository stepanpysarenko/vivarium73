const CONFIG = require("./config");
const { initCreature, getScore } = require("./creature");
const { mutateWeights } = require("./ai");

function appendTopPerformers(creature, state) {
    creature.score = getScore(creature);
    state.topPerformers.push(creature);
    state.topPerformers.sort((a, b) => b.score - a.score);

    if (state.topPerformers.length > CONFIG.TOP_PERFORMERS_COUNT) {
        state.topPerformers.length = CONFIG.TOP_PERFORMERS_COUNT;
    }
}

async function restartPopulation(state) {
    console.log("Restarting population with top performers...");
    if (state.topPerformers.length === 0) {
        console.log("No top performers. Initializing from scratch.");
        return;
    }

    console.log('Top performers score:', state.topPerformers.map(p => p.score));
    state.creatures = [];
    for (let i = 0; i < CONFIG.CREATURE_INITIAL_COUNT; i++) {
        const parent = state.topPerformers[i % state.topPerformers.length];
        var weights = Math.random() <= CONFIG.MUTATION_CHANCE ? await mutateWeights(parent.weights) : parent.weights;
        const offspring = await initCreature(null, null, weights, parent.generation + 1);
        state.creatures.push(offspring);
    }

    console.log("Population restarted.");
}

module.exports = {
    appendTopPerformers,
    restartPopulation,
};
