const axios = require("axios");
const { SERVER_CONFIG } = require("./config");
const { getVisibleFood, getVisibleObstacles, getVisibleCreatures } = require("./grid");

async function initWeights() {
    try {
        const response = await axios.get(SERVER_CONFIG.NN_SERVICE_URL + "/weights/init");
        return response.data.weights;
    } catch (err) {
        throw new Error('Failed to initialize weights: ' + err.message);
    }
}

async function mutateWeights(weights) {
    try {
        const response = await axios.post(SERVER_CONFIG.NN_SERVICE_URL + "/weights/mutate", { weights });
        return response.data.weights;
    } catch (err) {
        throw new Error('Failed to mutate weights: ' + err.message);
    }
}

async function getMovements(state, config) {
    try {
        const response = await axios.post(SERVER_CONFIG.NN_SERVICE_URL + "/think", {
            creatures: state.creatures.map(c => ({
                id: c.id,
                x: c.x,
                y: c.y,
                angle: c.angle,
                wanderAngle: c.wanderAngle,
                wanderStrength: c.wanderStrength,
                energy: c.energy,
                prevX: c.prev.x,
                prevY: c.prev.y,
                prevAngle: c.prev.angle,
                recentPath: c.recentPath,
                prevEnergy: c.prev.energy,
                justReproduced: c.justReproduced,
                weights: c.weights,
                food: getVisibleFood(c, state, config),
                obstacles: getVisibleObstacles(c, state, config),
                creatures: getVisibleCreatures(c, state, config)
            })),
            gridSize: config.GRID_SIZE,
            visibilityRadius: config.CREATURE_VISIBILITY_RADIUS,
            maxEnergy: config.CREATURE_MAX_ENERGY,
            maxTurnAngle: config.CREATURE_MAX_TURN_ANGLE_RADIANS,
            maxSpeed: config.CREATURE_MAX_SPEED
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
