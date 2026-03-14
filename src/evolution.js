const { initCreature } = require("./creature");
const { mutateWeights } = require("./nn");
const logger = require("./logger");

function appendTopPerformers(creature, state, config) {
    if (creature.id !== undefined) {
        const existing = state.topPerformers.findIndex(p => p.id === creature.id);
        if (existing !== -1) state.topPerformers.splice(existing, 1);
    }

    const copy = {
        id: creature.id,
        generation: creature.generation,
        weights: creature.weights.slice(),
        stats: { ...creature.stats }
    };

    const score = copy.stats.score ?? 0;
    // binary search for insertion point to maintain descending score order
    let lo = 0, hi = state.topPerformers.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if ((state.topPerformers[mid].stats.score ?? 0) > score) lo = mid + 1;
        else hi = mid;
    }
    state.topPerformers.splice(lo, 0, copy);

    if (state.topPerformers.length > config.TOP_PERFORMERS_COUNT) {
        state.topPerformers.length = config.TOP_PERFORMERS_COUNT;
    }
}

async function restartPopulation(state, indexes, config) {
    if (state.topPerformers.length === 0) {
        logger.info("No top performers - initializing from scratch...");
        for (let i = 0; i < config.CREATURE_INITIAL_COUNT; i++) {
            state.creatures.push(await initCreature(state, indexes, config));
        }
        return;
    }

    logger.info("Restarting population with top performers...");
    logger.debug('Top performers scores:', state.topPerformers.map(p => p.stats.score));
    state.creatures = [];
    const topPerformersCount = Math.floor(config.CREATURE_INITIAL_COUNT * config.POPULATION_TOP_RATIO);
    const mutatedCount = Math.floor(config.CREATURE_INITIAL_COUNT * config.POPULATION_MUTATED_RATIO);
    const randomCount = config.CREATURE_INITIAL_COUNT - topPerformersCount - mutatedCount;

    for (let i = 0; i < topPerformersCount; i++) {
        const parent = state.topPerformers[i % state.topPerformers.length];
        const clone = await initCreature(state, indexes, config, null, null, null, parent.weights, parent.generation + 1);
        state.creatures.push(clone);
    }

    for (let i = 0; i < mutatedCount; i++) {
        const parent = state.topPerformers[i % state.topPerformers.length];
        const mutated = mutateWeights(parent.weights, config.MUTATION_RATE, config.MUTATION_STRENGTH);
        const offspring = await initCreature(state, indexes, config, null, null, null, mutated, parent.generation + 1);
        state.creatures.push(offspring);
    }

    for (let i = 0; i < randomCount; i++) {
        state.creatures.push(await initCreature(state, indexes, config));
    }

    logger.info("Population restarted");
}

module.exports = {
    appendTopPerformers,
    restartPopulation,
};
