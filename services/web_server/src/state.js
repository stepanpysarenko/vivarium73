const fs = require('fs').promises;
const path = require('path');
const CONFIG = require('./config');
const { initCreature, getScore } = require("./creature");
const { getMovements, mutateWeights } = require("./nn");
const { getObstacles, getBorderObstacles, updateFood, isCellOccupied, isWithinRadius } = require("./grid");
const { appendTopPerformers, restartPopulation } = require("./performance");

const r2Interaction = CONFIG.CREATURE_INTERACTION_RADIUS ** 2;
const r2Mating = CONFIG.CREATURE_MATING_RADIUS ** 2;

var state = null;

function ensureCreatureDefaults(creature) {
    if (!creature) return;
    if (!creature.prev) {
        creature.prev = { x: creature.x, y: creature.y, angle: creature.angle, energy: creature.energy };
    }
    if (!creature.stats) {
        creature.stats = { msLived: 0, energyGained: 0, score: 0 };
    }
    if (!creature.recentPath) {
        creature.recentPath = [{ x: creature.x, y: creature.y }];
    }
    if (!creature.sex) {
        creature.sex = Math.random() < 0.5 ? 'F' : 'M';
    }
    creature.matingCooldown = typeof creature.matingCooldown === 'number' ? creature.matingCooldown : 0;
    creature.mateIntent = typeof creature.mateIntent === 'number' ? creature.mateIntent : 0;
    creature.matedThisTick = false;
    if (typeof creature.justReproduced !== 'boolean') {
        creature.justReproduced = false;
    }
    if (!Array.isArray(creature.weights)) {
        creature.weights = [];
    }
}

function ensureStateDefaults(currentState) {
    currentState.eggs = currentState.eggs || [];
    currentState.lastEggId = currentState.lastEggId || 0;
    currentState.topPerformers = currentState.topPerformers || [];
    if (!currentState.borderObstacles) {
        currentState.borderObstacles = getBorderObstacles();
    }
    currentState.creatures.forEach(ensureCreatureDefaults);
}

async function initState() {
    state = await loadState();
    if (!state) {
        state = {
            creatures: [],
            food: [],
            obstacles: getObstacles(),
            borderObstacles: getBorderObstacles(),
            eggs: [],
            stats: {
                restarts: 0,
                generation: 1,
                creatureCount: 0,
                foodCount: 0
            },
            lastCreatureId: 0,
            lastEggId: 0,
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

    ensureStateDefaults(state);
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
        obstacles: state.obstacles,
        eggs: state.eggs.map(e => ({
            id: e.id,
            x: round2(e.x),
            y: round2(e.y),
            hatchIn: Math.max(0, e.hatchAt - Date.now()),
            generation: e.parentGeneration
        }))
    };
}

async function updateState() {
    const movements = await getMovements(state);
    const movementsMap = new Map(movements.map(m => [m.id, m]));

    for (const creature of state.creatures) {
        creature.matedThisTick = false;
        creature.mateIntent = 0;
    }

    for (const creature of state.creatures) {
        creature.wanderAngle = wrapAngle(creature.wanderAngle + (Math.random() - 0.5) * 0.2);
        creature.updatesToFlash = Math.max(creature.updatesToFlash - 1, 0);

        applyMovement(creature, movementsMap.get(creature.id));
        handleObstacleCollision(creature);
        handleEating(creature);
    }

    const matingImmunity = handleMating();
    const creaturesMap = buildCreatureMap(state.creatures);
    state.creatures.forEach(c => handleCreatureCollision(c, creaturesMap, matingImmunity));

    state.creatures = await handleLifecycle();
    if (state.creatures.length == 0 || state.creatures.length < CONFIG.POPULATION_RESTART_THRESHOLD) {
        for (const creature of state.creatures) {
            appendTopPerformers(creature, state);
        }
        await restartPopulation(state);
        state.eggs = [];
        state.lastEggId = 0;
        state.stats.restarts++;
        saveState();
    }

    updateFood(state);
    updateStats();
}

function applyMovement(creature, movement) {
    const resolved = movement || { angleDelta: 0, speed: 0, mateIntent: 0 };
    creature.mateIntent = Math.min(Math.max(resolved.mateIntent ?? 0, 0), 1);

    creature.prev.angle = creature.angle;
    creature.prev.x = creature.x;
    creature.prev.y = creature.y;

    creature.angle = wrapAngle(creature.angle + resolved.angleDelta);
    creature.x += resolved.speed * Math.cos(creature.angle);
    creature.y += resolved.speed * Math.sin(creature.angle);

    creature.recentPath.push({ x: creature.x, y: creature.y });
    if (creature.recentPath.length > CONFIG.CREATURE_PATH_LENGTH) {
        creature.recentPath.shift();
    }

    const speedLoss = resolved.speed / CONFIG.CREATURE_MAX_SPEED;
    const turnPLoss = Math.abs(resolved.angleDelta) / CONFIG.CREATURE_MAX_TURN_ANGLE_RAD;
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

function handleCreatureCollision(creature, creatureMap, immune = new Set()) {
    if (immune.has(creature.id)) {
        return;
    }
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

function getMatingEnergyCost(creature) {
    return creature.sex === 'F'
        ? CONFIG.CREATURE_MATE_COST_FEMALE
        : CONFIG.CREATURE_MATE_COST_MALE;
}

function canAttemptMating(creature) {
    return creature.energy >= CONFIG.CREATURE_MIN_ENERGY_TO_MATE
        && creature.matingCooldown <= 0
        && creature.mateIntent >= CONFIG.CREATURE_MATE_INTENT_THRESHOLD;
}

function mixWeights(parentA, parentB) {
    return parentA.weights.map((weight, idx) => (Math.random() < 0.5 ? weight : parentB.weights[idx]));
}

function registerEgg(parentA, parentB) {
    const egg = {
        id: ++state.lastEggId,
        x: (parentA.x + parentB.x) / 2,
        y: (parentA.y + parentB.y) / 2,
        hatchAt: Date.now() + CONFIG.EGG_INCUBATION_DURATION,
        parentGeneration: Math.max(parentA.generation, parentB.generation),
        weights: mixWeights(parentA, parentB)
    };
    state.eggs.push(egg);
    return egg;
}

function handleMating() {
    const immune = new Set();
    if (!state.creatures.length) {
        return immune;
    }

    const maxEggs = CONFIG.WORLD_MAX_EGGS || Infinity;

    for (let i = 0; i < state.creatures.length; i++) {
        const a = state.creatures[i];
        if (immune.has(a.id) || !canAttemptMating(a)) continue;

        for (let j = i + 1; j < state.creatures.length; j++) {
            const b = state.creatures[j];
            if (immune.has(b.id) || !canAttemptMating(b)) continue;
            if (a.sex === b.sex) continue;

            const dx = a.x - b.x;
            const dy = a.y - b.y;
            if (dx * dx + dy * dy > r2Mating) continue;

            if (state.eggs.length >= maxEggs) {
                return immune;
            }

            registerEgg(a, b);

            a.prev.energy = a.energy;
            b.prev.energy = b.energy;
            a.energy = Math.max(0, a.energy - getMatingEnergyCost(a));
            b.energy = Math.max(0, b.energy - getMatingEnergyCost(b));
            a.matingCooldown = CONFIG.CREATURE_MATING_COOLDOWN;
            b.matingCooldown = CONFIG.CREATURE_MATING_COOLDOWN;
            a.matedThisTick = true;
            b.matedThisTick = true;

            immune.add(a.id);
            immune.add(b.id);
            break;
        }
    }

    return immune;
}

async function handleLifecycle() {
    const survivors = [];

    for (const creature of state.creatures) {
        creature.justReproduced = creature.matedThisTick;
        creature.matedThisTick = false;
        creature.matingCooldown = Math.max(creature.matingCooldown - CONFIG.STATE_UPDATE_INTERVAL, 0);

        if (creature.energy <= 0) {
            appendTopPerformers(creature, state);
            continue;
        }

        creature.stats.msLived += CONFIG.STATE_UPDATE_INTERVAL;
        creature.stats.score = getScore(creature);
        survivors.push(creature);
    }

    const hatchlings = await hatchEggs();
    return [...survivors, ...hatchlings];
}

function isHatchLocationBlocked(egg) {
    if (isBeyondGrid(egg.x, egg.y)) {
        return true;
    }

    const cellX = Math.floor(egg.x);
    const cellY = Math.floor(egg.y);

    if (state.food.some(f => f.x === cellX && f.y === cellY)) {
        return true;
    }

    if (state.obstacles.some(o => o.x === cellX && o.y === cellY)) {
        return true;
    }

    if (state.borderObstacles.some(o => o.x === cellX && o.y === cellY)) {
        return true;
    }

    return state.creatures.some(c => {
        const dx = c.x - egg.x;
        const dy = c.y - egg.y;
        return dx * dx + dy * dy < r2Interaction;
    });
}

async function hatchEggs() {
    if (!state.eggs.length) {
        return [];
    }

    const hatchlings = [];
    const remainingEggs = [];
    const now = Date.now();

    for (const egg of state.eggs) {
        if (now >= egg.hatchAt) {
            if (isHatchLocationBlocked(egg)) {
                egg.hatchAt = now + CONFIG.STATE_UPDATE_INTERVAL;
                remainingEggs.push(egg);
                continue;
            }

            const mutatedWeights = await mutateWeights(egg.weights);
            const angle = (Math.random() * 2 * Math.PI) - Math.PI;
            const hatchling = await initCreature(state, egg.x, egg.y, angle, mutatedWeights, egg.parentGeneration + 1);
            hatchlings.push(hatchling);
        } else {
            remainingEggs.push(egg);
        }
    }

    state.eggs = remainingEggs;
    return hatchlings;
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
        handleLifecycle,
        handleMating,
        buildCreatureMap,
        wrapAngle,
        setState,
        getState: () => state
    };
}
