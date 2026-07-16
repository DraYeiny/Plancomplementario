const { test, expect } = require('@playwright/test');
const { installGasMock } = require('../helpers/gasMock');

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await installGasMock(page);
  await page.goto('/meal_plan_github.html');
  await expect(page.locator('#sheetsContainer table').first()).toBeVisible();
});

test.describe('WhatsApp preview text', () => {
  test('shows a provisional link for the meal plan by default', async ({ page }) => {
    await expect(page.locator('#dlPlan')).toBeChecked();
    await expect(page.locator('#waPreviewText')).toContainText('se generará al enviar');
  });

  test('includes the APLV allergy notice when that reference is selected', async ({ page }) => {
    await page.locator('#dlAplv').check();
    await expect(page.locator('#waPreviewText')).toContainText('no debe incluir leche de vaca');
  });

  test('includes the egg allergy notice when that reference is selected', async ({ page }) => {
    await page.locator('#dlHuevo').check();
    await expect(page.locator('#waPreviewText')).toContainText('no debe incluir huevo');
  });

  test('shows the combined allergy notice when both references are selected', async ({ page }) => {
    await page.locator('#dlAplv').check();
    await page.locator('#dlHuevo').check();
    await expect(page.locator('#waPreviewText')).toContainText('no debe incluir leche de vaca ni huevo');
  });

  test('unchecking every reference shows a placeholder instead of a message', async ({ page }) => {
    await page.locator('#dlPlan').uncheck();
    await expect(page.locator('#waPreviewText')).toContainText('Selecciona al menos un material');
    await expect(page.locator('#waPreviewSendBtn')).toBeDisabled();
  });

  test('the child name is reflected in the greeting', async ({ page }) => {
    await page.fill('#childName', 'Valentina');
    await expect(page.locator('#waPreviewText')).toContainText('Valentina');
  });
});

test.describe('PDF generation and delivery', () => {
  test('copying the WhatsApp message builds the plan PDF and copies the final text', async ({ page }) => {
    test.setTimeout(90000);
    const cell = page.locator('[data-id="w0_desayuno_fruta_0"]');
    await cell.click();
    await cell.type('Banano');
    await cell.blur();

    await page.locator('#waPreviewCopyBtn').click();
    // Poll in-page rather than via a separate expect()/evaluate() round trip:
    // on this environment, Chromium's clipboard is backed by the real OS
    // clipboard, and reading it back through a later, separate Playwright
    // call after locator-based polling reliably comes back empty even though
    // the app's own writeText() resolved successfully moments earlier.
    await page.waitForFunction(() => document.getElementById('waCopiedLabel').classList.contains('show'), { timeout: 60000 });

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).not.toContain('se generará al enviar');
    expect(clipboardText).toMatch(/https:\/\/drive\.google\.com/);
  });

  test('sending the WhatsApp message reports success when CallMeBot returns code 200', async ({ page }) => {
    test.setTimeout(90000);
    await page.locator('#waPreviewSendBtn').click();
    await expect(page.locator('#toast')).toContainText('Aviso enviado por WhatsApp', { timeout: 60000 });
  });

  test('sending the WhatsApp message reports queued when CallMeBot returns code 210', async ({ page }) => {
    test.setTimeout(90000);
    await installGasMock(page, { waResultCode: 210 });
    await page.reload();
    await expect(page.locator('#sheetsContainer table').first()).toBeVisible();

    await page.locator('#waPreviewSendBtn').click();
    await expect(page.locator('#toast')).toContainText('puede tardar unos minutos', { timeout: 60000 });
  });

  test('a failed reference PDF download does not block the plan PDF but warns the user', async ({ page }) => {
    test.setTimeout(90000);
    await page.route('https://drayeiny.github.io/Plancomplementario/**', route => route.fulfill({ status: 500, body: 'error' }));

    await page.locator('#waPreviewCopyBtn').click();
    await expect(page.locator('#toast')).toContainText('No se pudo adjuntar', { timeout: 30000 });
    await expect(page.locator('#waCopiedLabel')).toBeVisible({ timeout: 60000 });
  });

  test('a short message (no observations) is sent as a single WhatsApp message', async ({ page }) => {
    test.setTimeout(90000);
    const gas = await installGasMock(page);
    await page.reload();
    await expect(page.locator('#sheetsContainer table').first()).toBeVisible();

    await page.locator('#waPreviewSendBtn').click();
    await expect(page.locator('#toast')).toContainText('Aviso enviado por WhatsApp', { timeout: 60000 });

    const notifyRequests = gas.requests.filter(r => r.action === 'notifyDownload');
    expect(notifyRequests).toHaveLength(1);
  });

  test('a long message (many observations) is split into several WhatsApp messages, the first always carrying every selected link', async ({ page }) => {
    test.setTimeout(90000);
    const gas = await installGasMock(page);
    await page.reload();
    await expect(page.locator('#sheetsContainer table').first()).toBeVisible();

    await page.locator('#dlAplv').check();
    await page.locator('#dlHuevo').check();
    for (let i = 0; i < 6; i++) {
      await page.locator('#observacionesSection .btn-add-row').click();
      const row = page.locator('#obsList .obs-text').last();
      await row.click();
      await row.type(`Observación clínica de prueba número ${i + 1} con suficiente texto para sumar largo.`);
      await row.blur();
    }

    await page.locator('#waPreviewSendBtn').click();
    await expect(page.locator('#toast')).toContainText('mensajes', { timeout: 60000 });

    const notifyRequests = gas.requests.filter(r => r.action === 'notifyDownload');
    expect(notifyRequests.length).toBeGreaterThan(1);

    const planUrl = 'https://drive.google.com/file/d/mock-file-id/view?usp=sharing';
    const aplvHuevoUrl = 'https://drive.google.com/file/d/1OpBCRJW2u9tVh4WDSb5S8pJWXK87jCXF/view';
    expect(notifyRequests[0].text).toContain(planUrl);
    expect(notifyRequests[0].text).toContain(aplvHuevoUrl);
    for (const r of notifyRequests.slice(1)) {
      expect(r.text).not.toContain(planUrl);
      expect(r.text).not.toContain(aplvHuevoUrl);
    }
    expect(notifyRequests.some(r => r.text.includes('Observaciones importantes'))).toBe(true);
  });

  test('the WhatsApp message no longer includes the plan name or the closing pleasantry', async ({ page }) => {
    await page.locator('#childName').fill('Mateo');
    await expect(page.locator('#waPreviewText')).not.toContainText('con plan alimentario');
    await expect(page.locator('#waPreviewText')).not.toContainText('Cualquier duda');
  });
});
