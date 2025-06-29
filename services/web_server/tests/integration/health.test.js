const request = require('supertest');
const { app } = require('../../src/server');

describe('GET /api/health', () => {
  it('returns OK status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'OK' });
  });
});
