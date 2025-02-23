const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.json());

const GRID_SIZE = 50;
const CREATURE_COUNT = 10;
const FOOD_COUNT = 80;
const INITIAL_ENERGY = 4000;
const ENERGY_DECAY = 1; // Energy lost per move
const ENERGY_GAIN = 200; // Energy gained when eating
const MUTATION_RATE = 0.1; // Chance of mutation per weight

const AI_BACKEND_URL = "http://localhost:8000/ai/move";


app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public", "index.html"));
});


let gameState = {
    creatures: Array.from({ length: CREATURE_COUNT }, () => ({
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

// Function to mutate weights slightly
function mutate(weights) {
    return weights.map(w => Math.random() < MUTATION_RATE ? [w[0] + (Math.random() - 0.5) * 0.1, w[1] + (Math.random() - 0.5) * 0.1] : w);
}

app.get("/move", async (req, res) => {
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

        res.json(gameState);
    } catch (error) {
        console.error("Error calling AI backend:", error);
        res.status(500).json({ error: "AI backend unavailable" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
