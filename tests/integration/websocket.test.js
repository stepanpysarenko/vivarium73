process.env.NODE_ENV = 'test';

jest.mock('../../src/simulation', () => ({
  simulationManager: {
    create: jest.fn(),
    get: jest.fn(() => ({
      config: {
        STATE_UPDATE_INTERVAL_MS: 100,
        GRID_SIZE: 50,
        FOOD_MAX_COUNT: 20,
        CREATURE_VISIBILITY_RADIUS: 5,
        CREATURE_VISIBILITY_FOV_RADIANS: Math.PI,
      },
      start: jest.fn(),
      getObstacles: jest.fn(() => [{ x: 0, y: 0 }]),
    })),
  },
}));

const WebSocketLib = require('ws');
const { __testUtils } = require('../../src/server');

const { broadcastState, wss } = __testUtils;

const sampleFrame = () => ({
  stats: {
    restarts: 1,
    generation: 2,
    creatureCount: 1,
    foodCount: 3,
  },
  creatures: [
    { id: 7, x: 4.5, y: 3.2, angle: 1.2, energy: 0.6, flashing: false, generation: 2, score: 5, msLived: 1000 },
  ],
  food: [{ x: 1, y: 1 }],
});


const connectMockClient = () => {
  const messages = [];
  const mockWs = {
    readyState: WebSocketLib.OPEN,
    send: jest.fn(msg => messages.push(JSON.parse(msg))),
    on: jest.fn(),
  };
  wss.emit('connection', mockWs);
  wss.clients.add(mockWs);
  return { mockWs, messages };
};

afterEach(() => {
  for (const client of wss.clients) {
    wss.clients.delete(client);
  }
});

describe('WebSocket connection', () => {

  it('sends config as first message on connect', () => {
    const { mockWs, messages } = connectMockClient();

    expect(mockWs.send).toHaveBeenCalledTimes(2);
    const config = messages[0];
    expect(config.type).toBe('config');
    expect(config).toHaveProperty('gridSize');
    expect(config).toHaveProperty('stateUpdateInterval');
    expect(config).toHaveProperty('creature');
    expect(config).toHaveProperty('foodMaxCount');
  });

  it('sends obstacles as second message on connect', () => {
    const { messages } = connectMockClient();

    const obstaclesMsg = messages[1];
    expect(obstaclesMsg.type).toBe('obstacles');
    expect(Array.isArray(obstaclesMsg.obstacles)).toBe(true);
  });

  it('config and state messages carry distinct types', () => {
    const { messages } = connectMockClient();

    broadcastState(sampleFrame());

    expect(messages).toHaveLength(3);
    expect(messages[0].type).toBe('config');
    expect(messages[1].type).toBe('obstacles');
    expect(messages[2].type).toBe('state');
  });
});

describe('WebSocket broadcasting', () => {
  it('state frame includes stats, creatures, and food', () => {
    const { mockWs, messages } = connectMockClient();

    broadcastState(sampleFrame());

    const payload = messages.find(m => m.type === 'state');
    expect(mockWs.send).toHaveBeenCalledTimes(3);
    expect(payload).toHaveProperty('stats');
    expect(payload).toHaveProperty('creatures');
    expect(payload).toHaveProperty('food');
    expect(payload).not.toHaveProperty('obstacles');
  });

  it('creature entries in state include id, position, angle, and energy', () => {
    const { messages } = connectMockClient();

    broadcastState(sampleFrame());

    const [creature] = messages.find(m => m.type === 'state').creatures;
    expect(creature).toMatchObject({
      id: expect.any(Number),
      x: expect.any(Number),
      y: expect.any(Number),
      angle: expect.any(Number),
      energy: expect.any(Number),
    });
  });

  it('state broadcast is delivered to connected clients', () => {
    const { mockWs, messages } = connectMockClient();

    broadcastState(sampleFrame());

    expect(mockWs.send).toHaveBeenCalledTimes(3);
    expect(messages.find(m => m.type === 'state').stats.creatureCount).toBe(1);
  });
});
