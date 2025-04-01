require("dotenv").config();

const CONFIG = {
    PORT: process.env.PORT || 3000,
    WEBSOCKET_URL: process.env.WEBSOCKET_URL || "ws://localhost:3000",
    AI_SERVER_URL: process.env.AI_SERVER_URL || "http://localhost:8000",
    STATE_SAVE_PATH: "./data/state.json",
    STATE_SAVE_INTERVAL: 1000 * 60 * 5,
    STATE_UPDATE_INTERVAL: 500,
    GRID_SIZE: 40,
    TOTAL_ENERGY: 12000,
    CREATURE_INITIAL_COUNT: 15,
    CREATURE_INITIAL_ENERGY: 400,
    CREATURE_MAX_ENERGY: 1000,
    CREATURE_ENERGY_DECAY: 5,
    CREATURE_REPRODUCTION_ENERGY_COST: 500,
    MUTATION_RATE: 0.1,
    FOOD_MAX_COUNT: 20,    
    FOOD_ENERGY: 100,   
    TOP_PERFORMERS_RATIO: 0.2
};

module.exports = CONFIG;
