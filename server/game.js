const fs = require('fs');
const path = require('path');
const axios = require("axios");
const CONFIG = require("./config");

const {
    AI_SERVER_URL,
    STATE_SAVE_PATH,
    GRID_SIZE,
    TOTAL_ENERGY,
    CREATURE_INITIAL_COUNT,
    CREATURE_INITIAL_ENERGY,
    CREATURE_MAX_ENERGY,
    CREATURE_ENERGY_DECAY,
    CREATURE_REPRODUCTION_ENERGY_COST,
    MUTATION_RATE,
    FOOD_MAX_COUNT,    
    FOOD_ENERGY,   
    TOP_PERFORMERS_RATIO
} = CONFIG;

var state;
var lastCreatureId = 0;
var performanceLog = [];

async function initCreature(x = null, y = null, weights = null, generation = 1) {
    try {
        if (weights === null) {
            const response = await axios.get(AI_SERVER_URL + "/api/weights/init");
            weights = response.data.weights;
        }

        x = (x !== null && x !== undefined) ? x : Math.floor(Math.random() * GRID_SIZE);
        y = (y !== null && y !== undefined) ? y : Math.floor(Math.random() * GRID_SIZE);

        return {
            id: lastCreatureId++,
            x: x,
            y: y,
            prev_x: x,
            prev_y: y,
            weights: weights,
            energy: CREATURE_INITIAL_ENERGY,
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
        const response = await axios.post(AI_SERVER_URL + "/api/think", {
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

        return response.data || [];
    } catch (error) {
        console.error("Error fetching movements:", error);
        return state.creatures.map(() => ({ move_x: 0, move_y: 0 }));
    }
}

async function mutate(weights) {
    try {
        const response = await axios.post(AI_SERVER_URL + "/api/weights/mutate", { weights });
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
    // var totalCreatureEnergy = state.creatures.reduce((total, creature) => total + creature.energy, 0);
    // console.log(`Total energy of all creatures: ${totalCreatureEnergy}`);
    // var notEnoughFood = (totalCreatureEnergy + state.food.length * FOOD_ENERGY) < TOTAL_ENERGY;
    // while (notEnoughFood && state.food.length < FOOD_MAX_COUNT) {
    //     state.food.push(initFood());
    // }

    while (state.food.length < FOOD_MAX_COUNT) {
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
        return false;
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
                maxEnergy: CREATURE_MAX_ENERGY
            },
            stats: {
                restarts: 0,
                generation: 1,
                creatureCount: 0,
                foodCount: 0
            }
        };
    
        for (let i = 0; i < CREATURE_INITIAL_COUNT; i++) {
            const newCreature = await initCreature();
            state.creatures.push(newCreature);
        }
    
        updateFood();

        console.log('New random state initialized');
    }
}

async function restartPopulation() {
    const topPerformers = performanceLog
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(1, Math.floor(CREATURE_INITIAL_COUNT * TOP_PERFORMERS_RATIO)));
    console.log('Top performers score:', topPerformers.map(p => p.score));

    if (topPerformers.length == 0) {
        await initState();
    } else {
        state.creatures = [];
        for (let i = 0; i < CREATURE_INITIAL_COUNT; i++) {
            const parent = topPerformers[i % topPerformers.length];
            const offspring = await initCreature(null, null, await mutate(parent.weights), parent.generation + 1);
            state.creatures.push(offspring);
        }
        performanceLog = [];

        updateFood();
        updateStats();
        
        console.log(`Restarted population with ${topPerformers.length} best-performing creatures`);
    }
   
    saveState();
}

function getScore(creature) {
    return creature.totalFoodCollected / Math.max(1, creature.totalMovesMade);
}

function savePerformance(creature) {
    performanceLog.push({
        score: getScore(creature),
        generation: creature.generation,
        weights: creature.weights
    });
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
            creature.energy -= CREATURE_ENERGY_DECAY;

            // check if food is eaten
            let foodIndex = state.food.findIndex(f => f.x === new_x && f.y === new_y);
            if (foodIndex !== -1) {
                creature.energy = Math.min(creature.energy + FOOD_ENERGY, CREATURE_MAX_ENERGY);
                creature.totalFoodCollected++;
                state.food.splice(foodIndex, 1); // Remove eaten food

                // Apply mutation when eating
                if (Math.random() < MUTATION_RATE) {
                    creature.weights = await mutate(creature.weights);
                }

                // reproduction
                if (creature.energy >= CREATURE_MAX_ENERGY) {
                    let newCreature = await initCreature(
                        creature.x,
                        creature.y,
                        await mutate(creature.weights),
                        creature.generation + 1
                    );
                    offsprings.push(newCreature);
                    creature.energy = CREATURE_MAX_ENERGY - CREATURE_REPRODUCTION_ENERGY_COST;
                }
            }

            if (creature.energy <= 0) {
                savePerformance(creature);
                return null;
            }

            return { ...creature, x: new_x, y: new_y, prev_x: creature.x, prev_y: creature.y };
        }));

        state.creatures = state.creatures.filter(c => c !== null);
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