const CONFIG = require("./config");
const { initWeights } = require("./nn");
const { getRandomEmptyCell } = require("./grid");

async function initCreature(state, x = null, y = null, angle = null, weights = null, generation = 1) {
    if (x === null || y === null) {
        const cell = getRandomEmptyCell(state);
        if (!cell) {
            throw new Error("No empty cells available to place a creature");
        }
        ({ x, y } = cell);
    }

    angle = angle !== null ? angle : (Math.random() * 2 * Math.PI) - Math.PI;

    if (!weights) {
        weights = await initWeights();
    }

    const creature = {
        id: getNextCreatureId(state),
        x,
        y,
        angle,
        wanderAngle: (Math.random() * 2 * Math.PI) - Math.PI,
        wanderStrength: 1.0,
        energy: CONFIG.CREATURE_INITIAL_ENERGY,
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
    return Math.round(creature.stats.energyGained / 10);
}

function getNextCreatureId(state) {
    return ++state.lastCreatureId;
}

module.exports = {
    initCreature,
    getScore
};
