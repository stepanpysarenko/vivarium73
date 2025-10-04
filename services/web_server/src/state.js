const fs = require('fs').promises;
const path = require('path');
const CONFIG = require('./config');
const { initCreature, getScore } = require("./creature");
const { getMovements, mutateWeights } = require("./nn");
const { getObstacles, getBorderObstacles, updateFood, isCellOccupied, isWithinRadius } = require("./grid");
const { appendTopPerformers, restartPopulation } = require("./performance");

const r2Interaction = CONFIG.CREATURE_INTERACTION_RADIUS ** 2;

var state = null;

async function initState() {
    state = await loadState();
    if (!state) {
        state = {
            creatures: [],
            food: [],
            obstacles: getObstacles(),
            borderObstacles: getBorderObstacles(),
            stats: {
                restarts: 0,
                generation: 1,
                creatureCount: 0,
                foodCount: 0
            },
            lastCreatureId: 0,
            topPerformers: [],
            createdAt: Date.now()
        };

        updateFood(state);

        for (let i = 0; i < CONFIG.CREATURE_INITIAL_COUNT; i++) {
            const creature = await initCreature(state);
            state.creatures.push(creature);
        }

        console.log("New random state initialized");
    }
}

async function saveState() {
    const filePath = path.resolve(CONFIG.STATE_SAVE_PATH);
    try {
        const data = JSON.stringify(state, null, 4);
        await fs.writeFile(filePath, data, 'utf8');
        console.log('State successfully saved to', filePath);
    } catch (error) {
        console.error(`Error saving state to ${filePath}:`, error.message);
    }
}

async function loadState() {
    const filePath = path.resolve(CONFIG.STATE_SAVE_PATH);
    try {
        await fs.access(filePath);
        const fileData = await fs.readFile(filePath, 'utf8');
        const state = JSON.parse(fileData);
        console.log(`State successfully loaded from ${filePath}`);
        return state;
    } catch (error) {
        console.warn(`Error loading state from ${filePath}:`, error.message);
        return null;
    }
}

function round2(x) {
    return Math.round(x * 100) / 100;
}

function wrapAngle(angle) {
    return ((angle + Math.PI) % (2 * Math.PI)) - Math.PI;
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
            energy: round2(c.energy / CONFIG.CREATURE_MAX_ENERGY),
            flashing: c.updatesToFlash > 0,
            generation: c.generation,
            score: c.stats.score,
            msLived: c.stats.msLived
        })),
        food: state.food,
        obstacles: state.obstacles
    };
}

async function updateState() {
    const movements = await getMovements(state);
    const movementsMap = new Map(movements.map(m => [m.id, m]));

    state.creatures.forEach(c => {
        applyMovement(c, movementsMap.get(c.id));
        handleObstacleCollision(c);
        handleEating(c);
        c.wanderAngle = wrapAngle(c.wanderAngle + (Math.random() - 0.5) * 0.2); 
        c.updatesToFlash = Math.max(c.updatesToFlash - 1, 0);
    });

    const creaturesMap = buildCreatureMap(state.creatures);
    state.creatures.forEach(c => handleCreatureCollision(c, creaturesMap));

    state.creatures = await handleLifecycle();
    if (state.creatures.length == 0 || state.creatures.length < CONFIG.POPULATION_RESTART_THRESHOLD) {
        for (const creature of state.creatures) {
            appendTopPerformers(creature, state);
        }
        await restartPopulation(state);
        state.stats.restarts++;
        saveState();
    }

    updateFood(state);
    updateStats();
}

function applyMovement(creature, movement) {
    creature.prev.angle = creature.angle;
    creature.prev.x = creature.x;
    creature.prev.y = creature.y;

    creature.angle = wrapAngle(creature.angle + movement.angleDelta);
    creature.x += movement.speed * Math.cos(creature.angle);
    creature.y += movement.speed * Math.sin(creature.angle);

    creature.recentPath.push({ x: creature.x, y: creature.y });
    if (creature.recentPath.length > CONFIG.CREATURE_PATH_LENGTH) {
        creature.recentPath.shift();
    }

    const speedLoss = movement.speed / CONFIG.CREATURE_MAX_SPEED;
    const turnPLoss = Math.abs(movement.angleDelta) / CONFIG.CREATURE_MAX_TURN_ANGLE_RAD;
    const activityCost = CONFIG.CREATURE_ENERGY_LOSS_BASE
        + CONFIG.CREATURE_ENERGY_LOSS_SPEED_FACTOR * speedLoss
        + CONFIG.CREATURE_ENERGY_LOSS_TURN_FACTOR * turnPLoss;
    creature.prev.energy = creature.energy;
    creature.energy = Math.max(creature.energy - CONFIG.CREATURE_ENERGY_LOSS * activityCost, 0);
}

function isObstacleCollision(x, y) {
    return state.obstacles.some(o => isWithinRadius(o.x, o.y, x, y, r2Interaction));
}

function isBeyondGrid(x, y) {
    return x < 0 || x > CONFIG.GRID_SIZE - 1 || y < 0 || y > CONFIG.GRID_SIZE - 1;
}

function handleObstacleCollision(creature) {
    let newX = creature.x;
    let newY = creature.y;
    let prevX = creature.prev.x;
    let prevY = creature.prev.y;

    // when hiting an obstacle the creatures takes damage and slides along it if possible
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

        creature.energy = Math.max(creature.energy - CONFIG.CREATURE_COLLISION_PENALTY, 0);
        creature.updatesToFlash = CONFIG.CREATURE_COLLISION_UPDATES_TO_FLASH;
    }

    creature.x = Math.max(0, Math.min(CONFIG.GRID_SIZE - 1, newX));
    creature.y = Math.max(0, Math.min(CONFIG.GRID_SIZE - 1, newY));
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
                    creature.energy = Math.max(creature.energy - CONFIG.CREATURE_COLLISION_PENALTY, 0);
                    creature.updatesToFlash = CONFIG.CREATURE_COLLISION_UPDATES_TO_FLASH;
                }
            }
        }
    }
}

function handleEating(creature) {
    const foodIndex = state.food.findIndex(f => {
        const dx = f.x - creature.x;
        const dy = f.y - creature.y;
        return dx * dx + dy * dy < r2Interaction;
    });

    let foodEnergy = CONFIG.FOOD_ENERGY;
    // apply a gradually decreasing energy bonus for early generations
    if (state.stats.generation <= CONFIG.FOOD_ENERGY_BONUS_MAX_GEN) {
        const progress = state.stats.generation / CONFIG.FOOD_ENERGY_BONUS_MAX_GEN;
        foodEnergy += Math.round(CONFIG.FOOD_ENERGY_BONUS * (1 - progress));
    }

    if (foodIndex !== -1) {
        creature.energy = Math.min(creature.energy + foodEnergy, CONFIG.CREATURE_MAX_ENERGY);
        creature.stats.energyGained += CONFIG.FOOD_ENERGY;
        state.food.splice(foodIndex, 1);
    }
}

async function handleLifecycle() {
    const survivors = [];
    const offsprings = [];

    for (const creature of state.creatures) {
        creature.justReproduced = false;

        // creatures at 100% energy spawn an offspring andpay the reproduction cost
        if (creature.energy >= CONFIG.CREATURE_MAX_ENERGY) {
            const weights = Math.random() <= CONFIG.MUTATION_CHANCE
                ? await mutateWeights(creature.weights)
                : creature.weights;

            const offspringAngle = wrapAngle(creature.angle + Math.PI);
            const offspring = await initCreature(state, creature.x, creature.y, offspringAngle, weights, creature.generation + 1);
            offsprings.push(offspring);

            creature.energy = CONFIG.CREATURE_MAX_ENERGY - CONFIG.CREATURE_REPRODUCTION_ENERGY_COST;
            creature.justReproduced = true;
        } else if (creature.energy <= 0) {
            appendTopPerformers(creature, state);
            continue;
        }

        creature.stats.msLived += CONFIG.STATE_UPDATE_INTERVAL;
        creature.stats.score = getScore(creature);
        survivors.push(creature);
    }

    return [...survivors, ...offsprings];
}

function updateStats() {
    state.stats.creatureCount = state.creatures.length;
    state.stats.foodCount = state.food.length;
    state.stats.generation = Math.max(...state.creatures.map(c => c.generation), 0);
}

function addFood(x, y) {
    if (state.food.length >= CONFIG.FOOD_MAX_COUNT) {
        throw new Error("Max food count reached");
    }

    if (isBeyondGrid(x, y)) {
        throw new Error("Invalid coordinates");
    }

    if (isCellOccupied(x, y, state)) {
        throw new Error("Cell is occupied");
    }

    state.food.push({ x, y });
    state.stats.foodCount = state.food.length;
}

module.exports = {
    initState,
    saveState,
    getPublicState,
    updateState,
    addFood
};

if (process.env.NODE_ENV === 'test') {
    function setState(testState) {
        state = testState;
    }

    module.exports.__testUtils = {
        applyMovement,
        handleEating,
        handleCreatureCollision,
        buildCreatureMap,
        wrapAngle,
        setState,
        getState: () => state
    };
}
