const axios = require("axios");

const AI_BACKEND_URL = "http://localhost:8000/ai/move";

const GRID_SIZE = 50;
const CREATURE_COUNT = 10;
const FOOD_COUNT = 80;
const INITIAL_ENERGY = 4000;
const ENERGY_DECAY = 1; // Energy lost per move
const ENERGY_GAIN = 200; // Energy gained when eating
const MUTATION_RATE = 0.1; // Chance of mutation per weight

var lastCreatureId = 0;

var gameState = {
        creatures: Array.from({ length: CREATURE_COUNT }, () => ({
            id: lastCreatureId++,
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE),
            weights: [[Math.random(), Math.random()], [Math.random(), Math.random()]], 
            energy: INITIAL_ENERGY
        })),
        food: Array.from({ length: FOOD_COUNT }, () => ({
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE)
        })),
        gridSize: GRID_SIZE
    };

function mutate(weights) {
    return weights.map(w => Math.random() < MUTATION_RATE ? [w[0] + (Math.random() - 0.5) * 0.1, w[1] + (Math.random() - 0.5) * 0.1] : w);
}

async function updateGameState()  {
    try {
        const aiResponse = await axios.post(AI_BACKEND_URL, {
            creatures: gameState.creatures,
            food: gameState.food,
            grid_size: gameState.gridSize
        });

        const movements = aiResponse.data;

        // apply movements
        gameState.creatures = gameState.creatures.map((creature, index) => {
            let move_x = movements[index].move_x;
            let move_y = movements[index].move_y;
            // let move_x = Math.random() > 0.5 ? 1 : -1;
            // let move_y = Math.random() > 0.5 ? 1 : -1;

            let new_x = Math.max(0, Math.min(GRID_SIZE - 1, creature.x + move_x));
            let new_y = Math.max(0, Math.min(GRID_SIZE - 1, creature.y + move_y));

            // Reduce energy on movement
            creature.energy -= ENERGY_DECAY;

            // Check if food is eaten
            let foodIndex = gameState.food.findIndex(f => f.x === new_x && f.y === new_y);
            if (foodIndex !== -1) {
                creature.energy += ENERGY_GAIN; // Restore energy
                gameState.food.splice(foodIndex, 1); // Remove eaten food
                gameState.food.push({
                    x: Math.floor(Math.random() * gameState.gridSize),
                    y: Math.floor(Math.random() * gameState.gridSize)
                });

                // Apply mutation when eating
                creature.weights = mutate(creature.weights);
            }

            return { ...creature, x: new_x, y: new_y };
        })
        .filter(c => c.energy > 0); // Remove creatures that ran out of energy

    } catch (error) {
        console.error("Error calling AI backend:", error);
    }
}

module.exports = { gameState, updateGameState };