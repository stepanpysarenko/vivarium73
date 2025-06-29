const axios = require("axios");
const CONFIG = require("./config");
const { getVisibleFood, getVisibleObstacles, getVisibleCreatures } = require("./grid");

async function initWeights() {
    try {
        const response = await axios.get(CONFIG.NN_SERVICE_URL + "/weights/init");
        return response.data.weights;
    } catch (err) {
        throw new Error('Failed to initialize weights: ' + err.message);
    }
}

async function mutateWeights(weights) {
    try {
        const response = await axios.post(CONFIG.NN_SERVICE_URL + "/weights/mutate", { weights });
        return response.data.weights;
    } catch (err) {
        throw new Error('Failed to mutate weights: ' + err.message);
    }
}

async function getMovements(state) {
    try {
        const response = await axios.post(CONFIG.NN_SERVICE_URL + "/think", {
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
    } catch (err) {
        throw new Error('Failed to fetch movements: ' + err.message);
    }
}

module.exports = {
    initWeights,
    mutateWeights,
    getMovements
};
