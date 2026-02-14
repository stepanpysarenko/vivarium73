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
  beforeEach(() => {
    __testUtils.setState({
      ...createBaseState(),
      obstacles: [{ x: 10, y: 10 }],
      borderObstacles: [],
    });
  });

  it('does not alter position when there is no collision', () => {
    const creature = {
      x: 5, y: 5,
      prev: { x: 4, y: 4 },
      energy: 100,
      updatesToFlash: 0,
    };

    __testUtils.handleObstacleCollision(creature);

    expect(creature.x).toBeCloseTo(5);
    expect(creature.y).toBeCloseTo(5);
    expect(creature.energy).toBe(100);
  });

  it('retreats to previous position when both axes are blocked', () => {
    // obstacle at (10,10) blocks current pos; (10,9) blocks X-slide; (9,10) blocks Y-slide
    __testUtils.setState({
      ...createBaseState(),
      obstacles: [{ x: 10, y: 10 }, { x: 10, y: 9 }, { x: 9, y: 10 }],
      borderObstacles: [],
    });

    const creature = {
      x: 10, y: 10,
      prev: { x: 9, y: 9 },
      energy: 100,
      updatesToFlash: 0,
    };

    __testUtils.handleObstacleCollision(creature);

    expect(creature.x).toBeCloseTo(9);
    expect(creature.y).toBeCloseTo(9);
    expect(creature.energy).toBe(100 - CONFIG.CREATURE_COLLISION_ENERGY_PENALTY);
    expect(creature.updatesToFlash).toBe(CONFIG.CREATURE_COLLISION_TICKS_TO_FLASH);
  });

  it('clamps position to grid bounds when beyond grid', () => {
    __testUtils.setState({
      ...createBaseState(),
      obstacles: [],
      borderObstacles: [],
    });

    const creature = {
      x: -2, y: -2,
      prev: { x: 0, y: 0 },
      energy: 100,
      updatesToFlash: 0,
    };

    __testUtils.handleObstacleCollision(creature);

    expect(creature.x).toBe(0);
    expect(creature.y).toBe(0);
    expect(creature.energy).toBe(100 - CONFIG.CREATURE_COLLISION_ENERGY_PENALTY);
  });

  it('slides along Y when X is blocked', () => {
    __testUtils.setState({
      ...createBaseState(),
      obstacles: [{ x: 10, y: 10 }],
      borderObstacles: [],
    });

    const creature = {
      x: 10, y: 10,
      prev: { x: 9, y: 10 },
      energy: 100,
      updatesToFlash: 0,
    };

    __testUtils.handleObstacleCollision(creature);

    expect(creature.x).toBeCloseTo(9);
    expect(creature.y).toBeCloseTo(10);
    expect(creature.energy).toBe(100 - CONFIG.CREATURE_COLLISION_ENERGY_PENALTY);
  });
});
