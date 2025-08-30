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
            eggs: [],
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
            lastEggId: 0,
            topPerformers: []
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
            sex: c.sex,
            generation: c.generation,
            score: c.stats.score,
            msLived: c.stats.msLived
        })),
        eggs: state.eggs.map(e => ({ x: e.x, y: e.y })),
        food: state.food,
        obstacles: state.obstacles
    };
}

async function updateState() {
    const movements = await getMovements(state);
    const movementsMap = new Map(movements.map(m => [m.id, m]));

    state.creatures.forEach(c => {
        movementsMap.set(c.id, attractToMate(c, movementsMap.get(c.id))); // TODO to replace with NN steering
        applyMovement(c, movementsMap.get(c.id));
        handleObstacleCollision(c);
        handleEating(c);
    });

    const creatureMap = buildCreatureMap(state.creatures);
    state.creatures.forEach(c => handleCreatureCollision(c, creatureMap));

    handleMating(creatureMap);
 
    for (const creature of state.creatures) {
        if (creature._collisionOccurred) {
            creature.updatesToFlash = CONFIG.CREATURE_COLLISION_UPDATES_TO_FLASH;
        } else {
            creature.updatesToFlash = Math.max(creature.updatesToFlash - 1, 0);
        }
        delete creature._collisionOccurred;
        creature.mateCooldown = Math.max((creature.mateCooldown || 0) - 1, 0);

        creature.stats.msLived += CONFIG.STATE_UPDATE_INTERVAL;
        creature.stats.score = getScore(creature);
        if (creature.energy <= 0) appendTopPerformers(creature, state);
    }

    state.creatures = state.creatures.filter(c => c.energy > 0);
    updateEggs();

    if (state.creatures.length < CONFIG.POPULATION_RESTART_THRESHOLD) {
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
        creature.energy = Math.max(creature.energy - CONFIG.CREATURE_COLLISION_PENALTY, 0);
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
                    creature._collisionOccurred = true;
                    creature.energy = Math.max(creature.energy - CONFIG.CREATURE_COLLISION_PENALTY, 0);
                    return;
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

    if (foodIndex !== -1) {
        creature.energy = Math.min(creature.energy + CONFIG.FOOD_ENERGY, CONFIG.CREATURE_MAX_ENERGY);
        creature.stats.energyGained += CONFIG.FOOD_ENERGY;
        state.food.splice(foodIndex, 1);
    }
}

function nearestFemale(creature) {
    if (creature.sex !== 'M') return null;
    let best = null;
    let bestD2 = Infinity;
    for (const other of state.creatures) {
        if (other.sex !== 'F') continue;
        const dx = other.x - creature.x;
        const dy = other.y - creature.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
            bestD2 = d2;
            best = other;
        }
    }
    return best;
}

function attractToMate(creature, movement) {
    if (CONFIG.CREATURE_MATE_STEER_STRENGTH <= 0) return movement;
    if (creature.sex !== 'M') return movement;
    const female = nearestFemale(creature);
    if (!female) return movement;

    const desiredAngle = Math.atan2(female.y - creature.y, female.x - creature.x);
    const currentAngle = creature.angle + movement.angleDelta;
    let delta = ((desiredAngle - currentAngle + Math.PI) % (2 * Math.PI)) - Math.PI;
    const steer = delta * CONFIG.CREATURE_MATE_STEER_STRENGTH;
    return { ...movement, angleDelta: movement.angleDelta + steer };
}

function createEgg(x, y, weights, generation) {
    const id = ++state.lastEggId;
    state.eggs.push({ id, x, y, hatchIn: CONFIG.EGG_HATCH_UPDATES, weights, generation });
}

function updateEggs() {
    if (!state.eggs || state.eggs.length === 0) return;

    for (const egg of state.eggs) {
        egg.hatchIn = Math.max(egg.hatchIn - 1, 0);
    }
    const toHatch = state.eggs.filter(e => e.hatchIn === 0);
    if (toHatch.length > 0) {
        state.eggs = state.eggs.filter(e => e.hatchIn > 0);
        toHatch.forEach(async (egg) => {
            const creature = await initCreature(state, egg.x, egg.y, null, egg.weights, egg.generation);
            state.creatures.push(creature);
        });
    }
}

function canMate(a, b) {
    if (!a || !b) return false;
    const male = a.sex === 'M' ? a : (b.sex === 'M' ? b : null);
    const female = a.sex === 'F' ? a : (b.sex === 'F' ? b : null);
    if (!male || !female) return false;
    if ((male.mateCooldown || 0) > 0 || (female.mateCooldown || 0) > 0) return false;
    if (male.energy < CONFIG.CREATURE_MATE_MIN_ENERGY || female.energy < CONFIG.CREATURE_MATE_MIN_ENERGY) return false;
    return true;
}

async function matePair(male, female) {
    // decide offspring weights: mutate one parent's weights with configured chance
    let baseWeights = Math.random() < 0.5 ? male.weights : female.weights;
    let weights = baseWeights;
    if (Math.random() <= CONFIG.MUTATION_CHANCE) {
        try {
            weights = await mutateWeights(baseWeights);
        } catch (e) {
            // fall back to base weights on failure
            weights = baseWeights;
        }
    }

    // lay egg at female's current position
    createEgg(female.x, female.y, weights, Math.max(male.generation, female.generation) + 1);

    // apply costs and cooldowns
    male.energy = Math.max(male.energy - CONFIG.CREATURE_MATE_COST_MALE, 0);
    female.energy = Math.max(female.energy - CONFIG.CREATURE_MATE_COST_FEMALE, 0);
    male.mateCooldown = CONFIG.CREATURE_MATE_COOLDOWN_UPDATES;
    female.mateCooldown = CONFIG.CREATURE_MATE_COOLDOWN_UPDATES;
    male.justReproduced = true;
    female.justReproduced = true;
}

function handleMating(creatureMap) {
    // For each cell neighborhood, find M-F pairs within interaction radius and mate once per pair
    const visitedPairs = new Set();
    for (const creature of state.creatures) {
        creature.justReproduced = false; // reset from last cycle
        if (creature.sex !== 'M') continue;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const key = `${Math.floor(creature.x) + dx},${Math.floor(creature.y) + dy}`;
                const others = creatureMap.get(key) || [];
                for (const other of others) {
                    if (other.id === creature.id) continue;
                    if (other.sex !== 'F') continue;
                    const dist = Math.hypot(other.x - creature.x, other.y - creature.y);
                    if (dist < CONFIG.CREATURE_INTERACTION_RADIUS && canMate(creature, other)) {
                        const pid = creature.id < other.id ? `${creature.id}-${other.id}` : `${other.id}-${creature.id}`;
                        if (visitedPairs.has(pid)) continue;
                        visitedPairs.add(pid);
                        // fire and forget; lifecycle is async aware
                        matePair(creature, other);
                        // only one mating per male per update
                        break;
                    }
                }
            }
        }
    }
}

function updateStats() {
    state.stats.creatureCount = state.creatures.length;
    state.stats.foodCount = state.food.length;
    state.stats.generation = Math.max(...state.creatures.map(c => c.generation), 0);

    state.topPerformers.forEach(p => p.stats.score *= 0.99); // gradually remove old top performers
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
