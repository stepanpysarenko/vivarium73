const axios = require('axios');
const CONFIG = require('../../src/config');
const { initWeights, mutateWeights, getMovements } = require('../../src/nn');
const grid = require('../../src/grid');

jest.mock('axios');
jest.mock('../../src/grid', () => ({
  getVisibleFood: jest.fn(() => []),
  getVisibleObstacles: jest.fn(() => []),
  getVisibleCreatures: jest.fn(() => [])
}));

describe('mutateWeights', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns mutated weights on success', async () => {
    axios.post.mockResolvedValue({ data: { weights: [2, 3] } });
    await expect(mutateWeights([1])).resolves.toEqual([2, 3]);
    expect(axios.post).toHaveBeenCalledWith(
      CONFIG.NN_SERVICE_URL + '/weights/mutate',
      { weights: [1] }
    );
  });

  it('throws when request fails', async () => {
    axios.post.mockRejectedValue(new Error('network'));
    await expect(mutateWeights([1])).rejects.toThrow('Failed to mutate weights: network');
  });
});

describe('initWeights', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns weights on success', async () => {
    axios.get.mockResolvedValue({ data: { weights: [5, 6] } });
    await expect(initWeights()).resolves.toEqual([5, 6]);
    expect(axios.get).toHaveBeenCalledWith(CONFIG.NN_SERVICE_URL + '/weights/init');
  });

  it('throws when request fails', async () => {
    axios.get.mockRejectedValue(new Error('timeout'));
    await expect(initWeights()).rejects.toThrow('Failed to initialize weights: timeout');
  });
});

describe('getMovements', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const baseState = {
    creatures: [
      {
        id: 1,
        x: 0,
        y: 0,
        angle: 0,
        energy: 10,
        prev: { x: 0, y: 0, angle: 0, energy: 10 },
        recentPath: [],
        justReproduced: false,
        weights: []
      }
    ],
    params: {
      gridSize: 1,
      visibilityRadius: 2,
      maxEnergy: 3,
      maxTurnAngle: 4,
      maxSpeed: 5
    }
  };

  it('returns movements on success', async () => {
    axios.post.mockResolvedValue({ data: { movements: [{ angleDelta: 0, speed: 1 }] } });
    await expect(getMovements(baseState)).resolves.toEqual([{ angleDelta: 0, speed: 1 }]);
    expect(axios.post).toHaveBeenCalledWith(
      CONFIG.NN_SERVICE_URL + '/think',
      {
        creatures: [
          {
            id: 1,
            x: 0,
            y: 0,
            angle: 0,
            energy: 10,
            prevX: 0,
            prevY: 0,
            prevAngle: 0,
            recentPath: [],
            prevEnergy: 10,
            justReproduced: false,
            weights: [],
            food: [],
            obstacles: [],
            creatures: []
          }
        ],
        gridSize: 1,
        visibilityRadius: 2,
        maxEnergy: 3,
        maxTurnAngle: 4,
        maxSpeed: 5
      }
    );
  });

  it('throws when request fails', async () => {
    axios.post.mockRejectedValue(new Error('down'));
    await expect(getMovements(baseState)).rejects.toThrow('Failed to fetch movements: down');
  });
});
