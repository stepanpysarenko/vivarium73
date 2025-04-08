const axios = require("axios");
const CONFIG = require("./config");
const {
    AI_SERVER_URL,
    GRID_SIZE,
    TOTAL_ENERGY,
    CREATURE_INITIAL_COUNT,
    CREATURE_INITIAL_ENERGY,
    CREATURE_MAX_ENERGY,
    CREATURE_ENERGY_DECAY,
    CREATURE_REPRODUCTION_ENERGY_COST,
    CREATURE_VISIBILITY_RADIUS,
    CREATURE_INTERACTION_RADIUS,
    MUTATION_RATE,
    FOOD_MAX_COUNT,
    FOOD_ENERGY,
    TOP_PERFORMERS_RATIO
} = CONFIG;

const {
    saveState,
    loadState,
    saveTopPerformers,
    loadTopPerformers
} = require('./state-manager');

var state;
var lastCreatureId = 0;
var topPerformers = [];

function saveData() {
    saveState(state);
    saveTopPerformers(topPerformers);
}

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
            energy: CREATURE_INITIAL_ENERGY,
            prev: {
                x: x,
                y: y,
                energy: CREATURE_INITIAL_ENERGY
            },
            weights: weights,
            generation: generation,
            stats: {
                turnsSurvived: 0,
                totalFoodCollected: 0,
                totalMovesMade: 0
            }
        };
    } catch (error) {
        console.error("Error initiating weights:", error);
        return null;
    }
}

function initFood() {
    var food = null;
    while (food === null 
        || state.food.some(f => f.x === food.x && f.y === food.y) 
        || state.obstacles.some(o => o.x === food.x && o.y === food.y)) {
        food = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE)
        }
    }
    return food;
}

function initObstacles() {
    return [
        { x: 20, y: 20 },
        { x: 20, y: 21 },
        { x: 20, y: 22 },
        { x: 20, y: 23 },
        { x: 20, y: 24 },
        { x: 20, y: 25 },
        { x: 20, y: 26 },
        { x: 20, y: 27 },
        { x: 20, y: 28 },
        { x: 20, y: 29 },
        { x: 20, y: 30 },
        { x: 21, y: 30 },
        { x: 22, y: 30 },
        { x: 23, y: 30 }, 
        { x: 24, y: 30 }, 
        { x: 25, y: 30 }, 
        { x: 26, y: 30 }, 
        { x: 27, y: 30 }, 
        { x: 28, y: 30 }, 
        { x: 29, y: 30 }, 
        { x: 30, y: 30 }, 
        { x: 31, y: 30 }, 
        { x: 32, y: 30 }, 
        { x: 19, y: 25 },
        { x: 18, y: 25 },
        { x: 17, y: 25 },
        { x: 16, y: 25 },
        { x: 15, y: 25 },
    ]
}

async function getMovements() {
    try {
        const response = await axios.post(AI_SERVER_URL + "/api/think", {
            creatures: state.creatures.map(c => ({
                id: c.id,
                x: c.x,
                y: c.y,
                prev_x: c.prev.x,
                prev_y: c.prev.y,
                weights: c.weights,
                energy: c.energy,
                visible_food: state.food.filter(food =>
                    Math.hypot(food.x - c.x, food.y - c.y) <= CREATURE_VISIBILITY_RADIUS
                )
            })),
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

function updateStats() {
    state.stats.creatureCount = state.creatures.length;
    state.stats.foodCount = state.food.length;
    state.stats.generation = Math.max(...state.creatures.map(c => c.generation), 0);
}

function updateFood() {
    // add food while total energy is not reached
    var totalCreatureEnergy = state.creatures.reduce((total, creature) => total + creature.energy, 0);
    while (((totalCreatureEnergy + state.food.length * FOOD_ENERGY) < TOTAL_ENERGY) && state.food.length < FOOD_MAX_COUNT) {
        state.food.push(initFood());
    }
}

async function initState() {
    topPerformers = loadTopPerformers();
    state = loadState();

    if (state === null) {
        console.log('Initializing new random state...');
        state = {
            creatures: [],
            food: [],
            obstacles: initObstacles(),
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

        console.log('New state initialized');
    }

    state.obstacles = initObstacles(); // dev
}

function getPublicState() {
    return {
        ...state,
        creatures: state.creatures.map(c => ({
            id: c.id,
            x: c.x,
            y: c.y,
            energy: c.energy,
            prev_x: c.prev.x,
            prev_y: c.prev.y,
        }))
    };
}

function getScore(creature) {
    return creature.stats.totalFoodCollected / Math.max(1, creature.stats.totalMovesMade);
}

function appendTopPerformers(creature) {
    creature.score = getScore(creature);
    topPerformers.push(creature);
    topPerformers.sort((a, b) => b.score - a.score)

    const MAX_LENGTH = Math.max(1, Math.floor(CREATURE_INITIAL_COUNT * TOP_PERFORMERS_RATIO));
    if (topPerformers.length > MAX_LENGTH) {
        topPerformers.length = MAX_LENGTH;
    }
}

async function restartPopulation() {
    console.log('Restarting population with top performers weights...');
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

        console.log('Population restarted');
    }

    saveState(state);
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

            const hitsObstacle = state.obstacles.some(o => 
                Math.abs(o.x - new_x) < CREATURE_INTERACTION_RADIUS && Math.abs(o.y - new_y) < CREATURE_INTERACTION_RADIUS
            );
            if (hitsObstacle) {
                new_x = creature.x;
                new_y = creature.y;
            }

            if (move_x !== 0 || move_y !== 0) {
                creature.stats.totalMovesMade++;
            }
            creature.stats.turnsSurvived++;

            // reduce energy on movement
            creature.energy -= CREATURE_ENERGY_DECAY;

            // check if food is eaten
            let foodIndex = state.food.findIndex(f =>
                Math.abs(f.x - new_x) < CREATURE_INTERACTION_RADIUS && Math.abs(f.y - new_y) < CREATURE_INTERACTION_RADIUS
            );
            if (foodIndex !== -1) {
                creature.energy = Math.min(creature.energy + FOOD_ENERGY, CREATURE_MAX_ENERGY);
                creature.stats.totalFoodCollected++;
                state.food.splice(foodIndex, 1);
            }

            // reproduce
            if (creature.energy >= CREATURE_MAX_ENERGY) {
                let newCreature = await initCreature(
                    creature.x,
                    creature.y,
                    await mutate(creature.weights),
                    creature.generation + 1
                );
                offsprings.push(newCreature);
                creature.energy = CREATURE_MAX_ENERGY - CREATURE_REPRODUCTION_ENERGY_COST;
            } else if (creature.energy <= 0) {
                appendTopPerformers(creature);
                return null;
            }

            return {
                ...creature,
                x: new_x,
                y: new_y,
                prev: {
                    x: creature.x,
                    y: creature.y,
                    energy: creature.energy
                }
            };
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

module.exports = { getPublicState, initState, updateState, saveData };