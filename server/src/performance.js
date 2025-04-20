const CONFIG = require("./config");
const { initCreature, getScore } = require("./creature");
const { initWeights, mutateWeights } = require("./ai");

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
        let weights;
        let parent;
        if (Math.random() < (1 - CONFIG.RESTART_RANDOM_WEIGHTS_CHANCE) && state.topPerformers.length > 0) {
            parent = state.topPerformers[i % state.topPerformers.length];
            weights = await mutateWeights(parent.weights);
        } else {
            weights = await initWeights();
        }
        const offspring = await initCreature(null, null, weights, parent ? parent.generation + 1 : 1);
        state.creatures.push(offspring);
    }

    console.log("Population restarted.");
}

module.exports = {
    appendTopPerformers,
    restartPopulation,
};
