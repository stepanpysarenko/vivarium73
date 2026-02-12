const request = require('supertest');
const { app } = require('../../src/server');
const CONFIG = require('../../src/config');

describe('GET /api/config', () => {
  it('returns environment configuration', async () => {
    const res = await request(app).get('/api/config');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      envCode: CONFIG.ENVIRONMENT,
      webSocketUrl: CONFIG.WEBSOCKET_URL,
      gridSize: CONFIG.GRID_SIZE,
      foodMaxCount: CONFIG.FOOD_MAX_COUNT,
    });
    expect(res.body).toHaveProperty('appVersion');
    expect(res.body).toHaveProperty('stateUpdateInterval');
  });
});
