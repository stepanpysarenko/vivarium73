const path = require('path');
const { pathToFileURL } = require('url');
const { test, expect } = require('@playwright/test');

const indexPath = path.resolve(__dirname, '../../public/index.html');
const indexUrl = pathToFileURL(indexPath).toString();

const configMock = {
  envCode: 'test',
  appVersion: '0.0-test',
  webSocketUrl: 'ws://mock',
  stateUpdateInterval: 100,
  gridSize: 50,
  maxFoodCount: 30,
};

const initialState = {
  stats: {
    restarts: 0,
    generation: 1,
    creatureCount: 1,
    foodCount: 2,
  },
  creatures: [
    {
      id: 1,
      x: 10,
      y: 8,
      angle: 0,
      energy: 0.75,
      flashing: false,
      generation: 1,
      score: 0,
      msLived: 1200,
    },
  ],
  food: [
    { x: 12, y: 8 },
    { x: 14, y: 8 },
  ],
  obstacles: [],
  eggs: [],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ config, state }) => {
    const clients = new Set();
    let foodCount = state.stats.foodCount;

    const createFoodList = count => Array.from({ length: count }, (_, idx) => ({
      x: (idx % 10) * 2,
      y: Math.floor(idx / 10) * 2,
    }));

    const clone = value => JSON.parse(JSON.stringify(value));

    const buildFrame = overrides => {
      const frame = {
        stats: { ...clone(state.stats), foodCount },
        creatures: clone(state.creatures),
        food: createFoodList(foodCount),
        obstacles: clone(state.obstacles),
        eggs: clone(state.eggs || []),
        timestamp: performance.now(),
        ...clone(overrides || {}),
      };

      if (overrides && overrides.stats) {
        frame.stats = { ...frame.stats, ...overrides.stats };
      }
      if (overrides && overrides.creatures) {
        frame.creatures = clone(overrides.creatures);
      }
      if (overrides && overrides.food) {
        frame.food = clone(overrides.food);
      }
      if (overrides && overrides.obstacles) {
        frame.obstacles = clone(overrides.obstacles);
      }
      if (overrides && overrides.eggs) {
        frame.eggs = clone(overrides.eggs);
      }
      return frame;
    };

    const dispatchMessage = (client, frame) => {
      if (client.readyState !== MockWebSocket.OPEN) return;
      const payload = JSON.stringify(frame);
      const event = { data: payload, target: client };
      if (typeof client.onmessage === 'function') {
        client.onmessage(event);
      }
      client._listeners.message.forEach(handler => handler(event));
    };

    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = MockWebSocket.CONNECTING;
        this.onopen = null;
        this.onclose = null;
        this.onmessage = null;
        this.onerror = null;
        this._listeners = {
          open: new Set(),
          close: new Set(),
          message: new Set(),
          error: new Set(),
        };
        clients.add(this);
        Promise.resolve().then(() => {
          if (this.readyState === MockWebSocket.CLOSED) return;
          this.readyState = MockWebSocket.OPEN;
          const event = { target: this };
          if (typeof this.onopen === 'function') {
            this.onopen(event);
          }
          this._listeners.open.forEach(handler => handler(event));
          dispatchMessage(this, buildFrame());
        });
      }

      addEventListener(type, handler) {
        if (this._listeners[type]) {
          this._listeners[type].add(handler);
        }
      }

      removeEventListener(type, handler) {
        if (this._listeners[type]) {
          this._listeners[type].delete(handler);
        }
      }

      send() {}

      close() {
        if (this.readyState === MockWebSocket.CLOSED) return;
        this.readyState = MockWebSocket.CLOSED;
        clients.delete(this);
        const event = { target: this };
        if (typeof this.onclose === 'function') {
          this.onclose(event);
        }
        this._listeners.close.forEach(handler => handler(event));
      }
    }

    MockWebSocket.CONNECTING = 0;
    MockWebSocket.OPEN = 1;
    MockWebSocket.CLOSING = 2;
    MockWebSocket.CLOSED = 3;

    const broadcast = overrides => {
      const frame = buildFrame(overrides);
      clients.forEach(client => dispatchMessage(client, frame));
    };

    window.WebSocket = MockWebSocket;

    window.__mock = {
      config,
      baseState: state,
      creaturePosition: { x: state.creatures[0].x, y: state.creatures[0].y },
      get foodCount() {
        return foodCount;
      },
      broadcast,
      incrementFood() {
        foodCount = Math.min(foodCount + 1, config.maxFoodCount);
        broadcast({ stats: { foodCount } });
      },
      forceDisconnect() {
        Array.from(clients).forEach(client => client.close());
      },
    };

    const originalFetch = window.fetch ? window.fetch.bind(window) : null;
    window.fetch = (input, init) => {
      if (typeof input === 'string' && input.endsWith('/api/config')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => config,
        });
      }

      if (typeof input === 'string' && input.endsWith('/api/place-food')) {
        foodCount = Math.min(foodCount + 1, config.maxFoodCount);
        broadcast({ stats: { foodCount } });
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ success: true }),
        });
      }

      if (originalFetch) {
        return originalFetch(input, init);
      }

      return Promise.reject(new Error('Unhandled fetch: ' + input));
    };
  }, { config: configMock, state: initialState });

  await page.goto(indexUrl);
  await page.waitForSelector('#canvas', { state: 'visible' });
  await page.waitForFunction(() => !document.body.classList.contains('loading'));
});

test('renders canvas and hides loader after boot', async ({ page }) => {
  const canvas = page.locator('#canvas');
  await expect(canvas).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/loading/);
});

test('placing food increases the food count display', async ({ page }) => {
  const foodStats = page.locator('#stats-grid-food');
  await expect(foodStats).toHaveText('2/30');

  const canvas = await page.$('#canvas');
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(foodStats).toHaveText('3/30');
});

test('clicking a creature opens the observation panel with details', async ({ page }) => {
  const canvas = await page.$('#canvas');
  const box = await canvas.boundingBox();
  const { x, y } = await page.evaluate(() => window.__mock.creaturePosition);
  const scale = box.width / configMock.gridSize;

  await page.mouse.click(box.x + (x + 0.5) * scale, box.y + (y + 0.5) * scale);

  const creaturePanel = page.locator('#stats-creature');
  await expect(creaturePanel).toBeVisible();
  await expect(page.locator('#stat-creature-id')).toHaveText('1');
});

test('reconnects after a simulated WebSocket disconnect', async ({ page }) => {
  await page.evaluate(() => window.__mock.forceDisconnect());
  await page.waitForFunction(() => document.body.classList.contains('loading'));
  await page.waitForFunction(() => !document.body.classList.contains('loading'));
  await expect(page.locator('#stats-grid-food')).toHaveText('2/30');
});
