process.env.NODE_ENV = 'test';

const CONFIG = require('../../src/config');
const stateModule = require('../../src/state');

const { __testUtils } = stateModule;

const createBaseState = () => ({
  creatures: [],
  food: [],
  obstacles: [],
  stats: {
    restarts: 0,
    generation: CONFIG.FOOD_ENERGY_BONUS_MAX_GENERATION + 1,
    creatureCount: 0,
    foodCount: 0,
  },
  lastCreatureId: 0,
});

describe('applyMovement', () => {
  beforeEach(() => {
    __testUtils.setState(createBaseState());
  });

  it('updates position and angle using provided movement', () => {
    const creature = {
      id: 1,
      x: 1,
      y: 2,
      angle: 0,
      prev: { x: 1, y: 2, angle: 0, energy: CONFIG.CREATURE_INITIAL_ENERGY },
      energy: CONFIG.CREATURE_INITIAL_ENERGY,
      recentPath: [],
    };

    const movement = { angleDelta: Math.PI / 4, speed: CONFIG.CREATURE_MAX_SPEED / 2 };

    __testUtils.applyMovement(creature, movement);

    expect(creature.angle).toBeCloseTo(movement.angleDelta);
    expect(creature.x).toBeCloseTo(1 + movement.speed * Math.cos(creature.angle));
    expect(creature.y).toBeCloseTo(2 + movement.speed * Math.sin(creature.angle));
  });
});

describe('energy adjustments', () => {
  beforeEach(() => {
    __testUtils.setState(createBaseState());
  });

  it('increases energy when eating food', () => {
    const state = __testUtils.getState();
    state.food.push({ x: 5, y: 5 });
    const creature = {
      id: 2,
      x: 5,
      y: 5,
      angle: 0,
      energy: CONFIG.CREATURE_MAX_ENERGY - CONFIG.FOOD_ENERGY,
      prev: { energy: CONFIG.CREATURE_MAX_ENERGY - CONFIG.FOOD_ENERGY },
      stats: { energyGained: 0 },
    };

    __testUtils.handleEating(creature);

    expect(creature.energy).toBe(CONFIG.CREATURE_MAX_ENERGY);
    expect(creature.stats.energyGained).toBe(CONFIG.FOOD_ENERGY);
    expect(state.food).toHaveLength(0);
  });

  it('decreases energy when colliding with another creature', () => {
    const creature = {
      id: 3,
      x: 1,
      y: 1,
      energy: 100,
      updatesToFlash: 0,
    };
    const other = {
      id: 4,
      x: 1.2,
      y: 1.2,
    };

    const map = __testUtils.buildCreatureMap([creature, other]);

    __testUtils.handleCreatureCollision(creature, map);

    expect(creature.energy).toBe(100 - CONFIG.CREATURE_COLLISION_ENERGY_PENALTY);
    expect(creature.updatesToFlash).toBe(CONFIG.CREATURE_COLLISION_TICKS_TO_FLASH);
  });
});

describe('addFood validation', () => {
  beforeEach(() => {
    __testUtils.setState(createBaseState());
  });

  it('adds food within bounds', () => {
    const state = __testUtils.getState();
    stateModule.addFood(3, 4);

    expect(state.food).toHaveLength(1);
    expect(state.stats.foodCount).toBe(1);
  });

  it('throws when coordinates are out of bounds', () => {
    expect(() => stateModule.addFood(-1, 0)).toThrow('Invalid coordinates');
  });

  it('throws when max food count reached', () => {
    const state = __testUtils.getState();
    state.food = Array.from({ length: CONFIG.FOOD_MAX_COUNT }, (_, idx) => ({ x: idx, y: 0 }));
    state.stats.foodCount = CONFIG.FOOD_MAX_COUNT;

    expect(() => stateModule.addFood(1, 1)).toThrow('Max food count reached');
  });
});
