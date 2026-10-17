// Run only against a fresh isolated dashboard demo fixture. This test records
// one synthetic correction through the UI; never point it at existing records.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const api = process.env.DASHBOARD_API_URL || 'http://127.0.0.1:8000';
    async function get(path) {
      const response = await page.request.get(api + path);
      assert.equal(response.ok(), true, path);
      return response.json();
    }
    const operations = await get('/dashboards/operations');
    assert.equal(operations.total_observations, 24, 'Use a new isolated demo fixture');
    assert.equal(operations.reviewed_observations, 12, 'Do not rerun against an already modified fixture');
    const functional = await get('/dashboards/functional');
    const selected = functional.sessions.find(item => item.status === 'approved');
    assert.ok(selected);
    const before = await get('/sessions/' + selected.id);
    const evidence = await get('/dashboards/sessions/' + selected.id + '/evidence');
    const pending = evidence.observations.find(item => item.review_status === 'pending');
    const reviewer = evidence.observations.find(item => item.reviewed_by)?.reviewed_by;
    assert.ok(pending && reviewer);

    await page.goto(process.env.DASHBOARD_BASE_URL || 'http://127.0.0.1:5173');
    await page.getByRole('button', { name: 'Functional intelligence', exact: true }).click();
    await page.getByRole('row').filter({ hasText: selected.id }).getByRole('button', { name: 'Inspect evidence' }).click();
    await page.getByRole('button', { name: 'Open session workspace' }).click();
    const draft = page.getByRole('region', { name: 'Synthetic consolidated functional draft' });
    await draft.getByText('Consolidation blocked', { exact: true }).waitFor();
    await page.getByLabel('Registered synthetic professional ID').fill(reviewer);
    const card = page.locator('.registry-review .observation-card').filter({ has: page.getByLabel('Professional decision') });
    assert.equal(await card.count(), 1);
    await card.getByLabel('Professional decision').selectOption('correct');
    await card.getByLabel('Corrected functional domain').fill('Participation');
    await card.getByRole('button', { name: 'Confirm decision' }).click();
    await draft.getByText('SYNTHETIC DRAFT — NOT A CLINICAL RECORD', { exact: true }).waitFor();
    await page.locator('.registry-review').getByText('Decision history', { exact: true }).waitFor();

    assert.deepEqual(await get('/sessions/' + selected.id), before);
    const after = await get('/registry/sessions/' + selected.id + '/functional-documentation');
    assert.equal(after.eligible_for_consolidation, true);
    assert.equal(after.is_final_record, false);
    assert.deepEqual(after.counts, { total: 4, accepted: 3, pending: 0, rejected: 1 });
    const reviewed = after.reviewed_observations.find(item => item.observation_id === pending.id);
    assert.equal(reviewed.source_excerpt, pending.source_excerpt);
    assert.equal(reviewed.final_domain, 'Participation');
    assert.equal(reviewed.audit_event_ids.length, 1);
    const events = await get('/registry/observations/' + pending.id + '/review-events');
    assert.equal(events[0].decision, 'correct');
    assert.equal(events[0].reviewer_id, reviewer);
    await page.getByRole('button', { name: 'Operations', exact: true }).click();
    await page.getByText('13 of 24 observations reviewed', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'AI governance', exact: true }).click();
    await page.getByText(/Showing 13 of 13 audit events/).waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: approved-session domain-only review, unchanged session, audit history, refreshed preview/consolidated draft, dashboard totals and governance trace; synthetic fixture only');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
