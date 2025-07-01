const request = require('supertest');
const { app } = require('../../src/server');

describe('POST /api/place-food', () => {
  beforeEach(() => {
    require('../../src/state').initState();
  });

  it('responds with success when valid input is provided', async () => {
    const res = await request(app)
      .post('/api/place-food')
      .send({ x: 1, y: 2 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('responds with error when x or y is invalid', async () => {
    const res = await request(app)
      .post('/api/place-food')
      .send({ x: 'bad', y: 2 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false, 
      error: 'x and y must be numbers'
    });
  });

  it('responds with error when addFood throws (e.g., out of bounds)', async () => {
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
