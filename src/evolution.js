const { initCreature } = require("./creature");
const { mutateWeights } = require("./nn");
const logger = require("./logger");

function appendTopPerformers(creature, state, config) {
    const score = creature.stats.score ?? 0;
    // binary search for insertion point to maintain descending score order
    let lo = 0, hi = state.topPerformers.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if ((state.topPerformers[mid].stats.score ?? 0) > score) lo = mid + 1;
        else hi = mid;
    }
    state.topPerformers.splice(lo, 0, creature);

    if (state.topPerformers.length > config.TOP_PERFORMERS_COUNT) {
        state.topPerformers.length = config.TOP_PERFORMERS_COUNT;
    }
}

async function restartPopulation(state, config) {
    if (state.topPerformers.length === 0) {
        logger.info("No top performers - initializing from scratch...");
        for (let i = 0; i < config.CREATURE_INITIAL_COUNT; i++) {
            state.creatures.push(await initCreature(state, config));
        }
        return;
    }

    logger.info("Restarting population with top performers...");
    logger.info('Top performers scores:', state.topPerformers.map(p => p.stats.score));
    state.creatures = [];
    const topPerformersCount = Math.floor(config.CREATURE_INITIAL_COUNT * config.POPULATION_TOP_RATIO);
    const mutatedCount = Math.floor(config.CREATURE_INITIAL_COUNT * config.POPULATION_MUTATED_RATIO);
    const randomCount = config.CREATURE_INITIAL_COUNT - topPerformersCount - mutatedCount;

    for (let i = 0; i < topPerformersCount; i++) {
        const parent = state.topPerformers[i % state.topPerformers.length];
        const clone = await initCreature(state, config, null, null, null, parent.weights, parent.generation + 1);
        state.creatures.push(clone);
    }

    for (let i = 0; i < mutatedCount; i++) {
        const parent = state.topPerformers[i % state.topPerformers.length];
        const mutated = await mutateWeights(parent.weights);
        const offspring = await initCreature(state, config, null, null, null, mutated, parent.generation + 1);
        state.creatures.push(offspring);
    }

    for (let i = 0; i < randomCount; i++) {
        state.creatures.push(await initCreature(state, config));
    }

    logger.info("Population restarted");
}

module.exports = {
    appendTopPerformers,
    restartPopulation,
};
