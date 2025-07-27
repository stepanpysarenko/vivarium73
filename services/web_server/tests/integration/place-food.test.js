jest.mock('../../src/state', () => ({
  initState: jest.fn().mockResolvedValue(),
  saveState: jest.fn(),
  getPublicState: jest.fn(),
  getPublicParams: jest.fn(),
  updateState: jest.fn(),
  addFood: jest.fn()
}));

const request = require('supertest');
const { app } = require('../../src/server');
const state = require('../../src/state');

describe('POST /api/place-food', () => {
  beforeEach(async () => {
    state.addFood.mockReset();
    await state.initState();
  });

  it('responds with success when valid input is provided', async () => {
    const res = await request(app)
      .post('/api/place-food')
      .send({ x: 1, y: 2 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(state.addFood).toHaveBeenCalledWith(1, 2);
  });

  it('responds with error when x or y is invalid', async () => {
    state.addFood.mockImplementationOnce(() => { throw new Error('bad'); });
    const res = await request(app)
      .post('/api/place-food')
      .send({ x: 'bad', y: 2 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: 'Invalid coordinates'
    });
  });

  it('responds with error when coordinates out of grid', async () => {
    state.addFood.mockImplementationOnce(() => { throw new Error('bad'); });
    const res = await request(app)
      .post('/api/place-food')
      .send({ x: -1, y: -1 });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: expect.any(String)
    });
  });
});
