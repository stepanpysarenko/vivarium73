const CONFIG = require("../config");
const { initCreature } = require("./creature");
const { getMovements, mutateWeights } = require("./ai");
const { initObstacles, updateFood } = require("./grid");
const { appendTopPerformers, restartPopulation } = require("./performance");
const { saveState, loadState, saveTopPerformers, loadTopPerformers } = require("./data-manager");

var state;
var topPerformers = [];

async function initState() {
    topPerformers = loadTopPerformers();
    state = loadState();

    if (!state) {
        state = {
            creatures: [],
            food: [],
            obstacles: initObstacles(),
            params: {
                gridSize: CONFIG.GRID_SIZE,
                maxEnergy: CONFIG.CREATURE_MAX_ENERGY
            },
            stats: {
                restarts: 0,
                generation: 1,
                creatureCount: 0,
                foodCount: 0
            }
        };

        for (let i = 0; i < CONFIG.CREATURE_INITIAL_COUNT; i++) {
            const creature = await initCreature();
            state.creatures.push(creature);
        }

        updateFood(state);
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
        params: state.params,
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
            new_x = creature.x;
            new_y = creature.y;
            creature.energy -= CONFIG.CREATURE_COLLISION_PENALTY;
        }

        if (move.move_x !== 0 || move.move_y !== 0) creature.stats.totalMovesMade++;
        creature.stats.turnsSurvived++;
        creature.energy -= CONFIG.CREATURE_ENERGY_LOSS * (0.2 + Math.hypot(move.move_x, move.move_y));

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
            const weights = Math.random() <= CONFIG.MUTATION_RATE
                ? await mutateWeights(creature.weights)
                : creature.weights;
            const offspring = await initCreature(creature.x, creature.y, weights, creature.generation + 1);
            offsprings.push(offspring);
            creature.energy = CONFIG.CREATURE_MAX_ENERGY - CONFIG.CREATURE_REPRODUCTION_ENERGY_COST;
            creature.justReproduced = true;
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

    if (state.creatures.length === 0) {
        await restartPopulation(state);
        state.stats.restarts++;
        saveData();
    }

    updateFood(state);

    state.stats.creatureCount = state.creatures.length;
    state.stats.foodCount = state.food.length;
    state.stats.generation = Math.max(...state.creatures.map(c => c.generation), 0);
}

async function saveData() {
    saveState(state);
    saveTopPerformers(topPerformers);
}

module.exports = { initState, updateState, getPublicState, saveData };
