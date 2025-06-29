const request = require('supertest');
const actions = require('../../src/actions');
const { app } = require('../../src/server');

jest.mock('../../src/actions');

describe('POST /api/place-food', () => {
  beforeEach(() => jest.clearAllMocks());

  it('responds with success when action succeeds', async () => {
    actions.placeFood.mockImplementation(() => {});
    const res = await request(app).post('/api/place-food').send({ x: 1, y: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(actions.placeFood).toHaveBeenCalledWith(1, 2);
  });

  it('responds with error when action throws', async () => {
    actions.placeFood.mockImplementation(() => { throw new Error('bad'); });
    const res = await request(app).post('/api/place-food').send({ x: 1, y: 2 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'bad' });
  });
});
