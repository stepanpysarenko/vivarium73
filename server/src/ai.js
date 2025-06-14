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
            prev_x: c.prev.x,
            prev_y: c.prev.y,
            prev_angle: c.prev.angle,
            recent_path: c.recentPath,
            prev_energy: c.prev.energy,
            just_reproduced: c.justReproduced,
            weights: c.weights,
            food: getVisibleFood(c, state),
            obstacles: getVisibleObstacles(c, state),
            creatures: getVisibleCreatures(c, state)
        })),
        grid_size: state.params.gridSize,
        visibility_radius: state.params.visibilityRadius,
        max_energy: state.params.maxEnergy,
        max_turn_angle: state.params.maxTurnAngle,
        max_speed: state.params.maxSpeed
    });

    return response.data.movements;
}

module.exports = {
    initWeights,
    mutateWeights,
    getMovements
};
