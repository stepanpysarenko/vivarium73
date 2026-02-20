const { initWeights, mutateWeights, think, EXPECTED_WEIGHT_COUNT } = require('../../src/nn');
const { SIM_CONFIG } = require('../../src/config');

describe('initWeights', () => {
  it('returns the correct number of weights', () => {
    const weights = initWeights();
    expect(weights).toHaveLength(EXPECTED_WEIGHT_COUNT);
  });

  it('returns values within Xavier uniform bounds', () => {
    const weights = initWeights();
    expect(weights.every(w => w >= -1 && w <= 1)).toBe(true);
  });
});

describe('mutateWeights', () => {
  it('returns the same number of weights', () => {
    const weights = new Array(EXPECTED_WEIGHT_COUNT).fill(0);
    const mutated = mutateWeights(weights);
    expect(mutated).toHaveLength(EXPECTED_WEIGHT_COUNT);
  });

  it('changes at least some values', () => {
    const weights = new Array(EXPECTED_WEIGHT_COUNT).fill(0);
    const mutated = mutateWeights(weights);
    expect(mutated.some(w => w !== 0)).toBe(true);
  });

  it('keeps values within [-1, 1]', () => {
    const weights = [1.0, -1.0, 0.25, -0.75];
    const mutated = mutateWeights(weights);
    expect(mutated).toHaveLength(weights.length);
    expect(mutated.every(w => w >= -1 && w <= 1)).toBe(true);
  });
});

describe('think', () => {
  const makeCreature = (id, opts = {}) => ({
    id,
    x: 0, y: 0, angle: 0,
    wanderAngle: opts.wanderAngle ?? 0,
    wanderStrength: opts.wanderStrength ?? 0.5,
    energy: 100,
    prev: { x: 0, y: 0, angle: 0, energy: 100 },
    recentPath: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
    justReproduced: false,
    weights: opts.weights ?? new Array(EXPECTED_WEIGHT_COUNT).fill(0),
  });

  it('returns a movement with the creature ID', () => {
    const m = think(makeCreature(42), [], [], [], SIM_CONFIG);
    expect(m.id).toBe(42);
  });

  it('returns angleDelta and speed', () => {
    const m = think(makeCreature(1), [], [], [], SIM_CONFIG);
    expect(m).toHaveProperty('angleDelta');
    expect(m).toHaveProperty('speed');
  });

  it('produces non-zero movement with wander vector and real weights', () => {
    const weights = initWeights();
    const m = think(makeCreature(1, { wanderAngle: 1.0, wanderStrength: 1.0, weights }), [], [], [], SIM_CONFIG);
    expect(m.angleDelta !== 0 || m.speed !== 0).toBe(true);
  });

  it('constrains speed to [0, maxSpeed]', () => {
    const weights = initWeights();
    const m = think(makeCreature(1, { weights }), [], [], [], SIM_CONFIG);
    expect(m.speed).toBeGreaterThanOrEqual(0);
    expect(m.speed).toBeLessThanOrEqual(SIM_CONFIG.CREATURE_MAX_SPEED);
  });
});
