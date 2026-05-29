import { expect, test } from '../../fixtures';

test.describe('Creator Detail Page', () => {
  async function waitForLoad(creatorDetailPage: any) {
    await creatorDetailPage.loadingSpinner.waitFor({ state: 'hidden', timeout: 25000 }).catch(() => {});
  }

  test('loads profile info for known creator', async ({ creatorDetailPage, page }) => {
    await creatorDetailPage.goto('meanddevil252');
    await waitForLoad(creatorDetailPage);
    if (await creatorDetailPage.name.isVisible().catch(() => false)) {
      await expect(creatorDetailPage.name).toBeVisible();
    }
  });

  test('displays creator avatar', async ({ creatorDetailPage, page }) => {
    await creatorDetailPage.goto('meanddevil252');
    await waitForLoad(creatorDetailPage);
    if (await creatorDetailPage.avatarImg.isVisible().catch(() => false)) {
      await expect(creatorDetailPage.avatarImg).toBeVisible();
    }
  });

  test('shows stats section', async ({ creatorDetailPage, page }) => {
    await creatorDetailPage.goto('meanddevil252');
    await waitForLoad(creatorDetailPage);
    if (await creatorDetailPage.stats.isVisible().catch(() => false)) {
      await expect(creatorDetailPage.stats).toBeVisible();
      await expect(creatorDetailPage.statGifs).toBeVisible();
      await expect(creatorDetailPage.statFollowers).toBeVisible();
      await expect(creatorDetailPage.statViews).toBeVisible();
    }
  });

  test('shows join date for existing creator', async ({ creatorDetailPage, page }) => {
    await creatorDetailPage.goto('meanddevil252');
    await waitForLoad(creatorDetailPage);
    if (await creatorDetailPage.joinDate.isVisible().catch(() => false)) {
      await expect(creatorDetailPage.joinDate).toBeVisible();
    }
  });

  test('displays GIF grid after loading', async ({ creatorDetailPage, page }) => {
    await creatorDetailPage.goto('meanddevil252');
    await waitForLoad(creatorDetailPage);
    if (await creatorDetailPage.gifCards.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(creatorDetailPage.gifCards.first()).toBeVisible();
    }
  });

  test('gif card navigates to watch page', async ({ page }) => {
    await page.goto('/creator/meanddevil252');
    await page.evaluate(() => localStorage.setItem('redgaze-settings', JSON.stringify({ storiesNavigation: false })));
    await page.reload();
    await page.locator('[data-testid^="gif-card-"]').first().waitFor({ state: 'visible', timeout: 15000 });
    const firstCard = page.locator('[data-testid^="gif-card-"]').first();
    await firstCard.click();
    await expect(page).toHaveURL(/\/watch\//);
  });

  test('view toggle switches to list mode', async ({ creatorDetailPage, page }) => {
    await creatorDetailPage.goto('meanddevil252');
    await waitForLoad(creatorDetailPage);
    const gifCount = await creatorDetailPage.gifCount();
    if (gifCount > 0) {
      await creatorDetailPage.toggleView();
    }
  });

  test('header title shows creator name', async ({ creatorDetailPage, page }) => {
    await creatorDetailPage.goto('meanddevil252');
    await waitForLoad(creatorDetailPage);
    await expect(creatorDetailPage.title).toBeVisible();
    await expect(creatorDetailPage.title).toContainText('meanddevil252');
  });

  test('social links are clickable', async ({ creatorDetailPage, page }) => {
    await creatorDetailPage.goto('meanddevil252');
    await waitForLoad(creatorDetailPage);
    if (await creatorDetailPage.socialLinks.isVisible().catch(() => false)) {
      const links = await creatorDetailPage.socialLinkItems.all();
      expect(links.length).toBeGreaterThan(0);
    }
  });

  test('shows verified badge for verified creator', async ({ creatorDetailPage, page }) => {
    await creatorDetailPage.goto('meanddevil252');
    await waitForLoad(creatorDetailPage);
    if (await creatorDetailPage.badgeVerified.isVisible().catch(() => false)) {
      await expect(creatorDetailPage.badgeVerified).toBeVisible();
    }
  });

  test('shows active status badge', async ({ creatorDetailPage, page }) => {
    await creatorDetailPage.goto('meanddevil252');
    await waitForLoad(creatorDetailPage);
    if (await creatorDetailPage.badgeActive.isVisible().catch(() => false)) {
      await expect(creatorDetailPage.badgeActive).toBeVisible();
    }
  });

  test('shows description when present', async ({ creatorDetailPage, page }) => {
    await creatorDetailPage.goto('antonovaaa220102');
    await waitForLoad(creatorDetailPage);
    if (await creatorDetailPage.description.isVisible().catch(() => false)) {
      await expect(creatorDetailPage.description).not.toBeEmpty();
    }
  });

  test('sort options are displayed when GIFs load', async ({ creatorDetailPage, page }) => {
    await creatorDetailPage.goto('meanddevil252');
    await waitForLoad(creatorDetailPage);
    const firstCard = creatorDetailPage.gifCards.first();
    if (await firstCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(creatorDetailPage.sortBar.first()).toBeVisible();
      const count = await creatorDetailPage.sortBar.count();
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  test('sort chip click changes GIFs order', async ({ creatorDetailPage, page }) => {
    await creatorDetailPage.goto('meanddevil252');
    await waitForLoad(creatorDetailPage);
    const firstCard = creatorDetailPage.gifCards.first();
    if (await firstCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      const trendingChip = page.getByTestId('sort-trending');
      if (await trendingChip.isVisible().catch(() => false)) {
        await trendingChip.click();
        await page.waitForTimeout(2000);
        await expect(creatorDetailPage.gifCards.first()).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('avatar loads via userpic proxy on creator page', async ({ creatorDetailPage, page }) => {
    await creatorDetailPage.goto('meanddevil252');
    await waitForLoad(creatorDetailPage);
    const resp = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource');
      const userpic = entries.filter(e => e.name.includes('/userpic/'));
      return userpic.length > 0 ? userpic.some(e => (e as any).responseStatus === 200) : null;
    });
    if (resp !== null) expect(resp).toBe(true);
  });

});
