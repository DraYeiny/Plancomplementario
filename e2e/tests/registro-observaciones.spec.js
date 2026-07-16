const { test, expect } = require('@playwright/test');
const { installGasMock } = require('../helpers/gasMock');

test.beforeEach(async ({ page }) => {
  await installGasMock(page);
  await page.goto('/meal_plan_github.html');
  await expect(page.locator('#sheetsContainer table').first()).toBeVisible();
});

test.describe('Registro de alimentación', () => {
  test('adding a row creates hora selects and a food text cell', async ({ page }) => {
    await page.locator('#addRowTr .btn-add-row').click();
    const row = page.locator('#registroBody tr').first();
    await expect(row.locator('.time-select-wrap select')).toHaveCount(3);
    await row.locator('.registro-alim-edit').click();
    await row.locator('.registro-alim-edit').type('Puré de manzana');
    await expect(row.locator('.registro-alim-edit')).toHaveText('Puré de manzana');
  });

  test('deleting a filled row asks for confirmation', async ({ page }) => {
    await page.locator('#addRowTr .btn-add-row').click();
    const row = page.locator('#registroBody tr').first();
    await row.locator('.registro-alim-edit').click();
    await row.locator('.registro-alim-edit').type('Yogur');
    await row.locator('.registro-alim-edit').blur();

    await row.locator('.btn-del-row').click();
    await expect(page.locator('#modalOverlay')).toHaveClass(/open/);
    await page.locator('#modalOk').click();
    await expect(page.locator('#registroBody tr')).toHaveCount(0);
  });

  test('deleting an empty row does not prompt for confirmation', async ({ page }) => {
    await page.locator('#addRowTr .btn-add-row').click();
    await page.locator('#registroBody tr .btn-del-row').first().click();
    await expect(page.locator('#modalOverlay')).not.toHaveClass(/open/);
    await expect(page.locator('#registroBody tr')).toHaveCount(0);
  });
});

test.describe('Observaciones', () => {
  test('adding and numbering observations', async ({ page }) => {
    await page.locator('#observacionesSection .btn-add-row').click();
    await page.locator('#observacionesSection .btn-add-row').click();
    await expect(page.locator('#obsList tr')).toHaveCount(2);
    await expect(page.locator('#obsList .obs-num-cell').nth(0)).toHaveText('1');
    await expect(page.locator('#obsList .obs-num-cell').nth(1)).toHaveText('2');
  });

  test('deleting the first observation renumbers the remaining one', async ({ page }) => {
    await page.locator('#observacionesSection .btn-add-row').click();
    await page.locator('#obsList .obs-text').first().click();
    await page.locator('#obsList .obs-text').first().type('Alergia leve');
    await page.locator('#observacionesSection .btn-add-row').click();

    await page.locator('#obsList tr').first().locator('.btn-del-row').click();
    await expect(page.locator('#modalOverlay')).toHaveClass(/open/);
    await page.locator('#modalOk').click();

    await expect(page.locator('#obsList tr')).toHaveCount(1);
    await expect(page.locator('#obsList .obs-num-cell').first()).toHaveText('1');
  });

  test('observations feed into the WhatsApp preview', async ({ page }) => {
    await page.locator('#observacionesSection .btn-add-row').click();
    await page.locator('#obsList .obs-text').first().click();
    await page.locator('#obsList .obs-text').first().type('No dar frutos secos');
    await page.locator('#obsList .obs-text').first().blur();
    await expect(page.locator('#waPreviewText')).toContainText('No dar frutos secos');
  });
});
