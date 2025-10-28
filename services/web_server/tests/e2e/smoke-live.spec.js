const { test, expect } = require('@playwright/test');

const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3800';
const expectedEnv = process.env.ENVIRONMENT || 'ci';
const expectedVersion = process.env.SMOKE_APP_VERSION || 'dev';

test.describe.serial('Live smoke', () => {
  test('health and config endpoints respond', async ({ request }) => {
    const healthResponse = await request.get(`${baseUrl}/api/health`);
    expect(healthResponse.ok()).toBeTruthy();
    const healthJson = await healthResponse.json();
    expect(healthJson.status).toBe('OK');
    expect(healthJson.appVersion).toBeTruthy();

    const configResponse = await request.get(`${baseUrl}/api/config`);
    expect(configResponse.ok()).toBeTruthy();
    const configJson = await configResponse.json();
    expect(configJson.envCode).toBe(expectedEnv);
    expect(configJson.appVersion).toBe(expectedVersion);
    expect(configJson.webSocketUrl).toBeTruthy();
  });

  test('frontend loads canvas and hides loader', async ({ page }) => {
    await page.goto(baseUrl);
    await page.waitForSelector('#canvas', { state: 'visible' });
    await page.waitForFunction(() => !document.body.classList.contains('loading'));
    await expect(page.locator('#canvas')).toBeVisible();
    await expect(page.locator('#stats-grid-food')).toBeVisible();
  });

  test('placing food via API succeeds', async ({ request }) => {
    const response = await request.post(`${baseUrl}/api/place-food`, {
      data: { x: 1, y: 1 },
    });
    expect(response.status()).toBe(201);
    const payload = await response.json();
    expect(payload).toEqual({ success: true });
  });
});
