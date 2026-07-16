const { test, expect } = require('@playwright/test');
const { installGasMock } = require('../helpers/gasMock');

test.beforeEach(async ({ page }) => {
  await installGasMock(page);
  await page.goto('/meal_plan_github.html');
  await expect(page.locator('#sheetsContainer table').first()).toBeVisible();
});

test.describe('Undo', () => {
  test('undo button is hidden until an action is committed', async ({ page }) => {
    await expect(page.locator('#undoBtn')).not.toHaveClass(/show/);
    const cell = page.locator('[data-id="w0_desayuno_cereal_0"]');
    await cell.click();
    await cell.type('Avena');
    await cell.blur();
    await expect(page.locator('#undoBtn')).toHaveClass(/show/);
  });

  test('undo reverts the last cell edit', async ({ page }) => {
    const cell = page.locator('[data-id="w0_desayuno_cereal_0"]');
    await cell.click();
    await cell.type('Avena');
    await cell.blur();
    await expect(cell).toHaveText('Avena');

    await page.locator('#undoBtn').click();
    await expect(cell).toHaveText('');
    await expect(page.locator('#toast')).toContainText('Acción deshecha');
  });

  test('undo reverts a row deletion in the registro table', async ({ page }) => {
    await page.locator('#addRowTr .btn-add-row').click();
    const row = page.locator('#registroBody tr').first();
    await row.locator('.registro-alim-edit').click();
    await row.locator('.registro-alim-edit').type('Compota');
    await row.locator('.registro-alim-edit').blur();

    await row.locator('.btn-del-row').click();
    await page.locator('#modalOk').click();
    await expect(page.locator('#registroBody tr')).toHaveCount(0);

    await page.locator('#undoBtn').click();
    await expect(page.locator('#registroBody tr')).toHaveCount(1);
    await expect(page.locator('#registroBody .registro-alim-edit')).toHaveText('Compota');
  });
});

test.describe('Calendar picker', () => {
  test('opening the calendar highlights today and lets you pick a date', async ({ page }) => {
    await page.locator('#btnStart').click();
    await expect(page.locator('#calOverlay')).toHaveClass(/open/);
    await expect(page.locator('.cal-grid .day.today')).toBeVisible();

    const anyDay = page.locator('.cal-grid .day:not(.other-month)').first();
    const dayNum = await anyDay.textContent();
    await anyDay.click();

    await expect(page.locator('#calOverlay')).not.toHaveClass(/open/);
    await expect(page.locator('#lblStart')).toContainText(dayNum.trim());
  });

  test('navigating to the previous month updates the title and clears selection context', async ({ page }) => {
    await page.locator('#btnStart').click();
    const title = await page.locator('#calTitle').textContent();
    await page.locator('#calPrev').click();
    await expect(page.locator('#calTitle')).not.toHaveText(title);
    await page.locator('#calClose').click();
    await expect(page.locator('#calOverlay')).not.toHaveClass(/open/);
  });
});

test.describe('Repeat mode', () => {
  test('pressing Enter on a filled cell arms repeat mode for the same food category', async ({ page }) => {
    const src = page.locator('[data-id="w0_desayuno_cereal_0"]');
    await src.click();
    await src.type('Avena');
    await src.press('Enter');

    await expect(page.locator('#repeatBar')).toHaveClass(/open/);
    await expect(src).toHaveClass(/cell-source/);
    // Other "cereal" cells across days should become selectable, other categories should not
    await expect(page.locator('[data-id="w0_desayuno_cereal_1"]')).toHaveClass(/cell-selectable/);
    await expect(page.locator('[data-id="w0_desayuno_fruta_1"]')).not.toHaveClass(/cell-selectable/);
  });

  test('applying repeat mode copies the source text into every selected cell', async ({ page }) => {
    const src = page.locator('[data-id="w0_desayuno_cereal_0"]');
    await src.click();
    await src.type('Avena');
    await src.press('Enter');

    const target1 = page.locator('[data-id="w0_desayuno_cereal_1"]');
    const target2 = page.locator('[data-id="w0_desayuno_cereal_2"]');
    await target1.click();
    await target2.click();
    await expect(page.locator('#repeatBarCount')).toContainText('2 casillas seleccionadas');

    await page.locator('.btn-rbar-apply').click();
    await expect(page.locator('#repeatBar')).not.toHaveClass(/open/);
    await expect(target1).toHaveText('Avena');
    await expect(target2).toHaveText('Avena');
    await expect(page.locator('#toast')).toContainText('Texto copiado en 2 casillas');
  });

  test('cancelling repeat mode leaves other cells untouched', async ({ page }) => {
    const src = page.locator('[data-id="w0_desayuno_cereal_0"]');
    await src.click();
    await src.type('Avena');
    await src.press('Enter');

    const target = page.locator('[data-id="w0_desayuno_cereal_1"]');
    await target.click();
    await page.locator('.btn-rbar-cancel').click();

    await expect(page.locator('#repeatBar')).not.toHaveClass(/open/);
    await expect(target).toHaveText('');
    await expect(src).not.toHaveClass(/cell-source/);
  });
});
