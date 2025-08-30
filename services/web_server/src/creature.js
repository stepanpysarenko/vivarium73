const CONFIG = require("./config");
const { initWeights } = require("./nn");
const { getRandomEmptyCell } = require("./grid");

async function initCreature(
    state,
    x = null,
    y = null,
    angle = 0.0,
    weights = null,
    generation = 1,
    sex = null) {
    if (x === null || y === null) {
        const cell = getRandomEmptyCell(state);
        x = cell.x;
        y = cell.y;
    }

    if (!weights) {
        weights = await initWeights();
    }

    var creature = {
        id: getNextCreatureId(state),
        x,
        y,
        angle: angle ?? (Math.random() * 2 * Math.PI) - Math.PI,
        energy: CONFIG.CREATURE_INITIAL_ENERGY,
        sex: sex ?? (Math.random() < CONFIG.CREATURE_SEX_RATIO_MALE ? 'M' : 'F'),
        mateCooldown: 0,
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
            msLived: 0,
            energyGained: 0,
            score: 0
        }
    };

    return creature;
}

function getScore(creature) {
    return Math.round(creature.stats.energyGained / Math.max(1, creature.stats.msLived) * 100000);
}

function getNextCreatureId(state) {
    return ++state.lastCreatureId;
}

module.exports = {
    initCreature,
    getScore
};
