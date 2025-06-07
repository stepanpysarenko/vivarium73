const CONFIG = require("./config");
const { initCreature, getScore, getNextCreatureId } = require("./creature");
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
    if (state.topPerformers.length === 0) {
        console.log("No top performers - initializing from scratch...");
        for (let i = 0; i < CONFIG.CREATURE_INITIAL_COUNT; i++) {
            state.creatures.push(await initCreature(getNextCreatureId(state)));
        }
        return;
    }

    console.log("Restarting population with top performers...");
    console.log('Top performers scores:', state.topPerformers.map(p => p.score));
    state.creatures = [];
    const topPerformersCount = Math.floor(CONFIG.CREATURE_INITIAL_COUNT * CONFIG.POPULATION_TOP_RATIO);
    const mutatedCount = Math.floor(CONFIG.CREATURE_INITIAL_COUNT * CONFIG.POPULATION_MUTATED_RATIO);
    const randomCount = CONFIG.CREATURE_INITIAL_COUNT - topPerformersCount - mutatedCount;

    for (let i = 0; i < topPerformersCount; i++) {
        const parent = state.topPerformers[i % state.topPerformers.length];
        const clone = await initCreature(getNextCreatureId(state), null, null, parent.weights, parent.generation + 1);
        state.creatures.push(clone);
    }

    for (let i = 0; i < mutatedCount; i++) {
        const parent = state.topPerformers[i % state.topPerformers.length];
        const mutated = await mutateWeights(parent.weights);
        const offspring = await initCreature(getNextCreatureId(state), null, null, mutated, parent.generation + 1);
        state.creatures.push(offspring);
    }

    for (let i = 0; i < randomCount; i++) {
        state.creatures.push(await initCreature(getNextCreatureId(state)));
    }

    console.log("Population restarted");
}

module.exports = {
    appendTopPerformers,
    restartPopulation,
};
