const { test, expect } = require('@playwright/test');
const { installGasMock } = require('../helpers/gasMock');

test.beforeEach(async ({ page }) => {
  await installGasMock(page, {
    initialPlans: [
      { id: 'plan_existing', name: 'Plan Guardado', created: new Date().toISOString(), data: { cells: { w0_desayuno_cereal_0: 'Avena' } } },
    ],
  });
  await page.goto('/meal_plan_github.html');
  await expect(page.locator('#sheetsContainer table').first()).toBeVisible();
  await page.evaluate(() => document.getElementById('sideMenuToggle').click());
});

test('the blank-plan button sits above the available-material section and looks different from Download', async ({ page }) => {
  const blankBtn = page.locator('#btnPlanEnBlanco');
  await expect(blankBtn).toHaveText('PLAN EN BLANCO');

  const blankBg = await blankBtn.evaluate(el => getComputedStyle(el).backgroundImage);
  const downloadBg = await page.locator('#sideBtnDownload').evaluate(el => getComputedStyle(el).backgroundImage);
  expect(blankBg).not.toBe(downloadBg);

  const order = await page.evaluate(() => {
    const nav = document.getElementById('sideMenu');
    const items = Array.from(nav.querySelectorAll('#btnPlanEnBlanco, .side-menu-label'));
    return items.map(el => el.id || el.textContent);
  });
  expect(order[0]).toBe('btnPlanEnBlanco');
  expect(order[1]).toContain('Material de alimentación disponible');
});

test('clicking it asks for confirmation before clearing anything', async ({ page }) => {
  await page.locator('#childName').fill('Sofía');
  await page.locator('#btnPlanEnBlanco').click();
  await expect(page.locator('#modalOverlay')).toHaveClass(/open/);

  await page.locator('#modalCancel').click();
  await expect(page.locator('#childName')).toHaveValue('Sofía');
});

test('confirming clears the child name, cells, registro and observaciones, and deselects the loaded plan', async ({ page }) => {
  await page.locator('#planPickerBtn').click();
  await page.locator('.plan-picker-item-name', { hasText: 'Plan Guardado' }).click();
  await page.locator('#modalOk').click();
  await expect(page.locator('[data-id="w0_desayuno_cereal_0"]')).toHaveText('Avena');
  await expect(page.locator('#planPickerLabel')).toHaveText('Plan Guardado');

  await page.locator('#childName').fill('Sofía');
  await page.locator('#addRowTr .btn-add-row').click();
  await page.locator('#observacionesSection .btn-add-row').click();

  await page.evaluate(() => document.getElementById('sideMenuToggle').click());
  await page.locator('#btnPlanEnBlanco').click();
  await expect(page.locator('#modalOverlay')).toHaveClass(/open/);
  await page.locator('#modalOk').click();

  await expect(page.locator('#toast')).toContainText('Pantalla en blanco');
  await expect(page.locator('#childName')).toHaveValue('');
  await expect(page.locator('[data-id="w0_desayuno_cereal_0"]')).toHaveText('');
  await expect(page.locator('#registroBody tr')).toHaveCount(0);
  await expect(page.locator('#obsList tr')).toHaveCount(0);
  await expect(page.locator('.tab-btn')).toHaveCount(1);
  await expect(page.locator('#planPickerLabel')).toHaveText('— Seleccionar plan —');
});

test('the blank-plan action can be undone', async ({ page }) => {
  await page.locator('#childName').fill('Sofía');
  await page.locator('#btnPlanEnBlanco').click();
  await page.locator('#modalOk').click();
  await expect(page.locator('#childName')).toHaveValue('');

  await page.locator('#undoBtn').click();
  await expect(page.locator('#childName')).toHaveValue('Sofía');
});
