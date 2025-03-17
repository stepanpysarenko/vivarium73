require("dotenv").config();

const CONFIG = {
    PORT: process.env.PORT || 3000,
    WS_SERVER_RL: process.env.WS_URL || "ws://localhost:3000",
    AI_SERVER_URL_INIT_WEIGHTS: process.env.AI_SERVER_URL_INIT_WEIGHTS || "http://localhost:8000/initweights",
    AI_SERVER_URL_THINK: process.env.AI_SERVER_URL_THINK || "http://localhost:8000/think",
    STATE_UPDATE_INTERVAL: 200,
    GRID_SIZE: 40,
    CREATURE_COUNT: 15,
    TOTAL_ENERGY: 15000,
    FOOD_ENERGY: 200,
    INITIAL_ENERGY: 400,
    MAX_ENERGY: 1000,
    ENERGY_DECAY: 1,
    REPRODUCTION_ENERGY_COST: 500,
    MUTATION_RATE: 0.1
};

module.exports = CONFIG;
