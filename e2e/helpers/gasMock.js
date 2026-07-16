// Mocks the Google Apps Script backend (SHEET_URL) so tests never hit the
// real Google Sheet, Drive folder, or send real WhatsApp/CallMeBot messages.
// Mirrors the request/response contract implemented in code.gs.
const SHEET_URL_PREFIX = 'https://script.google.com/macros/s/AKfycbzL18xzYUTObaBxbDI6Fznicb6AI-O_K11i5rIwGx0kSDQEWPY-DknXUN4m7K05b_cv/exec';

async function installGasMock(page, { initialPlans = [], waResultCode = 200 } = {}) {
  const state = {
    plans: initialPlans.map(p => ({ ...p })),
    requests: [],
    waResultCode,
    driveUploads: [],
  };

  await page.route(`${SHEET_URL_PREFIX}**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const action = url.searchParams.get('action');

    if (request.method() === 'GET') {
      if (action === 'getWhatsAppResult') {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, whatsapp: { code: state.waResultCode, body: 'mock' } }),
        });
        return;
      }
      if (action === 'getLocal') {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: null }) });
        return;
      }
      if (action === 'getDriveLink') {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false }) });
        return;
      }
      // Plain GET: list all saved plans (as doGet does with no action param)
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, plans: state.plans }),
      });
      return;
    }

    if (request.method() === 'POST') {
      let body = {};
      try { body = JSON.parse(request.postData() || '{}'); } catch (e) { /* ignore */ }
      state.requests.push(body);

      if (body.action === 'save') {
        const idx = state.plans.findIndex(p => String(p.id) === String(body.plan.id));
        if (idx >= 0) state.plans[idx] = body.plan; else state.plans.push(body.plan);
      } else if (body.action === 'delete') {
        state.plans = state.plans.filter(p => String(p.id) !== String(body.id));
      } else if (body.action === 'saveToDrive') {
        state.driveUploads.push(body);
        // uploadToDrive() (unlike save/delete/notifyDownload) does NOT use
        // no-cors — it reads r.json() and requires an {ok, link} shape.
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, link: 'https://drive.google.com/file/d/mock-file-id/view?usp=sharing' }),
        });
        return;
      }
      // Other actions (save/delete/notifyDownload) are POSTed with mode:'no-cors'
      // in the app, so the page can never read this body — status/content don't
      // matter to it, but we still fulfill so the request completes instead of hanging.
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      return;
    }

    await route.continue();
  });

  return state;
}

module.exports = { installGasMock, SHEET_URL_PREFIX };
