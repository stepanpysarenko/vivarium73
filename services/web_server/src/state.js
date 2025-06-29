const fs = require('fs');
const path = require('path');
const CONFIG = require('./config');
const { initCreature, getNextCreatureId } = require("./creature");
const { getMovements, mutateWeights } = require("./nn");
const { getObstacles, getBorderObstacles, updateFood, isCellOccupied, isWithinRadius } = require("./grid");
const { appendTopPerformers, restartPopulation } = require("./performance");

var state = null;

async function initState() {
    state = loadState();
    if (!state) {
        state = {
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
            lastCreatureId: 0,
            creatures: [],
            food: [],
            obstacles: getObstacles(),
            borderObstacles: getBorderObstacles(),
            topPerformers: []
        };

        updateFood(state);

        for (let i = 0; i < CONFIG.CREATURE_INITIAL_COUNT; i++) {
            const creature = await initCreature(getNextCreatureId(state));
            state.creatures.push(creature);
        }

        console.log("New random state initialized");
    }
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

function round2(x) {
    return Math.round(x * 100) / 100;
}

function getPublicState() {
    return {
        stats: {
            restarts: state.stats.restarts,
            generation: state.stats.generation,
            creatureCount: state.stats.creatureCount,
            foodCount: state.stats.foodCount
        },
        creatures: state.creatures.map(c => ({
            id: c.id,
            x: round2(c.x),
            y: round2(c.y),
            angle: round2(c.angle),
            energy: round2(c.energy),
            flashing: c.updatesToFlash > 0
        })),
        food: state.food,
        obstacles: state.obstacles
    };
}

function getPublicParams() {
    return {
        gridSize: state.params.gridSize,
        maxFoodCount: state.params.maxFoodCount,
        maxEnergy: state.params.maxEnergy
    };
}

async function updateState() {
    const movements = await getMovements(state);
    for (let i = 0; i < state.creatures.length; i++) {
        state.creatures[i] = applyMovement(state.creatures[i], movements[i]);
        state.creatures[i] = handleObstacleCollision(state.creatures[i]);
        handleEating(state.creatures[i]);
    }

    const creatureMap = buildCreatureMap(state.creatures);
    for (let i = 0; i < state.creatures.length; i++) {
        state.creatures[i] = handleCreatureCollision(state.creatures[i], creatureMap);
    }

    for (const creature of state.creatures) {
        if (creature._collisionOccurred) {
            creature.updatesToFlash = CONFIG.CREATURE_COLLISION_UPDATES_TO_FLASH;
            creature.energy = Math.max(creature.energy - CONFIG.CREATURE_COLLISION_PENALTY, 0);
        } else {
            creature.updatesToFlash = Math.max(creature.updatesToFlash - 1, 0);
        }
        delete creature._collisionOccurred;
    }

    state.creatures = await handleLifecycle();
    if (state.creatures.length <= CONFIG.POPULATION_RESTART_THRESHOLD) {
        await restartPopulation(state);
        state.stats.restarts++;
        saveState();
    }

    updateFood(state);
    updateStats();
}

function applyMovement(creature, movement) {
    let newAngle = creature.angle + movement.angleDelta;
    newAngle = ((newAngle + Math.PI) % (2 * Math.PI)) - Math.PI;

    let moveX = movement.speed * Math.cos(newAngle);
    let moveY = movement.speed * Math.sin(newAngle);
    let newX = creature.x + moveX;
    let newY = creature.y + moveY;

    const speedLoss = movement.speed / CONFIG.CREATURE_MAX_SPEED;
    const turnPLoss = Math.abs(movement.angleDelta) / CONFIG.CREATURE_MAX_TURN_ANGLE;
    const activityCost = CONFIG.CREATURE_ENERGY_LOSS_BASE
        + CONFIG.CREATURE_ENERGY_LOSS_SPEED_FACTOR * speedLoss
        + CONFIG.CREATURE_ENERGY_LOSS_TURN_FACTOR * turnPLoss;
    const newEnergy = Math.max(creature.energy - CONFIG.CREATURE_ENERGY_LOSS * activityCost, 0);

    const path = [...creature.recentPath, { x: newX, y: newY }];
    if (path.length > CONFIG.CREATURE_PATH_LENGTH) path.shift();

    return {
        ...creature,
        x: newX,
        y: newY,
        angle: newAngle,
        energy: newEnergy,
        prev: {
            x: creature.x,
            y: creature.y,
            angle: creature.angle,
            energy: creature.energy
        },
        recentPath: path
    };
}

function isObstacleCollision(x, y) {
    return state.obstacles.some(o => isWithinRadius(o.x, o.y, x, y, CONFIG.CREATURE_INTERACTION_RADIUS ** 2));
}

function isBeyondGrid(x, y) {
    return x < 0 || x >= CONFIG.GRID_SIZE - 1 || y < 0 || y >= CONFIG.GRID_SIZE - 1;
}

function handleObstacleCollision(creature) {
    let newX = creature.x;
    let newY = creature.y;
    let prevX = creature.prev.x;
    let prevY = creature.prev.y;

    if (isObstacleCollision(newX, newY) || isBeyondGrid(newX, newY)) {
        const tryX = !isObstacleCollision(newX, prevY) && !isBeyondGrid(newX, prevY);
        const tryY = !isObstacleCollision(prevX, newY) && !isBeyondGrid(prevX, newY);

        if (tryX && !tryY) {
            newY = prevY;
        } else if (tryY && !tryX) {
            newX = prevX;
        } else if (tryX && tryY) {
            if (Math.abs(newX - prevX) > Math.abs(newY - prevY)) {
                newY = prevY;
            } else {
                newX = prevX;
            }
        } else {
            newX = prevX;
            newY = prevY;
        }

        creature._collisionOccurred = true;
    }

    creature.x = Math.max(0, Math.min(CONFIG.GRID_SIZE - 1, newX));
    creature.y = Math.max(0, Math.min(CONFIG.GRID_SIZE - 1, newY));

    return creature;
}

function buildCreatureMap(creatures) {
    const map = new Map();
    for (const c of creatures) {
        const key = `${Math.floor(c.x)},${Math.floor(c.y)}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(c);
    }
    return map;
}

function handleCreatureCollision(creature, creatureMap) {
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const key = `${Math.floor(creature.x) + dx},${Math.floor(creature.y) + dy}`;
            const others = creatureMap.get(key) || [];
            for (const other of others) {
                if (other.id === creature.id) continue;
                const dist = Math.hypot(other.x - creature.x, other.y - creature.y);
                if (dist < CONFIG.CREATURE_INTERACTION_RADIUS && dist > 0.001) {
                    creature._collisionOccurred = true;
                    return creature;
                }
            }
        }
    }
    return creature;
}

function handleEating(creature) {
    const rSquared = CONFIG.CREATURE_INTERACTION_RADIUS ** 2;
    const foodIndex = state.food.findIndex(f => {
        const dx = f.x - creature.x;
        const dy = f.y - creature.y;
        return dx * dx + dy * dy < rSquared;
    });

    if (foodIndex !== -1) {
        creature.energy = Math.min(creature.energy + CONFIG.FOOD_ENERGY, CONFIG.CREATURE_MAX_ENERGY);
        creature.stats.totalFoodCollected++;
        state.food.splice(foodIndex, 1);
    }
}

async function handleLifecycle() {
    const survivors = [];
    const offsprings = [];

    for (const creature of state.creatures) {
        creature.justReproduced = false;

        if (creature.energy >= CONFIG.CREATURE_MAX_ENERGY) {
            const weights = Math.random() <= CONFIG.MUTATION_CHANCE
                ? await mutateWeights(creature.weights)
                : creature.weights;

            const offspring = await initCreature(getNextCreatureId(state), creature.x, creature.y, weights, creature.generation + 1);
            offsprings.push(offspring);

            creature.energy = CONFIG.CREATURE_MAX_ENERGY - CONFIG.CREATURE_REPRODUCTION_ENERGY_COST;
            creature.justReproduced = true;
        } else if (creature.energy <= 0) {
            appendTopPerformers(creature, state);
            continue;
        }

        creature.stats.updatesSurvived++;
        survivors.push(creature);
    }

    return [...survivors, ...offsprings];
}

function updateStats() {
    state.stats.creatureCount = state.creatures.length;
    state.stats.foodCount = state.food.length;
    state.stats.generation = Math.max(...state.creatures.map(c => c.generation), 0);

    state.topPerformers.forEach(p => p.score *= 0.99); // gradually remove old top performers
}

function addFood(x, y) {
    if (isCellOccupied(x, y, state)) return false;

    state.food.push({ x, y });
    state.stats.foodCount = state.food.length;
    return true;
}

function getFoodCount() {
    return state.food.length;
}

module.exports = {
    initState,
    saveState,
    getPublicState,
    getPublicParams,
    updateState,
    addFood,
    getFoodCount
};
