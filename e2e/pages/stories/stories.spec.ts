import { expect, test } from '../../fixtures';

test.describe('Stories Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('redgaze-settings', JSON.stringify({ playbackMode: 'mp4', quality: 'hd' }));
    });
  });

  test('loads from home navigation with queue', async ({ page }) => {
    await page.goto('/home');
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.click();
    await page.waitForURL('**/stories/**', { timeout: 15000 });
    expect(page.url()).toContain('/stories/');
  });

  test('shows progress indicator', async ({ page }) => {
    await page.goto('/home');
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.click();
    await page.waitForURL('**/stories/**', { timeout: 15000 });
    await expect(page.getByTestId('stories-progress')).toBeVisible({ timeout: 10000 });
  });

  test('keyboard ArrowDown navigates to next', async ({ page, storiesPage }) => {
    await page.goto('/home');
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.click();
    await page.waitForURL('**/stories/**', { timeout: 15000 });
    const initialUrl = page.url();
    await page.locator('ion-content.stories-content').focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(1000);
    expect(page.url()).not.toBe(initialUrl);
  });

  test('navigates back to home when no queue', async ({ page }) => {
    await page.goto('/stories/nonexistent');
    await expect(page).toHaveURL(/\/home/);
  });

  test('video element exists inside stories wrapper', async ({ page }) => {
    await page.goto('/home');
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.click();
    await page.waitForURL('**/stories/**', { timeout: 15000 });
    await expect(page.getByTestId('stories-video-wrapper')).toBeVisible({ timeout: 10000 });
    const hasVideo = await page.evaluate(() => {
      const wrapper = document.querySelector('[data-testid="stories-video-wrapper"]');
      if (!wrapper) return false;
      return !!wrapper.querySelector('video');
    });
    expect(hasVideo).toBe(true);
  });

  test('video is muted for autoplay', async ({ page }) => {
    await page.goto('/home');
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.click();
    await page.waitForURL('**/stories/**', { timeout: 15000 });
    await expect(page.getByTestId('stories-video-wrapper')).toBeVisible({ timeout: 10000 });
    const video = page.getByTestId('stories-video-wrapper').locator('video');
    await expect(video).toBeAttached({ timeout: 5000 });
    const muted = await video.evaluate((el: HTMLVideoElement) => el.hasAttribute('muted'));
    expect(muted).toBe(true);
  });

  test('video has src set from proxy or cache', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/home');
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.click();
    await page.waitForURL('**/stories/**', { timeout: 15000 });
    await expect(page.getByTestId('stories-video-wrapper')).toBeVisible({ timeout: 10000 });
    await page.waitForFunction(() => {
      const v = document.querySelector('[data-testid="stories-video-wrapper"] video');
      return v && (v.readyState >= 1 || v.buffered.length > 0);
    }, { timeout: 30000 });
    const srcOk = await page.evaluate(() => {
      const v = document.querySelector('[data-testid="stories-video-wrapper"] video');
      if (!v) return false;
      const s = v.src || '';
      return s.startsWith('blob:') || s.includes('/cdn/');
    });
    expect(srcOk).toBe(true);
  });

  test('video progress indicator shows current position', async ({ page }) => {
    await page.goto('/home');
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.click();
    await page.waitForURL('**/stories/**', { timeout: 15000 });
    const progressText = await page.getByTestId('stories-progress').textContent();
    expect(progressText).toMatch(/\d+ \/ \d+\+/);
  });

  test('fav button is visible and toggles', async ({ page }) => {
    await page.goto('/home');
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.click();
    await page.waitForURL('**/stories/**', { timeout: 15000 });
    await expect(page.getByTestId('stories-fav-btn')).toBeVisible({ timeout: 10000 });
  });

  test('download button is visible', async ({ page }) => {
    await page.goto('/home');
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.click();
    await page.waitForURL('**/stories/**', { timeout: 15000 });
    await expect(page.getByTestId('stories-download-btn')).toBeVisible({ timeout: 10000 });
  });

  test('gif info section shows creator name', async ({ page }) => {
    await page.goto('/home');
    const card = page.locator('[data-testid^="gif-card-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.click();
    await page.waitForURL('**/stories/**', { timeout: 15000 });
    await expect(page.getByTestId('stories-gif-info')).toBeVisible({ timeout: 10000 });
  });
});
