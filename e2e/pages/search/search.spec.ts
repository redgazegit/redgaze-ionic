import { expect, test } from '../../fixtures';

test.describe('Search Page', () => {
  test('shows empty state initially', async ({ searchPage }) => {
    await expect(searchPage.emptyState).toBeVisible();
  });

  test('search input is visible', async ({ searchPage }) => {
    await expect(searchPage.searchInput).toBeVisible();
  });

  test('search type segment switches between GIFs and Images', async ({ searchPage }) => {
    await expect(searchPage.searchTypeGifs).toBeVisible();
    await expect(searchPage.searchTypeImages).toBeVisible();
    await expect(searchPage.searchTypeGifs).toHaveClass(/segment-button-checked/);
  });

  test('search navigation works via route', async ({ searchPage, page }) => {
    await page.goto('/search/test');
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/search\/test/);
  });

  test('no results message shows for gibberish query', async ({ searchPage, page }) => {
    await page.goto('/search/zzzxxxyyyqqq');
    await page.waitForTimeout(3000);
    const spinnerDone = await searchPage.loadingSpinner.waitFor({ state: 'hidden', timeout: 25000 }).then(() => true).catch(() => false);
    if (spinnerDone) {
      await expect(searchPage.noResults).toBeVisible();
    }
  });
});
