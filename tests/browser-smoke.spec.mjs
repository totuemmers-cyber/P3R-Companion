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
    fusionSettings: { dlcEnabled: false, manualUnlocks: {} }
  };

  await page.evaluate((state) => {
    localStorage.setItem('p3r-companion-state', JSON.stringify(state));
  }, payload);
  await page.reload();

  await expect(page.locator('#planner-run-state [data-rs-field="month"]')).toHaveValue('6');
  await expect(page.locator('#planner-run-state [data-rs-field="day"]')).toHaveValue('24');
  await page.locator('.app-nav-tab[data-section="velvet"]').click();
  await expect(page.locator('#roster-count')).toHaveText('1/194');
  await expect(page.locator('#roster-grid')).toContainText('Orpheus');

  await page.locator('.app-nav-tab[data-section="social-links"]').click();
  await expect(page.locator('#sl-status-date')).toHaveText('Jun 24');
});
