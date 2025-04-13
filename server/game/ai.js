const axios = require("axios");
const CONFIG = require("../config");
const { getVisibleFood, getVisibleObstacles } = require("./grid");

async function getMovements(state) {
    const response = await axios.post(CONFIG.AI_SERVER_URL + "/api/think", {
        creatures: state.creatures.map(c => ({
            id: c.id,
            x: c.x,
            y: c.y,
            energy: c.energy,
            prev_x: c.prev.x,
            prev_y: c.prev.y,
            prev_energy: c.prev.energy,
            just_reproduced: c.justReproduced,
            weights: c.weights,
            food: getVisibleFood(c, state),
            obstacles: getVisibleObstacles(c, state)
        })),
        grid_size: state.params.gridSize,
        max_energy: state.params.maxEnergy
    });

    return response.data.movements;
}

async function initWeights() {
    const response = await axios.get(CONFIG.AI_SERVER_URL + "/api/weights/init");
    return response.data.weights;
}

async function mutateWeights(weights) {
    const response = await axios.post(CONFIG.AI_SERVER_URL + "/api/weights/mutate", { weights });
    return response.data.weights;
}

module.exports = {
    getMovements,
    initWeights,
    mutateWeights
};
