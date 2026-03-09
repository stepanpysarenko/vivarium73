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
      getObstacles: jest.fn(() => [{ x: 0, y: 0 }]),
      start: jest.fn(),
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
    { id: 7, x: 4.5, y: 3.2, a: 1.2, e: 0.6, f: false, g: 2, s: 5, t: 1000 },
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

  it('sends init on connect with config and state blocks', () => {
    const { mockWs, messages } = connectMockClient();

    expect(mockWs.send).toHaveBeenCalledTimes(1);
    const init = messages[0];
    expect(init.type).toBe('init');
    expect(init.config).toHaveProperty('gridSize');
    expect(init.config).toHaveProperty('stateUpdateInterval');
    expect(init.config).toHaveProperty('creature');
    expect(init.config).toHaveProperty('foodMaxCount');
    expect(init.state).toHaveProperty('obstacles');
  });

  it('init and state messages carry distinct types', () => {
    const { messages } = connectMockClient();

    broadcastState(sampleFrame());

    expect(messages).toHaveLength(2);
    expect(messages[0].type).toBe('init');
    expect(messages[1].type).toBe('state');
  });
});

describe('WebSocket broadcasting', () => {
  it('state frame includes stats, creatures, and food', () => {
    const { mockWs, messages } = connectMockClient();

    broadcastState(sampleFrame());

    const payload = messages.find(m => m.type === 'state');
    expect(mockWs.send).toHaveBeenCalledTimes(2);
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
      a: expect.any(Number), // angle
      e: expect.any(Number), // energy
    });
  });

  it('state broadcast is delivered to connected clients', () => {
    const { mockWs, messages } = connectMockClient();

    broadcastState(sampleFrame());

    expect(mockWs.send).toHaveBeenCalledTimes(2);
    expect(messages.find(m => m.type === 'state').stats.creatureCount).toBe(1);
  });
});
