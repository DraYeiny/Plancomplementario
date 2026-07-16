const { test, expect } = require('@playwright/test');
const { installGasMock } = require('../helpers/gasMock');

test('saving a new plan sends it to the backend and shows it in the picker', async ({ page }) => {
  const gas = await installGasMock(page);
  await page.goto('/meal_plan_github.html');
  await expect(page.locator('#sheetsContainer table').first()).toBeVisible();

  await page.fill('#childName', 'Mateo');
  const cell = page.locator('[data-id="w0_desayuno_fruta_0"]');
  await cell.click();
  await cell.type('Banano');
  await cell.blur();

  await expect(page.locator('#btnGuardarComo')).toBeVisible();
  await page.locator('#btnGuardarComo').click();

  await expect(page.locator('#modalOverlay')).toHaveClass(/open/);
  await page.locator('#modalInput').fill('Plan de Mateo');
  await page.locator('#modalOk').click();

  await expect(page.locator('#toast')).toContainText('Plan guardado', { timeout: 10000 });
  const saveRequest = gas.requests.find(r => r.action === 'save' && r.plan?.name === 'Plan de Mateo');
  expect(saveRequest).toBeTruthy();
  expect(saveRequest.plan.data.cells['w0_desayuno_fruta_0']).toBe('Banano');

  await page.locator('#planPickerBtn').click();
  await expect(page.locator('#planPickerList')).toContainText('Plan de Mateo');
});

test('loading an existing plan replaces the on-screen data after confirmation', async ({ page }) => {
  await installGasMock(page, {
    initialPlans: [
      {
        id: 'plan_existing',
        name: 'Plan Guardado',
        created: new Date().toISOString(),
        data: { cells: { w0_desayuno_cereal_0: 'Avena' }, childName: 'Existing Kid' },
      },
    ],
  });
  await page.goto('/meal_plan_github.html');
  await expect(page.locator('#sheetsContainer table').first()).toBeVisible();

  await page.locator('#planPickerBtn').click();
  await page.locator('.plan-picker-item-name', { hasText: 'Plan Guardado' }).click();

  await expect(page.locator('#modalOverlay')).toHaveClass(/open/);
  await page.locator('#modalOk').click();

  await expect(page.locator('#toast')).toContainText('Plan cargado');
  await expect(page.locator('[data-id="w0_desayuno_cereal_0"]')).toHaveText('Avena');
  await expect(page.locator('#planPickerLabel')).toHaveText('Plan Guardado');
});

test('deleting a plan removes it from the backend and the picker', async ({ page }) => {
  const gas = await installGasMock(page, {
    initialPlans: [
      { id: 'plan_del', name: 'Plan a Borrar', created: new Date().toISOString(), data: { cells: {} } },
    ],
  });
  await page.goto('/meal_plan_github.html');
  await expect(page.locator('#sheetsContainer table').first()).toBeVisible();

  await page.locator('#planPickerBtn').click();
  await page.locator('.plan-picker-item-del', { hasText: '🗑️' }).first().click();

  await expect(page.locator('#modalOverlay')).toHaveClass(/open/);
  await page.locator('#modalOk').click();

  await expect(page.locator('#toast')).toContainText('Plan eliminado', { timeout: 10000 });
  const deleteRequest = gas.requests.find(r => r.action === 'delete');
  expect(deleteRequest?.id).toBe('plan_del');
  await page.locator('#planPickerBtn').click();
  await expect(page.locator('#planPickerList')).toContainText('Todavía no hay planes guardados');
});

test('saving over an existing plan name asks to overwrite', async ({ page }) => {
  await installGasMock(page, {
    initialPlans: [
      { id: 'plan_a', name: 'Duplicado', created: new Date().toISOString(), data: { cells: {} } },
    ],
  });
  await page.goto('/meal_plan_github.html');
  await expect(page.locator('#sheetsContainer table').first()).toBeVisible();

  const cell = page.locator('[data-id="w0_desayuno_fruta_0"]');
  await cell.click();
  await cell.type('Mango');
  await cell.blur();

  await page.locator('#btnGuardarComo').click();
  await page.locator('#modalInput').fill('Duplicado');
  await page.locator('#modalOk').click();

  await expect(page.locator('#modalMsg')).toContainText('sobreescribirlo');
  await page.locator('#modalOk').click();
  await expect(page.locator('#toast')).toContainText('Plan guardado', { timeout: 10000 });
});
