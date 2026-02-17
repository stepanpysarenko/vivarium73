const request = require('supertest');
const { app } = require('../../src/server');

describe('GET /api/health', () => {
  it('returns OK status with appVersion', async () => {
    const expectedVersion = process.env.APP_VERSION || 'dev';

    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'OK',
      appVersion: expectedVersion,
    });
  });
});
