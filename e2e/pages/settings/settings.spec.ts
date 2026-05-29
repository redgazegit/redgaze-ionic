import { expect, test } from '../../fixtures';

test.describe('Settings Page', () => {
  test('all settings sections are visible', async ({ settingsPage }) => {
    await expect(settingsPage.darkModeItem).toBeVisible();
    await expect(settingsPage.hlsItem).toBeVisible();
    await expect(settingsPage.versionItem).toBeVisible();
    await expect(settingsPage.apiItem).toBeVisible();
  });

  test('version and API info are displayed', async ({ settingsPage }) => {
    await expect(settingsPage.versionItem).toContainText('1.0.0');
    await expect(settingsPage.apiItem).toContainText('v2');
  });

  test('dark mode toggle exists and is clickable', async ({ settingsPage }) => {
    await expect(settingsPage.darkModeToggle).toBeVisible();
    const initial = await settingsPage.isDarkMode();
    await settingsPage.toggleDarkMode();
    const after = await settingsPage.isDarkMode();
    expect(after).not.toBe(initial);
    await settingsPage.toggleDarkMode();
  });

  test('HLS toggle exists and is clickable', async ({ settingsPage }) => {
    await expect(settingsPage.hlsToggle).toBeVisible();
    const initial = await settingsPage.isHlsEnabled();
    await settingsPage.toggleHls();
    const after = await settingsPage.isHlsEnabled();
    expect(after).not.toBe(initial);
    await settingsPage.toggleHls();
  });

  test('dark mode toggles theme class on body', async ({ settingsPage, page }) => {
    await settingsPage.toggleDarkMode();
    const hasDark = await page.locator('body').evaluate(el => el.classList.contains('dark'));
    const hasPalette = await page.locator('html').evaluate(el => el.hasAttribute('ion-palette-dark'));
    expect(hasDark || hasPalette).toBe(true);
    await settingsPage.toggleDarkMode();
  });

  test('settings persist across navigation', async ({ settingsPage, page }) => {
    await settingsPage.toggleDarkMode();
    await page.goto('/home');
    await page.goto('/settings');
    const darkModeOn = await settingsPage.isDarkMode();
    expect(darkModeOn).toBe(true);
    await settingsPage.toggleDarkMode();
  });

  test('appearance section header is visible', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('Appearance')).toBeVisible();
  });

  test('playback section header is visible', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('Playback')).toBeVisible();
  });

  test('about section header is visible', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('About')).toBeVisible();
  });
});
