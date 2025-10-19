process.env.NODE_ENV = 'test';

jest.mock('../../src/nn', () => ({
  getMovements: jest.fn(),
  mutateWeights: jest.fn(async weights => weights),
}));

const CONFIG = require('../../src/config');
const stateModule = require('../../src/state');
const nn = require('../../src/nn');

const { __testUtils } = stateModule;

const createBaseState = () => ({
  creatures: [],
  food: [],
  obstacles: [],
  borderObstacles: [],
  eggs: [],
  stats: {
    restarts: 0,
    generation: CONFIG.FOOD_ENERGY_BONUS_MAX_GEN + 1,
    creatureCount: 0,
    foodCount: 0,
  },
  lastCreatureId: 0,
  lastEggId: 0,
});

beforeEach(() => {
  nn.mutateWeights.mockClear();
  nn.mutateWeights.mockImplementation(async weights => weights);
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

    expect(creature.energy).toBe(100 - CONFIG.CREATURE_COLLISION_PENALTY);
    expect(creature.updatesToFlash).toBe(CONFIG.CREATURE_COLLISION_UPDATES_TO_FLASH);
  });
});

describe('mating lifecycle', () => {
  beforeEach(() => {
    __testUtils.setState(createBaseState());
  });

  const buildCreature = (overrides = {}) => ({
    id: overrides.id || 1,
    x: overrides.x || 5,
    y: overrides.y || 5,
    angle: overrides.angle || 0,
    sex: overrides.sex || 'F',
    energy: overrides.energy ?? (CONFIG.CREATURE_MIN_ENERGY_TO_MATE + 50),
    matingCooldown: overrides.matingCooldown ?? 0,
    mateIntent: overrides.mateIntent ?? 1,
    weights: overrides.weights || [0, 0],
    generation: overrides.generation || 1,
    matedThisTick: overrides.matedThisTick || false,
    prev: overrides.prev || { x: overrides.x || 5, y: overrides.y || 5, angle: overrides.angle || 0, energy: overrides.energy ?? (CONFIG.CREATURE_MIN_ENERGY_TO_MATE + 50) },
    stats: overrides.stats || { msLived: 0, energyGained: 0, score: 0 },
    justReproduced: overrides.justReproduced || false,
    recentPath: overrides.recentPath || [{ x: overrides.x || 5, y: overrides.y || 5 }],
    wanderAngle: overrides.wanderAngle || 0,
    wanderStrength: overrides.wanderStrength || 0,
  });

  it('creates an egg when two creatures meet mating conditions', () => {
    const state = __testUtils.getState();
    const female = buildCreature({ id: 1, sex: 'F' });
    const male = buildCreature({ id: 2, sex: 'M', x: 5.8 });
    state.creatures = [female, male];

    const femaleEnergyBefore = female.energy;
    const maleEnergyBefore = male.energy;

    const immune = __testUtils.handleMating();

    expect(state.eggs).toHaveLength(1);
    expect(state.eggs[0]).toMatchObject({ parentGeneration: 1 });
    expect(female.energy).toBe(femaleEnergyBefore - CONFIG.CREATURE_MATE_COST_FEMALE);
    expect(male.energy).toBe(maleEnergyBefore - CONFIG.CREATURE_MATE_COST_MALE);
    expect(female.matedThisTick).toBe(true);
    expect(male.matedThisTick).toBe(true);
    expect(female.matingCooldown).toBe(CONFIG.CREATURE_MATING_COOLDOWN);
    expect(male.matingCooldown).toBe(CONFIG.CREATURE_MATING_COOLDOWN);
    expect(Array.from(immune)).toEqual(expect.arrayContaining([1, 2]));
  });
});

describe('egg lifecycle', () => {
  beforeEach(() => {
    __testUtils.setState(createBaseState());
  });

  it('hatches ready eggs into creatures when space is clear', async () => {
    const state = __testUtils.getState();
    state.creatures = [];
    state.eggs.push({
      id: 1,
      x: 3,
      y: 3,
      hatchAt: Date.now() - 1,
      parentGeneration: 2,
      weights: [0.1, 0.2],
    });
    nn.mutateWeights.mockResolvedValue([0.3, 0.4]);

    const updatedCreatures = await __testUtils.handleLifecycle();

    expect(state.eggs).toHaveLength(0);
    expect(updatedCreatures).toHaveLength(1);
    expect(nn.mutateWeights).toHaveBeenCalledWith([0.1, 0.2]);
    const hatchling = updatedCreatures[0];
    expect(hatchling.generation).toBe(3);
    expect(hatchling.weights).toEqual([0.3, 0.4]);
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
