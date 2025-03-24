const fs = require('fs');
const path = require('path');
const axios = require("axios");
const CONFIG = require("./config");

const {
    AI_SERVER_URL,
    STATE_SAVE_PATH,
    GRID_SIZE,
    CREATURE_COUNT,
    MAX_FOOD_COUNT,
    TOTAL_ENERGY,
    FOOD_ENERGY,
    INITIAL_ENERGY,
    MAX_ENERGY,
    ENERGY_DECAY,
    REPRODUCTION_ENERGY_COST,
    MUTATION_RATE,
    TOP_POPULATION_PERCENT_TO_RESTART
} = CONFIG;

var state;
var lastCreatureId = 0;
var performanceLog = [];

async function initCreature(x = null, y = null, weights = null, generation = 1) {
    try {
        if (weights == null) {
            const response = await axios.get(AI_SERVER_URL + "/weights/init");
            weights = response.data.weights;
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
            generation: generation,
            turnsSurvived: 0,
            totalFoodCollected: 0,
            totalMovesMade: 0
        };

    } catch (error) {
        console.error("Error initiating weights:", error);
        return null;
    }
}

function initFood() {
    return {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
    }
}

async function getMovements() {
    try {
        const response = await axios.post(AI_SERVER_URL + "/think", {
            creatures: state.creatures.map(c => ({
                id: c.id,
                x: c.x,
                y: c.y,
                prev_x: c.prev_x,
                prev_y: c.prev_y,
                weights: c.weights,
                energy: c.energy,
            })),
            food: state.food,
            grid_size: state.params.gridSize,
            max_energy: state.params.maxEnergy
        });
        return response.data;
    } catch (error) {
        console.error("Error mutating weights:", error);
        return null;
    }
}

async function mutate(weights) {
    try {
        const response = await axios.post(AI_SERVER_URL + "/weights/mutate", { weights });
        return response.data.weights;
    } catch (error) {
        console.error("Error mutating weights:", error);
        return weights;
    }
}

function getState() {
    return state;
}

function updateStats() {
    state.stats.creatureCount = state.creatures.length;
    state.stats.foodCount = state.food.length;
    state.stats.generation = Math.max(...state.creatures.map(c => c.generation), 0);
}

function updateFood() {
    var totalCreatureEnergy = state.creatures.reduce((total, creature) => total + creature.energy, 0);
    var notEnoughFood = totalCreatureEnergy + (state.food.length + 1) * FOOD_ENERGY <= TOTAL_ENERGY;
    while (notEnoughFood && state.food.length < MAX_FOOD_COUNT) {
        state.food.push(initFood());
    }
}

function loadState() {
    const filePath = path.resolve(STATE_SAVE_PATH);

    try {
        if (!fs.existsSync(filePath)) {
            console.warn(`State file not found at ${filePath}`);
            return false;
        }

        const fileData = fs.readFileSync(filePath, 'utf8');
        state = JSON.parse(fileData);
        console.log(`State successfully loaded from ${filePath}`);
        return true;
    } catch (error) {
        console.error(`Error loading state from ${filePath}:`, error.message);
        return false
    }
}

function saveState() {
    const filePath = path.resolve(STATE_SAVE_PATH);

    try {
        const data = JSON.stringify(state, null, 4);
        fs.writeFileSync(filePath, data, 'utf8');
        console.log('State successfully saved to', filePath);
    } catch (error) {
        console.error(`Error saving state to ${filePath}:`, error.message);
    }
}

async function initState() {
    if (!loadState()) {
        state = {
            creatures: [],
            food: [],
            params: {
                gridSize: GRID_SIZE,
                maxEnergy: MAX_ENERGY
            },
            stats: {
                restarts: 0,
                generation: 1,
                creatureCount: 0,
                foodCount: 0
            }
        };
    
        for (let i = 0; i < CREATURE_COUNT; i++) {
            const newCreature = await initCreature();
            state.creatures.push(newCreature);
        }
    
        updateFood();

        console.log('New state initialized');
    }
}

async function restartPopulation() {
    const scoredCreatures = performanceLog.sort((a, b) => b.efficiencyScore - a.efficiencyScore);
    const topPerformers = scoredCreatures.slice(0, Math.max(1, Math.floor(CREATURE_COUNT * TOP_POPULATION_PERCENT_TO_RESTART)));

    state.creatures = [];
    for (let i = 0; i < CREATURE_COUNT; i++) {
        const parent = topPerformers[i % topPerformers.length];
        const mutatedWeights = await mutate(parent.weights);
        const offspring = await initCreature(null, null, mutatedWeights, parent.generation + 1);
        state.creatures.push(offspring);
    }

    performanceLog = [];

    updateFood();
    updateStats();

    console.log(`Restarted population with ${topPerformers.length} best-performing creatures`);

    saveState();
}

async function updateState() {
    try {
        const movements = await getMovements();
        var offsprings = [];
        state.creatures = await Promise.all(state.creatures.map(async (creature, index) => {
            let move_x = movements[index].move_x;
            let move_y = movements[index].move_y;

            let new_x = Math.max(0, Math.min(GRID_SIZE - 1, creature.x + move_x));
            let new_y = Math.max(0, Math.min(GRID_SIZE - 1, creature.y + move_y));

            if (move_x !== 0 || move_y !== 0) {
                creature.totalMovesMade++;
            }
            creature.turnsSurvived++;

            // reduce energy on movement
            creature.energy -= ENERGY_DECAY;

            // check if food is eaten
            let foodIndex = state.food.findIndex(f => f.x === new_x && f.y === new_y);
            if (foodIndex !== -1) {
                creature.energy = Math.min(creature.energy + FOOD_ENERGY, MAX_ENERGY);
                creature.totalFoodCollected++;
                state.food.splice(foodIndex, 1); // Remove eaten food

                // Apply mutation when eating
                if (Math.random() < MUTATION_RATE) {
                    creature.weights = await mutate(creature.weights);
                }

                // reproduction
                if (creature.energy >= MAX_ENERGY) {
                    let newCreature = await initCreature(
                        creature.x,
                        creature.y,
                        await mutate(creature.weights),
                        creature.generation + 1
                    );
                    offsprings.push(newCreature);
                    creature.energy = MAX_ENERGY - REPRODUCTION_ENERGY_COST;
                }
            }

            if (creature.energy <= 0) {
                performanceLog.push({
                    efficiencyScore: creature.totalFoodCollected / Math.max(1, creature.totalMovesMade),
                    generation: creature.generation,
                    weights: creature.weights
                });
            }

            return { ...creature, x: new_x, y: new_y, prev_x: creature.x, prev_y: creature.y };
        }));

        state.creatures = state.creatures.filter(c => c.energy > 0); // remove creatures that ran out of energy
        state.creatures.push(...offsprings);

        if (state.creatures.length == 0) {
            await restartPopulation();
            state.stats.restarts++;
        }

    } catch (error) {
        console.error("Error calling AI server:", error);
    }

    updateFood();
    updateStats();
}

module.exports = { getState, saveState, initState, updateState };