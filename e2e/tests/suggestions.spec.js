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

test.describe('bell — read-only list of sent suggestions', () => {
  test('the bell sits at the top-left and its panel starts closed', async ({ page }) => {
    const box = await page.locator('#suggestionsBellBtn').boundingBox();
    expect(box.x).toBeLessThan(60);
    expect(box.y).toBeLessThan(60);
    await expect(page.locator('#suggestionsPanel')).not.toHaveClass(/open/);
  });

  test('clicking the bell with no suggestions shows an empty state', async ({ page }) => {
    await page.locator('#suggestionsBellBtn').click();
    await expect(page.locator('#suggestionsPanel')).toHaveClass(/open/);
    await expect(page.locator('#suggestionsList')).toContainText('Todavía no hay sugerencias enviadas');
  });

  test('a sent suggestion shows up in the bell panel and cannot be deleted', async ({ page }) => {
    await page.locator('#sugerenciaInput').fill('Agregar exportar a Excel.');
    await page.locator('#btnEnviarSugerencia').click();
    await expect(page.locator('#toast')).toContainText('Sugerencia enviada', { timeout: 10000 });

    await page.locator('#suggestionsBellBtn').click();
    const item = page.locator('.suggestion-item', { hasText: 'Agregar exportar a Excel.' });
    await expect(item).toBeVisible();
    await expect(item.locator('button')).toHaveCount(0);
  });

  test('previously sent suggestions load when the bell is opened', async ({ page }) => {
    await installGasMock(page, {
      initialSuggestions: [
        { timestamp: '2026-01-05T10:00:00.000Z', text: 'Poner recordatorios de control.' },
      ],
    });
    await page.reload();
    await expect(page.locator('#sheetsContainer table').first()).toBeVisible();

    await page.locator('#suggestionsBellBtn').click();
    await expect(page.locator('#suggestionsList')).toContainText('Poner recordatorios de control.');
  });

  test('clicking the bell again, or clicking elsewhere, collapses the panel', async ({ page }) => {
    await page.locator('#suggestionsBellBtn').click();
    await expect(page.locator('#suggestionsPanel')).toHaveClass(/open/);

    await page.locator('#suggestionsBellBtn').click();
    await expect(page.locator('#suggestionsPanel')).not.toHaveClass(/open/);

    await page.locator('#suggestionsBellBtn').click();
    await expect(page.locator('#suggestionsPanel')).toHaveClass(/open/);
    await page.locator('#childName').click();
    await expect(page.locator('#suggestionsPanel')).not.toHaveClass(/open/);
  });
});
