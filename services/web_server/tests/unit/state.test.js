const CONFIG = require('../../src/config');

jest.mock('../../src/nn', () => ({
  getMovements: jest.fn(),
  mutateWeights: jest.fn(),
}));

const stateModule = require('../../src/state');
const nn = require('../../src/nn');

function createCreature(id, energy) {
  return {
    id,
    x: id,
    y: id,
    angle: 0,
    wanderAngle: 0,
    wanderStrength: 1,
    energy,
    prev: { x: id, y: id, angle: 0, energy },
    recentPath: [{ x: id, y: id }],
    generation: 1,
    justReproduced: false,
    updatesToFlash: 0,
    weights: [],
    stats: { msLived: 0, energyGained: 0, score: 0 },
  };
}

function createBaseState(creatures, overrides = {}) {
  const { stats: statsOverrides, ...restOverrides } = overrides;
  const stats = {
    restarts: 0,
    generation: CONFIG.FOOD_ENERGY_BONUS_MAX_GEN + 1,
    creatureCount: creatures.length,
    foodCount: 0,
    ...statsOverrides,
  };

  return {
    creatures,
    food: [],
    obstacles: [],
    borderObstacles: [],
    stats,
    topPerformers: [],
    lastCreatureId: Math.max(...creatures.map(c => c.id)),
    ...restOverrides,
  };
}

describe('updateState', () => {
  afterEach(() => {
    stateModule.__setStateForTesting(null);
    jest.resetAllMocks();
  });

  it('tracks the actual energy gained from food consumption', async () => {
    const initialEnergy = CONFIG.CREATURE_MAX_ENERGY - CONFIG.FOOD_ENERGY - 10;
    const creatures = [
      createCreature(1, initialEnergy),
      createCreature(2, CONFIG.CREATURE_INITIAL_ENERGY),
      createCreature(3, CONFIG.CREATURE_INITIAL_ENERGY),
    ];
    const state = createBaseState(creatures, {
      food: [{ x: creatures[0].x, y: creatures[0].y }],
      stats: { foodCount: 1 },
    });

    stateModule.__setStateForTesting(state);

    nn.getMovements.mockResolvedValue([
      { id: 1, angleDelta: 0, speed: 0 },
      { id: 2, angleDelta: 0, speed: 0 },
      { id: 3, angleDelta: 0, speed: 0 },
    ]);

    await stateModule.updateState();

    const updated = state.creatures.find(c => c.id === 1);
    const energyLoss = CONFIG.CREATURE_ENERGY_LOSS * CONFIG.CREATURE_ENERGY_LOSS_BASE;
    const energyBeforeFood = initialEnergy - energyLoss;
    const expectedEnergyAfterEating = energyBeforeFood + CONFIG.FOOD_ENERGY;
    const expectedGain = expectedEnergyAfterEating - energyBeforeFood;

    expect(updated.energy).toBeCloseTo(expectedEnergyAfterEating);
    expect(updated.stats.energyGained).toBeCloseTo(expectedGain);
  });

  it('keeps creatures stable when the NN omits movement commands', async () => {
    const startingEnergy = 500;
    const creatures = [
      createCreature(1, startingEnergy),
      createCreature(2, startingEnergy),
      createCreature(3, startingEnergy),
    ];
    const state = createBaseState(creatures);

    stateModule.__setStateForTesting(state);

    nn.getMovements.mockResolvedValue([
      { id: 1, angleDelta: 0.1, speed: 0.2 },
    ]);

    await stateModule.updateState();

    expect(state.creatures).toHaveLength(3);

    const missingMovementCreature = state.creatures.find(c => c.id === 2);
    const expectedEnergy = startingEnergy - (CONFIG.CREATURE_ENERGY_LOSS * CONFIG.CREATURE_ENERGY_LOSS_BASE);
    expect(missingMovementCreature.energy).toBeCloseTo(expectedEnergy);
  });
});
