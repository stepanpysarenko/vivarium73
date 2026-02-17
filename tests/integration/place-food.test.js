process.env.NODE_ENV = 'test';

jest.mock('../../src/nn', () => ({
  initWeights: jest.fn(() => Promise.resolve(new Array(171).fill(0))),
  mutateWeights: jest.fn(w => Promise.resolve(w)),
  getMovements: jest.fn(() => Promise.resolve([])),
}));

const request = require('supertest');
const { app } = require('../../src/server');
const { simulationManager, __testUtils } = require('../../src/simulation');
const { SIM_CONFIG } = require('../../src/config');

const SIM_ID = 'main';

const createState = (food = []) => ({
  creatures: [],
  food: [...food],
  obstacles: [],
  borderObstacles: [],
  stats: {
    restarts: 0,
    generation: 1,
    creatureCount: 0,
    foodCount: food.length,
  },
  lastCreatureId: 0,
  topPerformers: [],
});

beforeAll(async () => {
  if (!simulationManager.get(SIM_ID)) {
    await simulationManager.create(SIM_ID);
  }
});

describe('POST /api/place-food', () => {
  beforeEach(() => {
    __testUtils.setSimState(SIM_ID, createState());
  });

  it('returns 201 when food is placed on an empty cell', async () => {
    const res = await request(app)
      .post('/api/place-food')
      .send({ x: 2, y: 3 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true });
    expect(__testUtils.getSimState(SIM_ID).food).toHaveLength(1);
  });

  it('returns 400 when the grid already holds the maximum food', async () => {
    const filled = Array.from({ length: SIM_CONFIG.FOOD_MAX_COUNT }, (_, idx) => ({ x: idx, y: 0 }));
    __testUtils.setSimState(SIM_ID, createState(filled));

    const res = await request(app)
      .post('/api/place-food')
      .send({ x: 10, y: 10 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'Max food count reached' });
  });

  it('returns 400 for invalid coordinate payloads', async () => {
    const res = await request(app)
      .post('/api/place-food')
      .send({ x: 'bad', y: 10 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'Invalid coordinates' });
  });
});
