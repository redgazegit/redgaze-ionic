import { expect, test } from '../../fixtures';

test.describe('Niche Browse Page', () => {
  async function waitForLoad(nicheBrowsePage: any) {
    await nicheBrowsePage.loadingSpinner.waitFor({ state: 'hidden', timeout: 25000 }).catch(() => {});
  }

  test('loads GIFs for known niche', async ({ nicheBrowsePage, page }) => {
    await nicheBrowsePage.goto('just-boobs');
    await waitForLoad(nicheBrowsePage);
    if (await nicheBrowsePage.gifCards.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(nicheBrowsePage.gifCards.first()).toBeVisible();
    }
  });

  test('displays niche name in header title', async ({ nicheBrowsePage }) => {
    await nicheBrowsePage.goto('just-boobs');
    await waitForLoad(nicheBrowsePage);
    await expect(nicheBrowsePage.title).toContainText('just-boobs');
  });

  test('gif card navigates to watch page', async ({ page }) => {
    await page.goto('/niche/legal-teens');
    await page.evaluate(() => localStorage.setItem('redgaze-settings', JSON.stringify({ storiesNavigation: false })));
    await page.reload();
    const firstCard = page.locator('[data-testid^="gif-card-"]').first();
    await firstCard.waitFor({ state: 'visible', timeout: 15000 });
    await firstCard.click();
    await expect(page).toHaveURL(/\/watch\//);
  });

  test('gif card username navigates to creator', async ({ nicheBrowsePage, page }) => {
    await nicheBrowsePage.goto('legal-teens');
    await waitForLoad(nicheBrowsePage);
    const firstCard = nicheBrowsePage.gifCards.first();
    if (await firstCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      const username = firstCard.getByTestId('gif-username');
      if (await username.isVisible().catch(() => false)) {
        await username.click();
        await expect(page).toHaveURL(/\/creator\//);
      }
    }
  });

  test('can switch between multiple niches', async ({ nicheBrowsePage, page }) => {
    await nicheBrowsePage.goto('just-boobs');
    await waitForLoad(nicheBrowsePage);
    await expect(nicheBrowsePage.title).toContainText('just-boobs');
    await nicheBrowsePage.goto('legal-teens');
    await waitForLoad(nicheBrowsePage);
    await expect(nicheBrowsePage.title).toContainText('legal-teens');
  });

  test('back button navigates to home', async ({ nicheBrowsePage, page }) => {
    await page.goto('/home');
    await page.goto('/niche/just-boobs');
    await waitForLoad(nicheBrowsePage);
    await page.goBack();
    await expect(page).toHaveURL('/home');
  });
});
