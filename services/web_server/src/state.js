const fs = require('fs').promises;
const path = require('path');
const { initCreature, getScore } = require("./creature");
const { getMovements, mutateWeights } = require("./nn");
const { getObstacles, getBorderObstacles, updateFood, isCellOccupied, isWithinRadius, buildStateIndexes, buildCreatureIndex } = require("./grid");
const { appendTopPerformers, restartPopulation } = require("./performance");

function round2(x) {
    return Math.round(x * 100) / 100;
}

function wrapAngle(angle) {
    const TWO_PI = 2 * Math.PI;
    return ((angle + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
}

async function loadState(savePath) {
    const filePath = path.resolve(savePath);
    try {
        await fs.access(filePath);
    } catch {
        return null;
    }
    
    try {
        const fileData = await fs.readFile(filePath, 'utf8');
        const state = JSON.parse(fileData);
        console.log(`State successfully loaded from ${filePath}`);
        return state;
    } catch (error) {
        console.warn(`Error loading state from ${filePath}:`, error.message);
        return null;
    }
}

async function saveState(state, savePath) {
    const filePath = path.resolve(savePath);
    try {
        const data = JSON.stringify(state, null, 4);
        await fs.writeFile(filePath, data, 'utf8');
        console.log('State successfully saved to', filePath);
    } catch (error) {
        console.error(`Error saving state to ${filePath}:`, error.message);
    }
}

async function createState(config) {
    let state = await loadState(config.STATE_SAVE_PATH);
    if (!state) {
        state = {
            creatures: [],
            food: [],
            obstacles: getObstacles(),
            borderObstacles: getBorderObstacles(config),
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

        buildStateIndexes(state);
        updateFood(state, config);

        for (let i = 0; i < config.CREATURE_INITIAL_COUNT; i++) {
            const creature = await initCreature(state, config);
            state.creatures.push(creature);
        }

        console.log("New random state initialized");
    } else {
        buildStateIndexes(state);
    }
    return state;
}

function getPublicState(state, config) {
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
            energy: round2(c.energy / config.CREATURE_MAX_ENERGY),
            flashing: c.updatesToFlash > 0,
            generation: c.generation,
            score: c.stats.score,
            msLived: c.stats.msLived
        })),
        food: state.food,
        obstacles: state.obstacles
    };
}

async function updateState(state, config) {
    const movements = await getMovements(state, config);
    const movementsMap = new Map(movements.map(m => [m.id, m]));

    for (const creature of state.creatures) {
        creature.wanderAngle = wrapAngle(creature.wanderAngle + (Math.random() - 0.5) * 0.2);
        creature.updatesToFlash = Math.max(creature.updatesToFlash - 1, 0);

        const movement = movementsMap.get(creature.id);
        if (!movement) continue;

        applyMovement(creature, movement, config);
        handleObstacleCollision(creature, state, config);
        handleEating(creature, state, config);
    }

    state.creatureMap = buildCreatureIndex(state.creatures);
    state.creatures.forEach(c => handleCreatureCollision(c, state, config));

    state.creatures = await handleLifecycle(state, config);
    if (state.creatures.length === 0 || state.creatures.length < config.POPULATION_RESTART_THRESHOLD) {
        for (const creature of state.creatures) {
            appendTopPerformers(creature, state, config);
        }
        await restartPopulation(state, config);
        state.stats.restarts++;
        await saveState(state, config.STATE_SAVE_PATH);
    }

    updateFood(state, config);
    updateStats(state);
}

function applyMovement(creature, movement, config) {
    creature.prev.angle = creature.angle;
    creature.prev.x = creature.x;
    creature.prev.y = creature.y;

    creature.angle = wrapAngle(creature.angle + movement.angleDelta);
    creature.x += movement.speed * Math.cos(creature.angle);
    creature.y += movement.speed * Math.sin(creature.angle);

    creature.recentPath.push({ x: creature.x, y: creature.y });
    if (creature.recentPath.length > config.CREATURE_PATH_MAX_ENTRIES) {
        creature.recentPath.shift();
    }

    const speedLoss = movement.speed / config.CREATURE_MAX_SPEED;
    const turnLoss = Math.abs(movement.angleDelta) / config.CREATURE_MAX_TURN_ANGLE_RADIANS;
    const activityCost = config.CREATURE_ENERGY_LOSS_BASE
        + config.CREATURE_ENERGY_LOSS_SPEED_FACTOR * speedLoss
        + config.CREATURE_ENERGY_LOSS_TURN_FACTOR * turnLoss;
    creature.prev.energy = creature.energy;
    creature.energy = Math.max(creature.energy - config.CREATURE_ENERGY_LOSS_FACTOR * activityCost, 0);
}

function isObstacleCollision(x, y, state, config) {
    const r2Interaction = config.CREATURE_INTERACTION_RADIUS ** 2;
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    for (let dx = 0; dx <= 1; dx++) {
        for (let dy = 0; dy <= 1; dy++) {
            const obstacle = state.obstacleMap.get(`${fx + dx},${fy + dy}`);
            if (obstacle && isWithinRadius(obstacle.x, obstacle.y, x, y, r2Interaction)) return true;
        }
    }
    return false;
}

function isBeyondGrid(x, y, config) {
    return x < 0 || x > config.GRID_SIZE - 1 || y < 0 || y > config.GRID_SIZE - 1;
}

function handleObstacleCollision(creature, state, config) {
    let newX = creature.x;
    let newY = creature.y;
    let prevX = creature.prev.x;
    let prevY = creature.prev.y;

    // when hitting an obstacle the creature takes damage and slides along it if possible
    if (isObstacleCollision(newX, newY, state, config) || isBeyondGrid(newX, newY, config)) {
        const tryX = !isObstacleCollision(newX, prevY, state, config) && !isBeyondGrid(newX, prevY, config);
        const tryY = !isObstacleCollision(prevX, newY, state, config) && !isBeyondGrid(prevX, newY, config);

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

        creature.energy = Math.max(creature.energy - config.CREATURE_COLLISION_ENERGY_PENALTY, 0);
        creature.updatesToFlash = config.CREATURE_COLLISION_TICKS_TO_FLASH;
    }

    creature.x = Math.max(0, Math.min(config.GRID_SIZE - 1, newX));
    creature.y = Math.max(0, Math.min(config.GRID_SIZE - 1, newY));
}

function handleCreatureCollision(creature, state, config) {
    const fx = Math.floor(creature.x);
    const fy = Math.floor(creature.y);
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const others = state.creatureMap.get(`${fx + dx},${fy + dy}`) || [];
            for (const other of others) {
                if (other.id === creature.id) continue;
                const dist = Math.hypot(other.x - creature.x, other.y - creature.y);
                if (dist < config.CREATURE_INTERACTION_RADIUS && dist > 0.001) {
                    creature.energy = Math.max(creature.energy - config.CREATURE_COLLISION_ENERGY_PENALTY, 0);
                    creature.updatesToFlash = config.CREATURE_COLLISION_TICKS_TO_FLASH;
                }
            }
        }
    }
}

function handleEating(creature, state, config) {
    const r2Interaction = config.CREATURE_INTERACTION_RADIUS ** 2;
    let foodEnergy = config.FOOD_ENERGY;
    // apply a gradually decreasing energy bonus for early generations
    if (state.stats.generation <= config.FOOD_ENERGY_BONUS_MAX_GENERATION) {
        const progress = state.stats.generation / config.FOOD_ENERGY_BONUS_MAX_GENERATION;
        foodEnergy += Math.round(config.FOOD_ENERGY_BONUS * (1 - progress));
    }

    const fx = Math.floor(creature.x);
    const fy = Math.floor(creature.y);
    for (let dx = 0; dx <= 1; dx++) {
        for (let dy = 0; dy <= 1; dy++) {
            const key = `${fx + dx},${fy + dy}`;
            const food = state.foodMap.get(key);
            if (!food) continue;
            const ddx = food.x - creature.x;
            const ddy = food.y - creature.y;
            if (ddx * ddx + ddy * ddy < r2Interaction) {
                const energyGained = Math.min(creature.energy + foodEnergy, config.CREATURE_MAX_ENERGY) - creature.energy;
                creature.energy += energyGained;
                creature.stats.energyGained += energyGained;
                const idx = state.food.indexOf(food);
                if (idx !== -1) state.food.splice(idx, 1);
                state.foodMap.delete(key);
                return;
            }
        }
    }
}

async function handleLifecycle(state, config) {
    const survivors = [];
    const offspring = [];

    for (const creature of state.creatures) {
        creature.justReproduced = false;

        // creatures at 100% energy spawn an offspring and pay the reproduction cost
        if (creature.energy >= config.CREATURE_MAX_ENERGY) {
            const weights = Math.random() <= config.MUTATION_CHANCE
                ? await mutateWeights(creature.weights)
                : creature.weights;

            const offspringAngle = wrapAngle(creature.angle + Math.PI);
            const offspringCreature = await initCreature(
                state,
                config,
                creature.x,
                creature.y,
                offspringAngle,
                weights,
                creature.generation + 1
            );
            offspring.push(offspringCreature);

            creature.energy = config.CREATURE_MAX_ENERGY - config.CREATURE_REPRODUCTION_ENERGY_COST;
            creature.justReproduced = true;
        } else if (creature.energy <= 0) {
            appendTopPerformers(creature, state, config);
            continue;
        }

        creature.stats.msLived += config.STATE_UPDATE_INTERVAL_MS;
        creature.stats.score = getScore(creature);
        survivors.push(creature);
    }

    return [...survivors, ...offspring];
}

function updateStats(state) {
    state.stats.creatureCount = state.creatures.length;
    state.stats.foodCount = state.food.length;
    const maxGen = Math.max(...state.creatures.map(c => c.generation), 0);
    if (maxGen > state.stats.generation) {
        state.stats.generation = maxGen;
    }
}

function addFood(x, y, state, config) {
    if (state.food.length >= config.FOOD_MAX_COUNT) {
        throw new Error("Max food count reached");
    }

    if (isBeyondGrid(x, y, config)) {
        throw new Error("Invalid coordinates");
    }

    if (isCellOccupied(x, y, state)) {
        throw new Error("Cell is occupied");
    }

    const food = { x, y };
    state.food.push(food);
    state.foodMap.set(`${x},${y}`, food);
    state.stats.foodCount = state.food.length;
}

module.exports = {
    createState,
    loadState,
    saveState,
    getPublicState,
    updateState,
    addFood
};

if (process.env.NODE_ENV === 'test') {
    module.exports.__testUtils = {
        applyMovement,
        handleEating,
        handleObstacleCollision,
        handleLifecycle,
        handleCreatureCollision,
        wrapAngle,
    };
}
