import { expect, test } from '../../fixtures';

test.describe('Favorites Page', () => {
  test('shows empty state when no favorites', async ({ favoritesPage }) => {
    await expect(favoritesPage.emptyState).toBeVisible();
  });

  test('browse GIFs button navigates to home', async ({ favoritesPage, page }) => {
    await expect(favoritesPage.browseGifsBtn).toBeVisible();
    await favoritesPage.browseGifsBtn.click();
    await expect(page).toHaveURL('/home');
  });

  test('view toggle is always visible in header', async ({ favoritesPage }) => {
    await expect(favoritesPage.viewToggle).toBeVisible();
  });

  test('favorites page has correct title', async ({ favoritesPage }) => {
    await expect(favoritesPage.title).toContainText('Favorites');
  });
});
