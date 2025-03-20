const axios = require("axios");
const CONFIG = require("./config");

const {
    AI_SERVER_URL,
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

var gameState;
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
            creatures: gameState.creatures.map(c => ({
                id: c.id,
                x: c.x,
                y: c.y,
                prev_x: c.prev_x,
                prev_y: c.prev_y,
                weights: c.weights,
                energy: c.energy,
            })),
            food: gameState.food,
            grid_size: gameState.params.gridSize,
            max_energy: gameState.params.maxEnergy
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

function getGameState() {
    return gameState;
}

function updateStats() {
    gameState.stats.creatureCount = gameState.creatures.length;
    gameState.stats.foodCount = gameState.food.length;
}

function updateFood() {
    var totalCreatureEnergy = gameState.creatures.reduce((total, creature) => total + creature.energy, 0);
    var notEnoughFood = totalCreatureEnergy + (gameState.food.length + 1) * FOOD_ENERGY <= TOTAL_ENERGY;
    while (notEnoughFood && gameState.food.length < MAX_FOOD_COUNT) {
        gameState.food.push(initFood());
    }
}

async function initGameState() {
    gameState = {
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
        gameState.creatures.push(newCreature);
    }

    updateFood();
}

async function restartPopulation() {
    const scoredCreatures = performanceLog.sort((a, b) => b.efficiencyScore - a.efficiencyScore);
    const topPerformers = scoredCreatures.slice(0, Math.max(1, Math.floor(CREATURE_COUNT * TOP_POPULATION_PERCENT_TO_RESTART)));

    gameState.creatures = [];
    for (let i = 0; i < CREATURE_COUNT; i++) {
        const parent = topPerformers[i % topPerformers.length];
        const mutatedWeights = await mutate(parent.weights);
        const offspring = await initCreature(null, null, mutatedWeights, parent.generation + 1);
        gameState.creatures.push(offspring);
    }

    performanceLog = [];

    updateFood();
    updateStats();

    console.log(`Restarted population with ${topPerformers.length} best-performing creatures.`);
}

async function updateGameState() {
    try {
        const movements = await getMovements();
        var offsprings = [];
        gameState.creatures = await Promise.all(gameState.creatures.map(async (creature, index) => {
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
            let foodIndex = gameState.food.findIndex(f => f.x === new_x && f.y === new_y);
            if (foodIndex !== -1) {
                creature.energy = Math.min(creature.energy + FOOD_ENERGY, MAX_ENERGY);
                creature.totalFoodCollected++;
                gameState.food.splice(foodIndex, 1); // Remove eaten food

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
                    gameState.stats.generation = Math.max(gameState.stats.generation, newCreature.generation);
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

        gameState.creatures = gameState.creatures.filter(c => c.energy > 0); // remove creatures that ran out of energy
        gameState.creatures.push(...offsprings);

        if (gameState.creatures.length == 0) {
            await restartPopulation();
            gameState.stats.restarts++;
        }

    } catch (error) {
        console.error("Error calling AI server:", error);
    }

    updateFood();
    updateStats();
}

module.exports = { getGameState, initGameState, updateGameState };