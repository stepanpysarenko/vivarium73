const axios = require("axios");

const AI_BACKEND_URL_INIT_WEIGHTS = "http://localhost:8000/initweights";
const AI_BACKEND_URL_THINK = "http://localhost:8000/think";

// env
const GRID_SIZE = 40;
const CREATURE_COUNT = 12;
const TOTAL_ENERGY = 15000;
const FOOD_ENERGY = 200;

// creature
const INITIAL_ENERGY = 400;
const MAX_ENERGY = 1000;    
const ENERGY_DECAY = 1;
const REPRODUCTION_ENERGY_COST = 500;
const MUTATION_RATE = 0.1;

const FOOD_COUNT = Math.floor((TOTAL_ENERGY - CREATURE_COUNT * INITIAL_ENERGY) / FOOD_ENERGY);

var gameState;
var lastCreatureId = 0;

function initCreature(x = null, y = null, weights = null, generation = 0) {
    try {
        if (weights == null) {
            // const response = await axios.get(AI_BACKEND_URL_INIT_WEIGHTS);
            // weights = response.data.weights;
            weights = Array.from({ length: 42 }, () => Math.random() * 2 - 1);
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

function getGameState(){
    return gameState;
}

function initGameState()
{
    gameState = {
        creatures: [],
        food: Array.from({ length: FOOD_COUNT }, initFood),
        gridSize: GRID_SIZE,
        maxEnergy: MAX_ENERGY
    }

    for (let i = 0; i < CREATURE_COUNT; i++) {
        var newCreature = initCreature();
        gameState.creatures.push(newCreature);
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
                creature.energy = Math.min(creature.energy += FOOD_ENERGY, MAX_ENERGY);
                gameState.food.splice(foodIndex, 1); // remove eaten food

                // // apply mutation when eating
                // if (Math.random() < MUTATION_RATE) {
                //     creature.weights = mutate(creature.weights)
                // }

                if (creature.energy >= MAX_ENERGY) {
                    let newCreature = initCreature(creature.x, creature.y, mutate(creature.weights), creature.generation + 1);
                    offsprings.push(newCreature);
                    creature.energy = MAX_ENERGY - REPRODUCTION_ENERGY_COST;
                }
            }

            return { ...creature, x: new_x, y: new_y, prev_x: creature.x, prev_y: creature.y };
        })
        .filter(c => c.energy > 0); // remove creatures that ran out of energy

        gameState.creatures.push(...offsprings);

        if (gameState.creatures.length == 0){
            await initGameState();
        }
        else {
            var totalCreatureEnergy =  gameState.creatures.reduce((total, creature) => total + creature.energy, 0);
            while (totalCreatureEnergy + (gameState.food.length + 1) * FOOD_ENERGY <= TOTAL_ENERGY) {
                gameState.food.push(initFood());
            }
        }

    } catch (error) {
        console.error("Error calling AI backend:", error);
    }
}

module.exports = { getGameState, initGameState, updateGameState };