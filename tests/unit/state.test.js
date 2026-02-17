process.env.NODE_ENV = 'test';

const { SIM_CONFIG } = require('../../src/config');
const stateModule = require('../../src/state');
const { buildStateIndexes } = require('../../src/grid');

const { __testUtils } = stateModule;

const createBaseState = () => {
  const s = {
    creatures: [],
    food: [],
    obstacles: [],
    borderObstacles: [],
    stats: {
      restarts: 0,
      generation: SIM_CONFIG.FOOD_ENERGY_BONUS_MAX_GENERATION + 1,
      creatureCount: 0,
      foodCount: 0,
    },
    lastCreatureId: 0,
    topPerformers: [],
  };
  buildStateIndexes(s);
  return s;
};

describe('applyMovement', () => {
  it('updates position and angle using provided movement', () => {
    const creature = {
      id: 1,
      x: 1,
      y: 2,
      angle: 0,
      prev: { x: 1, y: 2, angle: 0, energy: SIM_CONFIG.CREATURE_INITIAL_ENERGY },
      energy: SIM_CONFIG.CREATURE_INITIAL_ENERGY,
      recentPath: [],
    };

    const movement = { angleDelta: Math.PI / 4, speed: SIM_CONFIG.CREATURE_MAX_SPEED / 2 };

    __testUtils.applyMovement(creature, movement, SIM_CONFIG);

    expect(creature.angle).toBeCloseTo(movement.angleDelta);
    expect(creature.x).toBeCloseTo(1 + movement.speed * Math.cos(creature.angle));
    expect(creature.y).toBeCloseTo(2 + movement.speed * Math.sin(creature.angle));
  });
});

describe('energy adjustments', () => {
  it('increases energy when eating food', () => {
    const state = createBaseState();
    const food = { x: 5, y: 5 };
    state.food.push(food);
    state.foodMap.set('5,5', food);
    const creature = {
      id: 2,
      x: 5,
      y: 5,
      angle: 0,
      energy: SIM_CONFIG.CREATURE_MAX_ENERGY - SIM_CONFIG.FOOD_ENERGY,
      prev: { energy: SIM_CONFIG.CREATURE_MAX_ENERGY - SIM_CONFIG.FOOD_ENERGY },
      stats: { energyGained: 0 },
    };

    __testUtils.handleEating(creature, state, SIM_CONFIG);

    expect(creature.energy).toBe(SIM_CONFIG.CREATURE_MAX_ENERGY);
    expect(creature.stats.energyGained).toBe(SIM_CONFIG.FOOD_ENERGY);
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

    const state = { ...createBaseState(), creatures: [creature, other] };
    buildStateIndexes(state);
    state.creatureMap = new Map();
    state.creatureMap.set('1,1', [creature, other]);

    __testUtils.handleCreatureCollision(creature, state, SIM_CONFIG);

    expect(creature.energy).toBe(100 - SIM_CONFIG.CREATURE_COLLISION_ENERGY_PENALTY);
    expect(creature.updatesToFlash).toBe(SIM_CONFIG.CREATURE_COLLISION_TICKS_TO_FLASH);
  });
});

describe('addFood validation', () => {
  it('adds food within bounds', () => {
    const state = createBaseState();
    stateModule.addFood(3, 4, state, SIM_CONFIG);

    expect(state.food).toHaveLength(1);
    expect(state.stats.foodCount).toBe(1);
  });

  it('throws when coordinates are out of bounds', () => {
    const state = createBaseState();
    expect(() => stateModule.addFood(-1, 0, state, SIM_CONFIG)).toThrow('Invalid coordinates');
  });

  it('throws when max food count reached', () => {
    const state = createBaseState();
    state.food = Array.from({ length: SIM_CONFIG.FOOD_MAX_COUNT }, (_, idx) => ({ x: idx, y: 0 }));
    state.stats.foodCount = SIM_CONFIG.FOOD_MAX_COUNT;

    expect(() => stateModule.addFood(1, 1, state, SIM_CONFIG)).toThrow('Max food count reached');
  });
});

describe('wrapAngle', () => {
  it('returns 0 for 0', () => {
    expect(__testUtils.wrapAngle(0)).toBeCloseTo(0);
  });

  it('wraps 2pi to 0', () => {
    expect(__testUtils.wrapAngle(2 * Math.PI)).toBeCloseTo(0);
  });

  it('returns -pi for -pi', () => {
    expect(__testUtils.wrapAngle(-Math.PI)).toBeCloseTo(-Math.PI);
  });

  it('wraps positive overflow into [-pi, pi]', () => {
    // 3pi wraps to -pi (equivalent angle)
    expect(__testUtils.wrapAngle(3 * Math.PI)).toBeCloseTo(-Math.PI);
  });

  it('wraps negative overflow into [-pi, pi]', () => {
    expect(__testUtils.wrapAngle(-3 * Math.PI)).toBeCloseTo(-Math.PI);
  });

  it('leaves values already in range unchanged', () => {
    expect(__testUtils.wrapAngle(1.0)).toBeCloseTo(1.0);
    expect(__testUtils.wrapAngle(-1.0)).toBeCloseTo(-1.0);
  });
});

describe('handleObstacleCollision', () => {
  it('does not alter position when there is no collision', () => {
    const state = {
      ...createBaseState(),
      obstacles: [{ x: 10, y: 10 }],
      borderObstacles: [],
    };
    buildStateIndexes(state);

    const creature = {
      x: 5, y: 5,
      prev: { x: 4, y: 4 },
      energy: 100,
      updatesToFlash: 0,
    };

    __testUtils.handleObstacleCollision(creature, state, SIM_CONFIG);

    expect(creature.x).toBeCloseTo(5);
    expect(creature.y).toBeCloseTo(5);
    expect(creature.energy).toBe(100);
  });

  it('retreats to previous position when both axes are blocked', () => {
    const state = {
      ...createBaseState(),
      obstacles: [{ x: 10, y: 10 }, { x: 10, y: 9 }, { x: 9, y: 10 }],
      borderObstacles: [],
    };
    buildStateIndexes(state);

    const creature = {
      x: 10, y: 10,
      prev: { x: 9, y: 9 },
      energy: 100,
      updatesToFlash: 0,
    };

    __testUtils.handleObstacleCollision(creature, state, SIM_CONFIG);

    expect(creature.x).toBeCloseTo(9);
    expect(creature.y).toBeCloseTo(9);
    expect(creature.energy).toBe(100 - SIM_CONFIG.CREATURE_COLLISION_ENERGY_PENALTY);
    expect(creature.updatesToFlash).toBe(SIM_CONFIG.CREATURE_COLLISION_TICKS_TO_FLASH);
  });

  it('clamps position to grid bounds when beyond grid', () => {
    const state = {
      ...createBaseState(),
      obstacles: [],
      borderObstacles: [],
    };
    buildStateIndexes(state);

    const creature = {
      x: -2, y: -2,
      prev: { x: 0, y: 0 },
      energy: 100,
      updatesToFlash: 0,
    };

    __testUtils.handleObstacleCollision(creature, state, SIM_CONFIG);

    expect(creature.x).toBe(0);
    expect(creature.y).toBe(0);
    expect(creature.energy).toBe(100 - SIM_CONFIG.CREATURE_COLLISION_ENERGY_PENALTY);
  });

  it('slides along Y when X is blocked', () => {
    const state = {
      ...createBaseState(),
      obstacles: [{ x: 10, y: 10 }],
      borderObstacles: [],
    };
    buildStateIndexes(state);

    const creature = {
      x: 10, y: 10,
      prev: { x: 9, y: 10 },
      energy: 100,
      updatesToFlash: 0,
    };

    __testUtils.handleObstacleCollision(creature, state, SIM_CONFIG);

    expect(creature.x).toBeCloseTo(9);
    expect(creature.y).toBeCloseTo(10);
    expect(creature.energy).toBe(100 - SIM_CONFIG.CREATURE_COLLISION_ENERGY_PENALTY);
  });
});
