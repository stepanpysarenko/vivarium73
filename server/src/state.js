const fs = require('fs');
const path = require('path');
const CONFIG = require('./config');
const { initCreature } = require("./creature");
const { getMovements, mutateWeights } = require("./ai");
const { initObstacles, updateFood, isCellOccupied } = require("./grid");
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
                maxFoodCount: CONFIG.FOOD_MAX_COUNT,
                maxEnergy: CONFIG.CREATURE_MAX_ENERGY,
                visibilityRadius: CONFIG.CREATURE_VISIBILITY_RADIUS,
                maxSpeed: CONFIG.CREATURE_MAX_SPEED,
                maxTurnAngle: CONFIG.CREATURE_MAX_TURN_ANGLE / 180 * Math.PI
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
            facingAngle: c.facingAngle,
            energy: c.energy,
            prev: {
                x: c.prev.x,
                y: c.prev.y,
                facingAngle: c.prev.facingAngle,
            },
            updatesToFlash: c.updatesToFlash || 0
        })),
        food: state.food,
        obstacles: state.obstacles,
        params: {
            gridSize: state.params.gridSize,
            maxFoodCount: state.params.maxFoodCount,
            maxEnergy: state.params.maxEnergy
        },
        stats: {
            restarts: state.stats.restarts,
            generation: state.stats.generation,
            creatureCount: state.stats.creatureCount,
            foodCount: state.stats.foodCount
        }
    };
}

async function updateState() {
    const offsprings = [];
    const movements = await getMovements(state);

    state.creatures = await Promise.all(state.creatures.map(async (creature, i) => {
        const movement = movements[i];

        let newAngle = creature.facingAngle + movement.angle_delta;
        newAngle = ((newAngle + Math.PI) % (2 * Math.PI)) - Math.PI; // wrap to [-pi, pi]

        let moveX = movement.speed * Math.cos(newAngle);
        let moveY = movement.speed * Math.sin(newAngle);
        let newX = creature.x + moveX;
        let newY = creature.y + moveY;

        const speedPenalty = movement.speed / CONFIG.CREATURE_MAX_SPEED;
        const turnPenalty = Math.abs(movement.angle_delta) / CONFIG.CREATURE_MAX_TURN_ANGLE;
        const activityCost = 0.2 + 0.4 * speedPenalty + 0.4 * turnPenalty;
        creature.energy = Math.max(creature.energy - CONFIG.CREATURE_ENERGY_LOSS * activityCost, 0);

        const hitsObstacle = state.obstacles.some(o =>
            Math.abs(o.x - newX) < CONFIG.CREATURE_INTERACTION_RADIUS &&
            Math.abs(o.y - newY) < CONFIG.CREATURE_INTERACTION_RADIUS
        )
        const hitsBorder = newX < 0 || newX >= CONFIG.GRID_SIZE || newY < 0 || newY >= CONFIG.GRID_SIZE;

        if (hitsObstacle || hitsBorder) {
            const tryX = !state.obstacles.some(o =>
                Math.abs(o.x - newX) < CONFIG.CREATURE_INTERACTION_RADIUS &&
                Math.abs(o.y - creature.y) < CONFIG.CREATURE_INTERACTION_RADIUS
            );
            const tryY = !state.obstacles.some(o =>
                Math.abs(o.x - creature.x) < CONFIG.CREATURE_INTERACTION_RADIUS &&
                Math.abs(o.y - newY) < CONFIG.CREATURE_INTERACTION_RADIUS
            );

            if (tryX && !tryY) {
                newY = creature.y; // slide along x
            } else if (tryY && !tryX) {
                newX = creature.x; // slide along y
            } else if (tryX && tryY) {
                // slide along axis with greater movement
                if (Math.abs(moveX) > Math.abs(moveY)) {
                    newY = creature.y;
                } else {
                    newX = creature.x;
                }
            } else {
                // fully blocked
                newX = creature.x;
                newY = creature.y;
            }
            creature.energy = Math.max(creature.energy - CONFIG.CREATURE_COLLISION_PENALTY, 0);
            creature.updatesToFlash = CONFIG.CREATURE_COLLISION_UPDATES_TO_FLASH;
        }
        else if (creature.updatesToFlash > 0) {
            creature.updatesToFlash--;
        }

        newX = Math.max(0, Math.min(CONFIG.GRID_SIZE - 1, newX));
        newY = Math.max(0, Math.min(CONFIG.GRID_SIZE - 1, newY));

        const foodIndex = state.food.findIndex(f =>
            Math.abs(f.x - newX) < CONFIG.CREATURE_INTERACTION_RADIUS &&
            Math.abs(f.y - newY) < CONFIG.CREATURE_INTERACTION_RADIUS
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

        const path = [...creature.recentPath, { x: newX, y: newY }];
        if (path.length > CONFIG.CREATURE_PATH_LENGTH) path.shift();

        creature.stats.turnsSurvived++;

        return {
            ...creature,
            x: newX,
            y: newY,
            facingAngle: newAngle,
            prev: {
                x: creature.x,
                y: creature.y,
                facingAngle: creature.facingAngle,
                energy: creature.energy
            },
            recentPath: path
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

    // gradually remove old top performers
    state.topPerformers.forEach(p => p.score *= 0.99);
}

function addFood(x, y) {
    if (!isCellOccupied(x, y, state)) {
        state.food.push({ x, y });
        state.stats.foodCount = state.food.length;
    }
}

function getFoodCount() {
    return state.food.length;
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

module.exports = {
    initState,
    updateState,
    getPublicState,
    saveState,
    addFood,
    getFoodCount
};
