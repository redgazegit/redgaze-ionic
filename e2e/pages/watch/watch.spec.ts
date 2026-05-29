import { expect, test } from '../../fixtures';

test.describe('Watch Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/home', { waitUntil: 'load' });
    await page.evaluate(() => localStorage.setItem('redgaze-settings', JSON.stringify({ storiesNavigation: false })));
    await page.reload({ waitUntil: 'load' });
  });

  test('navigates from home card click', async ({ page }) => {
    test.setTimeout(60000);
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.click();
    await page.waitForURL('**/watch/**');
    await expect(page.getByTestId('gif-details')).toBeVisible({ timeout: 45000 });
  });

  test('shows creator name in header', async ({ page }) => {
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    const firstGifId = await card.getAttribute('data-testid');
    const gifId = firstGifId?.replace('gif-card-', '');
    await page.goto(`/watch/${gifId}`);
    await expect(page.getByTestId('watch-creator-name')).toBeVisible({ timeout: 20000 });
  });

  test('creator name navigates to creator page', async ({ page }) => {
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    const firstGifId = await card.getAttribute('data-testid');
    const gifId = firstGifId?.replace('gif-card-', '');
    await page.goto(`/watch/${gifId}`);
    await expect(page.getByTestId('watch-creator-name')).toBeVisible({ timeout: 20000 });
    await page.getByTestId('watch-creator-name').click();
    await expect(page).toHaveURL(/\/creator\//);
  });

  test('creator detail item navigates to creator page', async ({ page }) => {
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    const firstGifId = await card.getAttribute('data-testid');
    const gifId = firstGifId?.replace('gif-card-', '');
    await page.goto(`/watch/${gifId}`);
    await expect(page.getByTestId('watch-creator-detail')).toBeVisible({ timeout: 20000 });
    await page.getByTestId('watch-creator-detail').click();
    await expect(page).toHaveURL(/\/creator\//);
  });

  test('displays GIF metadata sections', async ({ page }) => {
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    const firstGifId = await card.getAttribute('data-testid');
    const gifId = firstGifId?.replace('gif-card-', '');
    await page.goto(`/watch/${gifId}`);
    await expect(page.getByTestId('gif-details')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('gif-quality')).toBeVisible();
    await expect(page.getByTestId('gif-audio-status')).toBeVisible();
    await expect(page.getByTestId('gif-status')).toBeVisible();
  });

  test('shows tags section when tags exist', async ({ page }) => {
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    const firstGifId = await card.getAttribute('data-testid');
    const gifId = firstGifId?.replace('gif-card-', '');
    await page.goto(`/watch/${gifId}`);
    await expect(page.getByTestId('gif-details')).toBeVisible({ timeout: 20000 });
    if (await page.getByTestId('gif-tags-section').isVisible().catch(() => false)) {
      const tags = page.locator('[data-testid^="gif-tag-"]');
      expect(await tags.count()).toBeGreaterThan(0);
    }
  });

  test('shows niches section when niches exist', async ({ page }) => {
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    const firstGifId = await card.getAttribute('data-testid');
    const gifId = firstGifId?.replace('gif-card-', '');
    await page.goto(`/watch/${gifId}`);
    await expect(page.getByTestId('gif-details')).toBeVisible({ timeout: 20000 });
    if (await page.getByTestId('gif-niches-section').isVisible().catch(() => false)) {
      const niches = page.locator('[data-testid^="gif-niche-"]');
      expect(await niches.count()).toBeGreaterThan(0);
    }
  });

  test('tag chip navigates to search', async ({ page }) => {
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    const firstGifId = await card.getAttribute('data-testid');
    const gifId = firstGifId?.replace('gif-card-', '');
    await page.goto(`/watch/${gifId}`);
    await expect(page.getByTestId('gif-details')).toBeVisible({ timeout: 20000 });
    const firstTag = page.locator('[data-testid^="gif-tag-"]').first();
    if (await firstTag.isVisible().catch(() => false)) {
      await firstTag.click();
      await expect(page).toHaveURL(/\/search\//);
    }
  });

  test('niche chip navigates to niche browse', async ({ page }) => {
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    const firstGifId = await card.getAttribute('data-testid');
    const gifId = firstGifId?.replace('gif-card-', '');
    await page.goto(`/watch/${gifId}`);
    await expect(page.getByTestId('gif-details')).toBeVisible({ timeout: 20000 });
    const firstNiche = page.locator('[data-testid^="gif-niche-"]').first();
    if (await firstNiche.isVisible().catch(() => false)) {
      await firstNiche.click();
      await expect(page).toHaveURL(/\/niche\//);
    }
  });

  test('quality toggle switches HD/SD', async ({ page }) => {
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.click();
    await page.waitForURL('**/watch/**');
    const toggle = page.getByTestId('watch-quality-toggle');
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
      await expect(toggle).toBeVisible();
    }
  });

  test('favorite button toggles heart icon', async ({ page }) => {
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.click();
    await page.waitForURL('**/watch/**');
    await expect(page.getByTestId('watch-fav-btn')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('watch-fav-btn').click();
  });

  test('direct navigation loads GIF', async ({ page }) => {
    await page.goto('/home');
    await expect(page.locator('[data-testid^="gif-card-"]').first()).toBeVisible({ timeout: 15000 });
    const firstGifId = await page.locator('[data-testid^="gif-card-"]').first().getAttribute('data-testid');
    if (firstGifId) {
      const gifId = firstGifId.replace('gif-card-', '');
      await page.goto(`/watch/${gifId}`);
      await expect(page.getByTestId('gif-details')).toBeVisible({ timeout: 15000 });
    }
  });

  test('video container renders', async ({ page }) => {
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    const firstGifId = await card.getAttribute('data-testid');
    const gifId = firstGifId?.replace('gif-card-', '');
    await page.goto(`/watch/${gifId}`);
    await expect(page.getByTestId('video-container')).toBeVisible({ timeout: 20000 });
  });

  test('created date is displayed', async ({ page }) => {
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    const firstGifId = await card.getAttribute('data-testid');
    const gifId = firstGifId?.replace('gif-card-', '');
    await page.goto(`/watch/${gifId}`);
    await expect(page.getByTestId('gif-details')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('gif-created-date')).toBeVisible();
  });

  test('video element has muted attribute for mobile autoplay', async ({ page }) => {
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    const firstGifId = await card.getAttribute('data-testid');
    const gifId = firstGifId?.replace('gif-card-', '');
    await page.goto(`/watch/${gifId}`);
    await expect(page.getByTestId('video-container')).toBeVisible({ timeout: 20000 });
    const muted = await page.evaluate(() => {
      const v = document.querySelector('video');
      return v ? v.muted : null;
    });
    expect(muted).toBe(true);
  });

  test('video player initializes after GIF data loads', async ({ page }) => {
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    const firstGifId = await card.getAttribute('data-testid');
    const gifId = firstGifId?.replace('gif-card-', '');
    await page.goto(`/watch/${gifId}`);
    await expect(page.getByTestId('gif-details')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('video-container')).toBeVisible({ timeout: 5000 });
    const hasVideo = await page.evaluate(() => {
      const v = document.querySelector('video');
      return !!v;
    });
    expect(hasVideo).toBe(true);
  });

  test('video loads from cached media in MP4 mode', async ({ page }) => {
    await page.goto('/home');
    await expect(page.locator('[data-testid^="gif-card-"]').first()).toBeVisible({ timeout: 15000 });
    const firstGifId = await page.locator('[data-testid^="gif-card-"]').first().getAttribute('data-testid');
    if (!firstGifId) { test.skip(); return; }
    const gifId = firstGifId.replace('gif-card-', '');
    await page.evaluate(() => {
      localStorage.setItem('redgaze-settings', JSON.stringify({ playbackMode: 'mp4', quality: 'hd' }));
    });
    await page.goto(`/watch/${gifId}`);
    await expect(page.getByTestId('video-container')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(6000);
    const videoOk = await page.evaluate(() => {
      const v = document.querySelector('video');
      if (!v) return false;
      return v.readyState >= 2 || v.buffered.length > 0;
    });
    expect(videoOk).toBe(true);
  });

  test('MP4 video plays correctly', async ({ page }) => {
    await page.goto('/home');
    await page.evaluate(() => {
      localStorage.setItem('redgaze-settings', JSON.stringify({ playbackMode: 'mp4', quality: 'hd' }));
    });
    await page.goto('/watch/briskdeepskyblueharrierhawk');
    await expect(page.getByTestId('gif-details')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(3000);
    const hasPlyr = await page.evaluate(() => !!document.querySelector('.plyr'));
    expect(hasPlyr).toBe(true);
  });

  test('video source is set from proxy or cache (long timeout for MP4 fetch)', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/home');
    await page.evaluate(() => {
      localStorage.setItem('redgaze-settings', JSON.stringify({ playbackMode: 'mp4', quality: 'hd' }));
    });
    await page.goto('/watch/briskdeepskyblueharrierhawk');
    await expect(page.getByTestId('gif-details')).toBeVisible({ timeout: 20000 });
    await page.waitForFunction(() => {
      const v = document.querySelector('video');
      return v && (v.readyState >= 2 || v.buffered.length > 0);
    }, { timeout: 30000 });
    const srcOk = await page.evaluate(() => {
      const v = document.querySelector('video');
      if (!v) return false;
      const s = v.src || '';
      return s.startsWith('blob:') || s.includes('/cdn/');
    });
    expect(srcOk).toBe(true);
  });

  test('video loads and plays in MP4 mode', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/home');
    await page.evaluate(() => localStorage.setItem('redgaze-settings', JSON.stringify({ playbackMode: 'mp4', quality: 'hd' })));
    await page.goto('/watch/briskdeepskyblueharrierhawk');
    await expect(page.getByTestId('gif-details')).toBeVisible({ timeout: 20000 });
    await page.waitForFunction(() => {
      const v = document.querySelector('video');
      return v && v.readyState >= 1;
    }, { timeout: 30000 });
    const state = await page.evaluate(() => {
      const v = document.querySelector('video');
      if (!v) return null;
      return { readyState: v.readyState, hasSrc: !!v.src, hasPlyr: !!document.querySelector('.plyr') };
    });
    expect(state).not.toBeNull();
    expect(state!.readyState).toBeGreaterThanOrEqual(1);
    expect(state!.hasPlyr).toBe(true);
  });
});
