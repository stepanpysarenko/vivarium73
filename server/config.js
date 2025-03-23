require("dotenv").config();

const CONFIG = {
    PORT: process.env.PORT || 3000,
    WEBSOCKET_URL: process.env.WEBSOCKET_URL || "ws://localhost:3000",
    AI_SERVER_URL: process.env.AI_SERVER_URL || "http://localhost:8000/api",
    SAVED_STATE_PATH: "./data/state.json",
    SAVE_STATE_INTERVAL: 1000 * 60 * 5,
    STATE_UPDATE_INTERVAL: 200,
    GRID_SIZE: 40,
    CREATURE_COUNT: 15,
    MAX_FOOD_COUNT: 40,
    TOTAL_ENERGY: 15000,
    FOOD_ENERGY: 200,
    INITIAL_ENERGY: 400,
    MAX_ENERGY: 1000,
    ENERGY_DECAY: 1,
    REPRODUCTION_ENERGY_COST: 500,
    MUTATION_RATE: 0.1,
    TOP_POPULATION_PERCENT_TO_RESTART: 0.2
};

module.exports = CONFIG;