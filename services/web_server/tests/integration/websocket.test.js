process.env.NODE_ENV = 'test';

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
  obstacles: [{ x: 0, y: 0 }],
  eggs: [{ id: 1, x: 2, y: 2, hatchIn: 5000, generation: 2 }],
});

const attachClient = () => {
  const messages = [];
  const client = {
    readyState: WebSocketLib.OPEN,
    send: jest.fn(message => messages.push(JSON.parse(message))),
  };
  wss.clients.add(client);
  return { client, messages };
};

afterEach(() => {
  for (const client of wss.clients) {
    wss.clients.delete(client);
  }
});

describe('WebSocket broadcasting', () => {
  it('includes stats, creatures, food, and obstacles in frames', () => {
    const { client, messages } = attachClient();

    broadcastState(sampleFrame());

    expect(client.send).toHaveBeenCalledTimes(1);
    const payload = messages[0];
    expect(payload).toHaveProperty('stats');
    expect(payload).toHaveProperty('creatures');
    expect(payload).toHaveProperty('food');
    expect(payload).toHaveProperty('obstacles');
    expect(payload).toHaveProperty('eggs');
  });

  it('ensures each creature frame carries core fields', () => {
    const { messages } = attachClient();

    broadcastState(sampleFrame());

    const [creature] = messages[0].creatures;
    expect(creature).toMatchObject({
      id: expect.any(Number),
      x: expect.any(Number),
      y: expect.any(Number),
      angle: expect.any(Number),
      energy: expect.any(Number),
    });
  });

  it('delivers state to listeners on the first broadcast', () => {
    const { client, messages } = attachClient();

    broadcastState(sampleFrame());

    expect(client.send).toHaveBeenCalledTimes(1);
    expect(messages[0].stats.creatureCount).toBe(1);
  });
});
