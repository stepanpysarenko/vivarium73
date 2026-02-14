process.env.NODE_ENV = 'test';

jest.mock('../../src/nn', () => ({
  initWeights: jest.fn(() => Promise.resolve(new Array(171).fill(0))),
  mutateWeights: jest.fn(weights => Promise.resolve(weights.map(w => w + 0.01))),
  getMovements: jest.fn(),
}));

jest.mock('../../src/creature', () => {
  const actual = jest.requireActual('../../src/creature');
  const mockConfig = require('../../src/config');
  return {
    getScore: actual.getScore,
    initCreature: jest.fn((state, x, y, angle, weights, generation) => {
      const id = ++state.lastCreatureId;
      return Promise.resolve({
        id, x, y, angle, weights, generation,
        energy: mockConfig.CREATURE_INITIAL_ENERGY,
        prev: { x, y, angle, energy: mockConfig.CREATURE_INITIAL_ENERGY },
        recentPath: [{ x, y }],
        wanderAngle: 0,
        wanderStrength: 0.5,
        justReproduced: false,
        updatesToFlash: 0,
        stats: { msLived: 0, energyGained: 0, score: 0 },
      });
    }),
  };
});

const CONFIG = require('../../src/config');
const stateModule = require('../../src/state');
const { __testUtils } = stateModule;

const createBaseState = () => ({
  creatures: [],
  food: [],
  obstacles: [],
  borderObstacles: [],
  stats: {
    restarts: 0,
    generation: CONFIG.FOOD_ENERGY_BONUS_MAX_GENERATION + 1,
    creatureCount: 0,
    foodCount: 0,
  },
  lastCreatureId: 0,
  topPerformers: [],
});

const createCreature = (overrides = {}) => ({
  id: 1,
  x: 5,
  y: 5,
  angle: 0,
  energy: 500,
  prev: { x: 5, y: 5, angle: 0, energy: 500 },
  recentPath: [{ x: 5, y: 5 }],
  generation: 1,
  justReproduced: false,
  updatesToFlash: 0,
  wanderAngle: 0,
  wanderStrength: 0.5,
  weights: new Array(171).fill(0),
  stats: { msLived: 0, energyGained: 100, score: 0 },
  ...overrides,
});

describe('handleLifecycle', () => {
  beforeEach(() => {
    __testUtils.setState(createBaseState());
    jest.clearAllMocks();
  });

  it('keeps alive creatures as survivors and updates their stats', async () => {
    const state = __testUtils.getState();
    const creature = createCreature({ id: 1, energy: 500 });
    state.creatures = [creature];

    const result = await __testUtils.handleLifecycle();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].stats.msLived).toBe(CONFIG.STATE_UPDATE_INTERVAL_MS);
    expect(result[0].justReproduced).toBe(false);
  });

  it('removes dead creatures and records them as top performers', async () => {
    const state = __testUtils.getState();
    const dead = createCreature({ id: 1, energy: 0 });
    const alive = createCreature({ id: 2, energy: 500 });
    state.creatures = [dead, alive];

    const result = await __testUtils.handleLifecycle();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
    expect(state.topPerformers).toHaveLength(1);
    expect(state.topPerformers[0].id).toBe(1);
  });

  it('spawns offspring when creature reaches max energy', async () => {
    const state = __testUtils.getState();
    const parent = createCreature({
      id: 1,
      energy: CONFIG.CREATURE_MAX_ENERGY,
    });
    state.creatures = [parent];
    state.lastCreatureId = 1;

    // Force no mutation (Math.random > MUTATION_CHANCE)
    jest.spyOn(Math, 'random').mockReturnValue(0.99);

    const result = await __testUtils.handleLifecycle();

    Math.random.mockRestore();

    // parent + offspring
    expect(result).toHaveLength(2);

    // parent paid reproduction cost
    const survivor = result.find(c => c.id === 1);
    expect(survivor.energy).toBe(CONFIG.CREATURE_MAX_ENERGY - CONFIG.CREATURE_REPRODUCTION_ENERGY_COST);
    expect(survivor.justReproduced).toBe(true);

    // offspring exists with incremented generation
    const offspring = result.find(c => c.id !== 1);
    expect(offspring).toBeDefined();
    expect(offspring.generation).toBe(parent.generation + 1);
  });

  it('calculates score for surviving creatures', async () => {
    const state = __testUtils.getState();
    const creature = createCreature({ id: 1, energy: 500 });
    creature.stats.energyGained = 250;
    state.creatures = [creature];

    const result = await __testUtils.handleLifecycle();

    expect(result[0].stats.score).toBe(25); // 250 / 10
  });
});
