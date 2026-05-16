import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      failures.push(message.text());
    }
  });
  page.__failures = failures;
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test.afterEach(async ({ page }) => {
  expect(page.__failures).toEqual([]);
});

async function expectNoHorizontalPageOverflow(page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

test('loads every primary section without browser errors', async ({ page }) => {
  await expect(page.locator('#planner.app-section.active')).toBeVisible();
  await expect(page.locator('#planner-primary-action')).toContainText(/Do Next|Tartarus|Social Link|Raise/i);

  await page.locator('.app-nav-tab[data-section="requests"]').click();
  await expect(page.locator('#requests.app-section.active')).toBeVisible();
  await expect(page.locator('#requests-list')).toContainText('Bring me a Muscle Drink');

  await page.locator('.app-nav-tab[data-section="tartarus"]').click();
  await expect(page.locator('#tartarus.app-section.active')).toBeVisible();
  await expect(page.locator('#floorInfo')).toContainText(/Thebel|Floor|Shadow/i);

  await page.locator('.app-nav-tab[data-section="velvet"]').click();
  await expect(page.locator('#velvet.app-section.active')).toBeVisible();
  await page.locator('#velvet .tab-btn[data-tab="fusion"]').click();
  await expect(page.locator('#tab-fusion.active')).toBeVisible();
  await expect(page.locator('#special-list')).toContainText('Orpheus');

  await page.locator('.app-nav-tab[data-section="social-links"]').click();
  await expect(page.locator('#social-links.app-section.active')).toBeVisible();
  await expect(page.locator('#sl-progress-grid')).toContainText('Magician');
});

test('persists imported progress into the visible UI', async ({ page }) => {
  const payload = {
    version: 1,
    roster: ['Orpheus'],
    profile: {
      gameDate: { month: 6, day: 24 },
      playerLevel: 20,
      currentFloor: 54,
      stats: { academics: 3, charm: 4, courage: 4 }
    },
    socialLinks: {
      ranks: {
        Fool: 2,
        Magician: 3,
        Chariot: 2
      }
    },
    objectives: {},
    linkedEpisodes: { completed: {}, skipped: {} },
    fusionSettings: { dlcEnabled: false, manualUnlocks: {} },
    reminders: [
      {
        id: 'request-muscle-drink',
        system: 'Requests',
        title: 'Request #1: Bring me a Muscle Drink',
        detail: 'Deadline check',
        date: { month: 6, day: 24 },
        priority: 'high',
        status: 'active',
        source: 'request:test',
        targetAction: { type: 'requests', label: 'Open Requests' }
      }
    ]
  };

  await page.evaluate((state) => {
    localStorage.setItem('p3r-companion-state', JSON.stringify(state));
  }, payload);
  await page.reload();

  await expect(page.locator('#planner-run-state [data-rs-field="month"]')).toHaveValue('6');
  await expect(page.locator('#planner-run-state [data-rs-field="day"]')).toHaveValue('24');
  await expect(page.locator('[data-open-reminders]')).toContainText('1 due');
  await page.locator('[data-open-reminders]').first().click();
  await expect(page.locator('#reminder-drawer.active')).toBeVisible();
  await expect(page.locator('#reminder-drawer-body')).toContainText('Request #1');
  await page.locator('[data-reminder-done="request-muscle-drink"]').click();
  await expect(page.locator('#reminder-drawer-body')).toContainText('Done');
  await page.locator('.app-nav-tab[data-section="velvet"]').click();
  await expect(page.locator('#roster-count')).toHaveText('1/194');
  await expect(page.locator('#roster-grid')).toContainText('Orpheus');

  await page.locator('.app-nav-tab[data-section="social-links"]').click();
  await expect(page.locator('#sl-status-date')).toHaveText('Jun 24');
});

test('adds a contextual request reminder without creating a new top-level section', async ({ page }) => {
  await page.locator('.app-nav-tab[data-section="requests"]').click();
  await page.locator('[data-request-id]').filter({ hasText: 'pine resin' }).first().click();
  await page.locator('[data-action="remind-request"]').click();

  await expect(page.locator('#planner.app-section.active')).toBeVisible();
  await expect(page.locator('.app-nav-tab[data-section="reminders"]')).toHaveCount(0);
  await expect(page.locator('#reminder-drawer.active')).toBeVisible();
  await expect(page.locator('#reminder-drawer-body')).toContainText('pine resin');
  await expect(page.locator('[data-open-reminders]')).toContainText(/reminders|due/i);
});

test('keeps top-level navigation compact and prevents page overflow on desktop and mobile', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);
    await page.reload();

    await expect(page.locator('.app-nav-tab')).toHaveCount(5);
    await expect(page.locator('.app-nav-tab[data-section="planner"]')).toBeVisible();
    await expect(page.locator('.app-nav-tab[data-section="social-links"]')).toBeVisible();
    await expectNoHorizontalPageOverflow(page);

    const navBox = await page.locator('.app-nav').boundingBox();
    expect(navBox.height).toBeLessThanOrEqual(viewport.width < 600 ? 72 : 76);

    for (const section of ['requests', 'tartarus', 'velvet', 'social-links', 'planner']) {
      await page.locator(`.app-nav-tab[data-section="${section}"]`).click();
      await expect(page.locator(`#${section}.app-section.active`)).toBeVisible();
      await expectNoHorizontalPageOverflow(page);
    }
  }
});

test('keeps modal, drawer, filters, and tab workflows usable after responsive cleanup', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();

  await page.locator('#save-gear-btn').click();
  await expect(page.locator('#save-modal-overlay.active')).toBeVisible();
  await page.locator('#save-code-input').fill('not-a-save-code');
  await page.locator('#save-import-code').click();
  await expect(page.locator('#save-import-feedback')).toContainText('Invalid share code');
  await page.locator('#save-modal-close').click();
  await expect(page.locator('#save-modal-overlay')).not.toHaveClass(/active/);

  await page.locator('.app-nav-tab[data-section="requests"]').click();
  await page.locator('#requests-search').fill('pine resin');
  await expect(page.locator('#requests-list')).toContainText(/pine resin/i);
  await page.locator('[data-request-id]').filter({ hasText: /pine resin/i }).first().click();
  await page.locator('[data-action="remind-request"]').click();
  await expect(page.locator('#reminder-drawer.active')).toBeVisible();
  await page.locator('#reminder-drawer-close').click();
  await expect(page.locator('#reminder-drawer')).not.toHaveClass(/active/);

  await page.locator('.app-nav-tab[data-section="tartarus"]').click();
  await page.locator('#tartarus .nav-tab[data-view="shadowintel"]').click();
  await expect(page.locator('#shadowIntelView.active')).toBeVisible();
  await page.locator('#searchBox').fill('Maya');
  await expect(page.locator('#resultCount')).toContainText(/result|shadow/i);

  await page.locator('.app-nav-tab[data-section="velvet"]').click();
  await page.locator('#velvet .tab-btn[data-tab="compendium"]').click();
  await expect(page.locator('#tab-compendium.active')).toBeVisible();
  await page.locator('#comp-search').fill('Orpheus');
  await page.getByRole('cell', { name: 'Orpheus', exact: true }).first().click();
  await expect(page.locator('#comp-detail-drawer.active')).toBeVisible();
  await page.locator('#comp-detail-close').click();

  await page.locator('.app-nav-tab[data-section="social-links"]').click();
  await page.locator('#social-links .sl-tab-btn[data-tab="my-links"]').click();
  await expect(page.locator('#sl-tab-my-links.active')).toBeVisible();
  await page.locator('#sl-links-search').fill('Kenji');
  await expect(page.locator('#sl-links-grid')).toContainText(/Kenji|Magician/i);
  await page.locator('#social-links .sl-tab-btn[data-tab="calendar"]').click();
  await expect(page.locator('#sl-tab-calendar.active')).toBeVisible();
  await page.locator('.sl-cal-mode-btn[data-mode="actionable"]').click();
  await expect(page.locator('.sl-cal-mode-btn[data-mode="actionable"]')).toHaveClass(/active/);
  await expectNoHorizontalPageOverflow(page);
});

test('keeps practical touch targets on key visible controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();

  async function expectVisibleTargets(selector) {
    const handles = await page.locator(selector).elementHandles();
    expect(handles.length, selector).toBeGreaterThan(0);

    for (const handle of handles.slice(0, 6)) {
      const box = await handle.boundingBox();
      expect(box, selector).not.toBeNull();
      expect(Math.min(box.width, box.height), selector).toBeGreaterThanOrEqual(34);
      expect(Math.max(box.width, box.height), selector).toBeGreaterThanOrEqual(40);
    }
  }

  for (const selector of ['.app-nav-tab', '#save-gear-btn', '#planner .run-state-field select:visible', '#planner .run-state-field input:visible']) {
    await expectVisibleTargets(selector);
  }

  await page.locator('.app-nav-tab[data-section="requests"]').click();
  for (const selector of ['#requests-search', '#requests-category', '#requests-status']) {
    await expectVisibleTargets(selector);
  }
  await page.locator('[data-request-id]').first().click();
  for (const selector of ['#requests .request-action-btn:visible', '#requests .request-complete-toggle:visible']) {
    await expectVisibleTargets(selector);
  }

  await page.locator('.app-nav-tab[data-section="social-links"]').click();
  for (const selector of ['#social-links .sl-tab-btn:visible', '.sl-focus-btn:visible']) {
    await expectVisibleTargets(selector);
  }
  await page.locator('#social-links .sl-tab-btn[data-tab="my-links"]').click();
  for (const selector of ['.sl-filter-chip:visible', '#sl-links-search', '#sl-links-sort']) {
    await expectVisibleTargets(selector);
  }
});
