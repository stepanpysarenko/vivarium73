const axios = require("axios");
const CONFIG = require("./config");
const { getVisibleFood, getVisibleObstacles, getVisibleCreatures } = require("./grid");

async function initWeights() {
    const response = await axios.get(CONFIG.AI_SERVER_URL + "/weights/init");
    return response.data.weights;
}

async function mutateWeights(weights) {
    const response = await axios.post(CONFIG.AI_SERVER_URL + "/weights/mutate", { weights });
    return response.data.weights;
}

async function getMovements(state) {
    const response = await axios.post(CONFIG.AI_SERVER_URL + "/think", {
        creatures: state.creatures.map(c => ({
            id: c.id,
            x: c.x,
            y: c.y,
            angle: c.angle,
            energy: c.energy,
            prevX: c.prev.x,
            prevY: c.prev.y,
            prevAngle: c.prev.angle,
            recentPath: c.recentPath,
            prevEnergy: c.prev.energy,
            justReproduced: c.justReproduced,
            weights: c.weights,
            food: getVisibleFood(c, state),
            obstacles: getVisibleObstacles(c, state),
            creatures: getVisibleCreatures(c, state)
        })),
        gridSize: state.params.gridSize,
        visibilityRadius: state.params.visibilityRadius,
        maxEnergy: state.params.maxEnergy,
        maxTurnAngle: state.params.maxTurnAngle,
        maxSpeed: state.params.maxSpeed
    });

    return response.data.movements;
}

module.exports = {
    initWeights,
    mutateWeights,
    getMovements
};
