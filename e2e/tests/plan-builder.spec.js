const { test, expect } = require('@playwright/test');
const { installGasMock } = require('../helpers/gasMock');

test.beforeEach(async ({ page }) => {
  await installGasMock(page);
  await page.goto('/meal_plan_github.html');
  await expect(page.locator('#sheetsContainer table').first()).toBeVisible();
});

test.describe('Core plan builder', () => {
  test('loads with today as start date and one week of 3 meals x 7 days', async ({ page }) => {
    await expect(page.locator('.tab-btn')).toHaveCount(1);
    // desayuno(3 subs) + almuerzo(4) + cena(4) = 11 rows x 7 days
    await expect(page.locator('#sheet-0 .cell-edit')).toHaveCount(11 * 7);
  });

  test('typing the child name persists across reload via localStorage', async ({ page }) => {
    await page.fill('#childName', 'Sofía');
    // autoSave writes to localStorage synchronously (debounced sheet save is separate)
    await page.waitForTimeout(300);
    await page.reload();
    await expect(page.locator('#childName')).toHaveValue('Sofía');
  });

  test('changing weeks count adds/removes week tabs', async ({ page }) => {
    await page.fill('#weeksInput', '3');
    await page.locator('#weeksInput').blur();
    await expect(page.locator('.tab-btn')).toHaveCount(3);

    // Reducing weeks with no data should not prompt for confirmation
    await page.fill('#weeksInput', '1');
    await page.locator('#weeksInput').blur();
    await expect(page.locator('.tab-btn')).toHaveCount(1);
  });

  test('reducing weeks with data prompts for confirmation before deleting', async ({ page }) => {
    await page.fill('#weeksInput', '2');
    await page.locator('#weeksInput').blur();
    await page.locator('#tabsBar .tab-btn').nth(1).click();
    const secondWeekCell = page.locator('#sheet-1 .cell-edit').first();
    await secondWeekCell.click();
    await secondWeekCell.type('Arroz');
    await secondWeekCell.blur();

    await page.fill('#weeksInput', '1');
    await page.locator('#weeksInput').blur();
    await expect(page.locator('#modalOverlay')).toHaveClass(/open/);
    await page.locator('#modalCancel').click();
    await expect(page.locator('.tab-btn')).toHaveCount(2);
  });

  test('filling a meal cell shows matching autocomplete suggestions', async ({ page }) => {
    const cell = page.locator('[data-id="w0_desayuno_cereal_0"]');
    await cell.click();
    await cell.type('arr');
    await expect(page.locator('#acDropdown')).toHaveClass(/open/);
    await expect(page.locator('#acDropdown .ac-item')).toContainText(['Arroz']);
  });

  test('selecting an autocomplete suggestion fills the cell', async ({ page }) => {
    const cell = page.locator('[data-id="w0_almuerzo_proteina_2"]');
    await cell.click();
    await cell.type('poll');
    await page.locator('#acDropdown .ac-item', { hasText: 'Pollo' }).click();
    await expect(cell).toHaveText('Pollo');
  });

  test('copy week bar appears when switching to an empty week with other filled weeks', async ({ page }) => {
    await page.fill('#weeksInput', '2');
    await page.locator('#weeksInput').blur();
    const firstCell = page.locator('#sheet-0 .cell-edit').first();
    await firstCell.click();
    await firstCell.type('Avena');
    await firstCell.blur();

    await page.locator('#tabsBar .tab-btn').nth(1).click();
    await expect(page.locator('#copyWeekBar')).toHaveClass(/open/);
    await page.locator('.btn-copy-yes').click();
    const copiedCell = page.locator('[data-id="w1_desayuno_cereal_0"]');
    await expect(copiedCell).toHaveText('Avena');
  });
});
