process.env.NODE_ENV = 'test';

const request = require('supertest');
const { app } = require('../../src/server');
const state = require('../../src/state');
const CONFIG = require('../../src/config');

const { __testUtils } = state;

const createState = (food = []) => ({
  creatures: [],
  food: [...food],
  obstacles: [],
  stats: {
    restarts: 0,
    generation: 1,
    creatureCount: 0,
    foodCount: food.length,
  },
  lastCreatureId: 0,
});

describe('POST /api/place-food', () => {
  beforeEach(() => {
    __testUtils.setState(createState());
  });

  it('returns 201 when food is placed on an empty cell', async () => {
    const res = await request(app)
      .post('/api/place-food')
      .send({ x: 2, y: 3 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true });
    expect(__testUtils.getState().food).toHaveLength(1);
  });

  it('returns 400 when the grid already holds the maximum food', async () => {
    const filled = Array.from({ length: CONFIG.FOOD_MAX_COUNT }, (_, idx) => ({ x: idx, y: 0 }));
    __testUtils.setState(createState(filled));

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
