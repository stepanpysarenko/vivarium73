const fs = require('fs');
const path = require('path');
const CONFIG = require('./config');
const { initCreature } = require("./creature");
const { getMovements, mutateWeights } = require("./ai");
const { initObstacles, updateFood } = require("./grid");
const { appendTopPerformers, restartPopulation } = require("./performance");

var state = null;

async function initState() {
    state = loadState();
    if (!state) {
        state = {
            creatures: [],
            food: [],
            obstacles: [],
            params: {
                gridSize: CONFIG.GRID_SIZE,
                maxEnergy: CONFIG.CREATURE_MAX_ENERGY,
                visibilityRadius: CONFIG.CREATURE_VISIBILITY_RADIUS
            },
            stats: {
                restarts: 0,
                generation: 1,
                creatureCount: 0,
                foodCount: 0
            },
            topPerformers: []
        };

        initObstacles(state);
        updateFood(state);

        for (let i = 0; i < CONFIG.CREATURE_INITIAL_COUNT; i++) {
            const creature = await initCreature();
            state.creatures.push(creature);
        }

        console.log("New random state initialized");
    }
}

function getPublicState() {
    return {
        creatures: state.creatures.map(c => ({
            id: c.id,
            x: c.x,
            y: c.y,
            energy: c.energy,
            prev_x: c.prev.x,
            prev_y: c.prev.y
        })),
        food: state.food,
        obstacles: state.obstacles,
        params: {
            gridSize: state.params.gridSize,
            maxEnergy: state.params.maxEnergy
        },
        stats: state.stats
    };
}

async function updateState() {
    const movements = await getMovements(state);
    const offsprings = [];

    state.creatures = await Promise.all(state.creatures.map(async (creature, i) => {
        const move = movements[i];
        let new_x = Math.max(0, Math.min(CONFIG.GRID_SIZE - 1, creature.x + move.move_x));
        let new_y = Math.max(0, Math.min(CONFIG.GRID_SIZE - 1, creature.y + move.move_y));

        const hitsObstacle = state.obstacles.some(o =>
            Math.abs(o.x - new_x) < CONFIG.CREATURE_INTERACTION_RADIUS &&
            Math.abs(o.y - new_y) < CONFIG.CREATURE_INTERACTION_RADIUS
        );

        if (hitsObstacle) {
            // Try X-only movement
            const try_x = !state.obstacles.some(o =>
                Math.abs(o.x - new_x) < CONFIG.CREATURE_INTERACTION_RADIUS &&
                Math.abs(o.y - creature.y) < CONFIG.CREATURE_INTERACTION_RADIUS
            );

            // Try Y-only movement
            const try_y = !state.obstacles.some(o =>
                Math.abs(o.x - creature.x) < CONFIG.CREATURE_INTERACTION_RADIUS &&
                Math.abs(o.y - new_y) < CONFIG.CREATURE_INTERACTION_RADIUS
            );

            if (try_x && !try_y) {
                new_y = creature.y; // slide along x
            } else if (try_y && !try_x) {
                new_x = creature.x; // slide along y
            } else if (try_x && try_y) {
                // Prefer sliding along axis with greater movement
                if (Math.abs(move.move_x) > Math.abs(move.move_y)) {
                    new_y = creature.y;
                } else {
                    new_x = creature.x;
                }
            } else {
                // Fully blocked
                new_x = creature.x;
                new_y = creature.y;
                creature.energy -= CONFIG.CREATURE_COLLISION_PENALTY;
            }
        }

        creature.stats.turnsSurvived++;
        let activity = Math.min(1, Math.hypot(move.move_x, move.move_y));
        creature.energy -= CONFIG.CREATURE_ENERGY_LOSS * (0.2 + 0.8 * activity);

        const foodIndex = state.food.findIndex(f =>
            Math.abs(f.x - new_x) < CONFIG.CREATURE_INTERACTION_RADIUS &&
            Math.abs(f.y - new_y) < CONFIG.CREATURE_INTERACTION_RADIUS
        );
        if (foodIndex !== -1) {
            creature.energy = Math.min(creature.energy + CONFIG.FOOD_ENERGY, CONFIG.CREATURE_MAX_ENERGY);
            creature.stats.totalFoodCollected++;
            state.food.splice(foodIndex, 1);
        }

        creature.justReproduced = false;
        if (creature.energy >= CONFIG.CREATURE_MAX_ENERGY) {
            const weights = Math.random() <= CONFIG.MUTATION_CHANCE ? await mutateWeights(creature.weights) : creature.weights;
            const offspring = await initCreature(creature.x, creature.y, weights, creature.generation + 1);
            offsprings.push(offspring);
            creature.energy = CONFIG.CREATURE_MAX_ENERGY - CONFIG.CREATURE_REPRODUCTION_ENERGY_COST;
            creature.justReproduced = true;
        } else if (creature.energy <= 0) {
            appendTopPerformers(creature, state);
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

    if (state.creatures.length <= CONFIG.RESTART_ON_CREATURE_COUNT) {
        await restartPopulation(state);
        state.stats.restarts++;
        saveState();
    }

    updateFood(state);

    state.stats.creatureCount = state.creatures.length;
    state.stats.foodCount = state.food.length;
    state.stats.generation = Math.max(...state.creatures.map(c => c.generation), 0);
}

function saveState() {
    const filePath = path.resolve(CONFIG.STATE_SAVE_PATH);
    try {
        const data = JSON.stringify(state, null, 4);
        fs.writeFileSync(filePath, data, 'utf8');
        console.log('State successfully saved to', filePath);
    } catch (error) {
        console.error(`Error saving state to ${filePath}:`, error.message);
    }
}

function loadState() {
    const filePath = path.resolve(CONFIG.STATE_SAVE_PATH);
    try {
        if (!fs.existsSync(filePath)) {
            console.warn(`State file not found at ${filePath}`);
            return null;
        }
        const fileData = fs.readFileSync(filePath, 'utf8');
        const state = JSON.parse(fileData);
        console.log(`State successfully loaded from ${filePath}`);
        return state;
    } catch (error) {
        console.error(`Error loading state from ${filePath}:`, error.message);
        return null;
    }
}

module.exports = { initState, updateState, getPublicState, saveState };
