const { test, expect } = require('@playwright/test');
const { installGasMock } = require('../helpers/gasMock');

test.beforeEach(async ({ page }) => {
  await installGasMock(page);
  await page.goto('/meal_plan_github.html');
  await expect(page.locator('#sheetsContainer table').first()).toBeVisible();
  await page.evaluate(() => document.getElementById('sideMenuToggle').click());
});

test('the side panel has a block to send suggestions to the developer', async ({ page }) => {
  await expect(page.locator('#sideMenu')).toContainText('Enviar al desarrollador sugerencias de mejoras');
  await expect(page.locator('#sugerenciaInput')).toBeVisible();
  await expect(page.locator('#btnEnviarSugerencia')).toHaveText('Enviar sugerencia');
});

test('sending an empty suggestion does not hit the backend', async ({ page }) => {
  const gas = await installGasMock(page);
  await page.reload();
  await expect(page.locator('#sheetsContainer table').first()).toBeVisible();
  await page.evaluate(() => document.getElementById('sideMenuToggle').click());

  await page.locator('#btnEnviarSugerencia').click();
  await expect(page.locator('#toast')).toContainText('Escribe algo');
  expect(gas.requests.find(r => r.action === 'saveSuggestion')).toBeFalsy();
});

test('sending a suggestion posts it to the backend, clears the box and confirms', async ({ page }) => {
  const gas = await installGasMock(page);
  await page.reload();
  await expect(page.locator('#sheetsContainer table').first()).toBeVisible();
  await page.evaluate(() => document.getElementById('sideMenuToggle').click());

  await page.locator('#sugerenciaInput').fill('Sería útil poder duplicar un plan entero.');
  await page.locator('#btnEnviarSugerencia').click();

  await expect(page.locator('#toast')).toContainText('Sugerencia enviada', { timeout: 10000 });
  const suggestionRequest = gas.requests.find(r => r.action === 'saveSuggestion');
  expect(suggestionRequest?.text).toBe('Sería útil poder duplicar un plan entero.');
  expect(suggestionRequest.timestamp).toBeTruthy();
  await expect(page.locator('#sugerenciaInput')).toHaveValue('');
});
