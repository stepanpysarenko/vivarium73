const request = require('supertest');

jest.mock('../../src/nn', () => ({
  initWeights: jest.fn(() => Promise.resolve(new Array(171).fill(0))),
  mutateWeights: jest.fn(w => Promise.resolve(w)),
  getMovements: jest.fn(() => Promise.resolve([])),
}));

const { app } = require('../../src/server');
const { SERVER_CONFIG, SIM_CONFIG } = require('../../src/config');
const { simulationManager } = require('../../src/simulation');

const SIM_ID = 'main';

beforeAll(async () => {
  if (!simulationManager.get(SIM_ID)) {
    await simulationManager.create(SIM_ID);
  }
});

describe('GET /api/config', () => {
  it('returns environment configuration', async () => {
    const res = await request(app).get('/api/config');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      envCode: SERVER_CONFIG.ENVIRONMENT,
      webSocketUrl: SERVER_CONFIG.WEBSOCKET_URL,
      gridSize: SIM_CONFIG.GRID_SIZE,
      foodMaxCount: SIM_CONFIG.FOOD_MAX_COUNT,
    });
    expect(res.body).toHaveProperty('appVersion');
    expect(res.body).toHaveProperty('stateUpdateInterval');
  });
});
