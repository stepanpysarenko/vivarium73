const axios = require("axios");

const AI_BACKEND_URL_INIT_WEIGHTS = "http://localhost:8000/init_weights";
const AI_BACKEND_URL_THINK = "http://localhost:8000/think";

const GRID_SIZE = 40;
const CREATURE_COUNT = 15;
const FOOD_COUNT = 60;

const INITIAL_ENERGY = 300;
const MAX_ENERGY = 1000;    
const ENERGY_DECAY = 1;
const ENERGY_GAIN_EATING = 300;
const MIN_ENERGY_TO_REPRODUCE = 600;
const REPRODUCTION_ENERGY_COST = 400;

const MUTATION_RATE = 0.1; // chance of mutation per weight

var gameState;
var lastCreatureId = 0;

function initCreature(x = null, y = null, weights = null, generation = 0) {
    try {
        if (weights == null) {
            // const response = await axios.get(AI_BACKEND_URL_INIT_WEIGHTS);
            // weights = response.data.weights;
            weights = Array.from({ length: 28 }, () => Math.random() * 2 - 1);
        }

        x = x ? x : Math.floor(Math.random() * GRID_SIZE);
        y = y ? y : Math.floor(Math.random() * GRID_SIZE);

        return {
            id: lastCreatureId++,
            x: x,
            y: y,
            prev_x: x,
            prev_y: y,
            weights: weights,
            energy: INITIAL_ENERGY,
            generation: generation
        };

    } catch (error) {
        console.error("Error generating weights:", error);
        return null;
    }
}

function initFood() {
    return {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
    }
}

function mutate(weights) {
    return weights.map(w => w + (Math.random() - 0.5) * 0.1);
}

function getgameState(){
    return gameState;
}

function initGameState()
{
    gameState = {
        creatures: Array.from({ length: CREATURE_COUNT }, initCreature),
        food: Array.from({ length: FOOD_COUNT }, initFood),
        gridSize: GRID_SIZE,
        maxEnergy: MAX_ENERGY
    }
}

async function updateGameState()  {
    try {
        const response = await axios.post(AI_BACKEND_URL_THINK, {
            creatures: gameState.creatures,
            food: gameState.food,
            grid_size: gameState.gridSize,
            max_energy: gameState.maxEnergy
        });

        const movements = response.data;

        var offsprings = [];

        gameState.creatures = gameState.creatures.map((creature, index) => {
            let move_x = movements[index].move_x;
            let move_y = movements[index].move_y;

            let new_x = Math.max(0, Math.min(GRID_SIZE - 1, creature.x + move_x));
            let new_y = Math.max(0, Math.min(GRID_SIZE - 1, creature.y + move_y));

            // reduce energy on movement
            creature.energy -= ENERGY_DECAY;

            // check if food is eaten
            let foodIndex = gameState.food.findIndex(f => f.x === new_x && f.y === new_y);
            if (foodIndex !== -1) {
                creature.energy = Math.min(creature.energy += ENERGY_GAIN_EATING, MAX_ENERGY);
                gameState.food.splice(foodIndex, 1); // remove eaten food
                gameState.food.push({
                    x: Math.floor(Math.random() * gameState.gridSize),
                    y: Math.floor(Math.random() * gameState.gridSize)
                });

                // apply mutation when eating
                if (Math.random() < MUTATION_RATE) {
                    creature.weights = mutate(creature.weights)
                }
            }

            if (creature.energy > MIN_ENERGY_TO_REPRODUCE) {
                let newCreature = initCreature(creature.x, creature.y, mutate(creature.weights), creature.generation + 1);
                offsprings.push(newCreature);
                creature.energy -= REPRODUCTION_ENERGY_COST;
            }

            return { ...creature, x: new_x, y: new_y, prev_x: creature.x, prev_y: creature.y };
        })
        .filter(c => c.energy > 0); // remove creatures that ran out of energy

        gameState.creatures.push(...offsprings);

        if (gameState.creatures.length < CREATURE_COUNT) {
            do {
                gameState.creatures.push(initCreature(null, null, null, 0));
            } while (gameState.creatures.length < CREATURE_COUNT);
        }

    } catch (error) {
        console.error("Error calling AI backend:", error);
    }
}

module.exports = { getgameState, initGameState, updateGameState };