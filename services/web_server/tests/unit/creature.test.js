const CONFIG = require('../../src/config');

jest.mock('../../src/nn', () => ({
  initWeights: jest.fn(() => Promise.resolve([1, 2, 3])),
}));

jest.mock('../../src/grid', () => ({
  getRandomEmptyCell: jest.fn(() => ({ x: 4, y: 5 })),
}));

const { initCreature } = require('../../src/creature');
const nn = require('../../src/nn');
const grid = require('../../src/grid');

describe('initCreature', () => {
  afterEach(() => {
    jest.clearAllMocks();
    if (Math.random.mockRestore) {
      Math.random.mockRestore();
    }
  });

  it('assigns a random heading when angle is not provided', async () => {
    const randomValues = [0.75, 0.25];
    jest.spyOn(Math, 'random').mockImplementation(() => randomValues.shift());
    const state = { lastCreatureId: 0 };

    const creature = await initCreature(state);

    const expectedAngle = (0.75 * 2 * Math.PI) - Math.PI;
    const expectedWander = (0.25 * 2 * Math.PI) - Math.PI;

    expect(grid.getRandomEmptyCell).toHaveBeenCalledWith(state);
    expect(nn.initWeights).toHaveBeenCalledTimes(1);
    expect(creature.angle).toBeCloseTo(expectedAngle);
    expect(creature.prev.angle).toBeCloseTo(expectedAngle);
    expect(creature.wanderAngle).toBeCloseTo(expectedWander);
    expect(creature.energy).toBe(CONFIG.CREATURE_INITIAL_ENERGY);
  });

  it('throws when the grid has no empty cells', async () => {
    grid.getRandomEmptyCell.mockReturnValueOnce(null);
    const state = { lastCreatureId: 0 };

    await expect(initCreature(state)).rejects.toThrow('No empty cells available');
  });
});
