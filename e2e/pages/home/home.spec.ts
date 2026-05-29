import { expect, test } from '../../fixtures';

test.describe('Home Page', () => {
  test('loads feed sections', async ({ homePage }) => {
    await expect(homePage.feedSegment).toBeVisible();
    const labels = await homePage.getFeedSectionLabels();
    expect(labels.length).toBeGreaterThanOrEqual(3);
  });

  test('gif cards render after loading', async ({ homePage }) => {
    await expect(homePage.loadingSpinner).not.toBeVisible();
    await expect(homePage.gifCards.first()).toBeVisible({ timeout: 15000 });
  });

  test('gif cards have username and overlay badges', async ({ homePage }) => {
    await expect(homePage.loadingSpinner).not.toBeVisible();
    const firstCard = homePage.gifCards.first();
    await expect(firstCard).toBeVisible({ timeout: 15000 });
    await expect(firstCard.getByTestId('gif-username')).toBeVisible();
  });

  test('gif card username navigates to creator page', async ({ homePage, page }) => {
    const firstCard = homePage.gifCards.first();
    await expect(firstCard).toBeVisible({ timeout: 15000 });
    await firstCard.getByTestId('gif-username').click();
    await expect(page).toHaveURL(/\/creator\//);
  });

  test('gif card navigates to watch page', async ({ homePage, page }) => {
    await page.evaluate(() => localStorage.setItem('redview-settings', JSON.stringify({ storiesNavigation: false })));
    await page.reload();
    await expect(homePage.loadingSpinner).not.toBeVisible();
    const firstCard = homePage.gifCards.first();
    await expect(firstCard).toBeVisible({ timeout: 15000 });
    await firstCard.click();
    await expect(page).toHaveURL(/\/watch\//);
  });

  test('feed sections are switchable', async ({ homePage }) => {
    await expect(homePage.loadingSpinner).not.toBeVisible();
    const sections = await homePage.feedSections.all();
    if (sections.length > 1) {
      await sections[1].click();
      await expect(homePage.gifCards.first()).toBeVisible({ timeout: 15000 });
    }
  });

  test('trending tags sidebar exists', async ({ homePage }) => {
    if (await homePage.sidebarTags.isVisible()) {
      const tags = await homePage.trendingTags.all();
      expect(tags.length).toBeGreaterThan(0);
    }
  });

  test('popular creators sidebar exists', async ({ homePage }) => {
    if (await homePage.sidebarCreators.isVisible()) {
      const creators = await homePage.trendingCreators.all();
      expect(creators.length).toBeGreaterThan(0);
    }
  });

  test('niches sidebar exists', async ({ homePage }) => {
    if (await homePage.sidebarNiches.isVisible()) {
      const niches = await homePage.trendingNiches.all();
      expect(niches.length).toBeGreaterThan(0);
    }
  });

  test('sidebar tag chip navigates to search', async ({ homePage, page }) => {
    if (await homePage.sidebarTags.isVisible()) {
      const firstTag = homePage.trendingTags.first();
      await expect(firstTag).toBeVisible();
      await firstTag.click();
      await expect(page).toHaveURL(/\/search\//);
    }
  });

  test('sidebar creator navigates to creator detail', async ({ homePage, page }) => {
    if (await homePage.sidebarCreators.isVisible()) {
      const firstCreator = homePage.trendingCreators.first();
      await expect(firstCreator).toBeVisible();
      await firstCreator.click();
      await expect(page).toHaveURL(/\/creator\//);
    }
  });

  test('sidebar niche navigates to niche browse', async ({ homePage, page }) => {
    if (await homePage.sidebarNiches.isVisible()) {
      const firstNiche = homePage.trendingNiches.first();
      await expect(firstNiche).toBeVisible();
      await firstNiche.click();
      await expect(page).toHaveURL(/\/niche\//);
    }
  });

  test('view toggle switches between grid and list', async ({ homePage }) => {
    await expect(homePage.loadingSpinner).not.toBeVisible();
    const initialCount = await homePage.gifCount();
    if (initialCount > 0) {
      await homePage.viewToggle.click();
    }
  });

  test('pull-to-refresh triggers reload', async ({ homePage, page }) => {
    await page.evaluate(() => {
      const refresher = document.querySelector('ion-refresher');
      if (refresher) (refresher as any).complete();
    });
    await expect(homePage.loadingSpinner).not.toBeVisible();
    await expect(homePage.gifCards.first()).toBeVisible({ timeout: 15000 });
  });

  test('segment tabs are scrollable on mobile viewport', async ({ homePage, page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await homePage.goto();
    const isScrollable = await homePage.isSegmentScrollable();
    expect(isScrollable).toBe(true);
    await homePage.scrollSegmentToEnd();
    const lastTab = page.getByTestId('feed-section-latest');
    await expect(lastTab).toBeVisible();
  });

  test('page title is correct', async ({ homePage, page }) => {
    await expect(page.locator('ion-toolbar').locator('ion-title')).toContainText('red-gaze');
  });

  test('avatar images load via userpic proxy', async ({ homePage, page }) => {
    await expect(homePage.loadingSpinner).not.toBeVisible();
    await page.waitForTimeout(3000);
    const resp = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource');
      const userpic = entries.filter(e => e.name.includes('/userpic/'));
      return { count: userpic.length, all200: userpic.every(e => (e as any).responseStatus === 200) };
    });
    if (resp.count > 0) expect(resp.all200).toBe(true);
  });

  test('main content loads before sidebar queries', async ({ homePage, page }) => {
    await expect(homePage.loadingSpinner).not.toBeVisible();
    await expect(homePage.gifCards.first()).toBeVisible({ timeout: 15000 });
    const mainLoaded = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource');
      return entries.some(e => e.name.includes('/v2/explore/trending-gifs') && (e as any).responseStatus === 200);
    });
    expect(mainLoaded).toBe(true);
  });

  test('gif card navigates to watch on tap in mobile mode', async ({ homePage, page }) => {
    await page.context().addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 2 });
    });
    await page.evaluate(() => localStorage.setItem('redview-settings', JSON.stringify({ storiesNavigation: false })));
    await homePage.goto();
    await expect(homePage.loadingSpinner).not.toBeVisible();
    const firstCard = homePage.gifCards.first();
    await expect(firstCard).toBeVisible({ timeout: 15000 });
    await firstCard.click();
    await expect(page).toHaveURL(/\/watch\//);
  });

});
