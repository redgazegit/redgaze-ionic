import { test as base, type Page } from '@playwright/test';
import { HomePage } from './pages/home/pages/home.page';
import { SearchPage } from './pages/search/pages/search.page';
import { WatchPage } from './pages/watch/pages/watch.page';
import { CreatorDetailPage } from './pages/creator-detail/pages/creator-detail.page';
import { NicheBrowsePage } from './pages/niche-browse/pages/niche-browse.page';
import { FavoritesPage } from './pages/favorites/pages/favorites.page';
import { SettingsPage } from './pages/settings/pages/settings.page';
import { StoriesPage } from './pages/stories/pages/stories.page';

type Pages = {
  homePage: HomePage;
  searchPage: SearchPage;
  watchPage: WatchPage;
  creatorDetailPage: CreatorDetailPage;
  nicheBrowsePage: NicheBrowsePage;
  favoritesPage: FavoritesPage;
  settingsPage: SettingsPage;
  storiesPage: StoriesPage;
};

export const test = base.extend<Pages>({
  homePage: async ({ page }, use) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    await use(homePage);
  },

  searchPage: async ({ page }, use) => {
    const searchPage = new SearchPage(page);
    await searchPage.goto();
    await use(searchPage);
  },

  watchPage: async ({ page }, use) => {
    const watchPage = new WatchPage(page);
    await use(watchPage);
  },

  creatorDetailPage: async ({ page }, use) => {
    const creatorDetailPage = new CreatorDetailPage(page);
    await use(creatorDetailPage);
  },

  nicheBrowsePage: async ({ page }, use) => {
    const nicheBrowsePage = new NicheBrowsePage(page);
    await use(nicheBrowsePage);
  },

  favoritesPage: async ({ page }, use) => {
    const favoritesPage = new FavoritesPage(page);
    await favoritesPage.goto();
    await use(favoritesPage);
  },

  settingsPage: async ({ page }, use) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await use(settingsPage);
  },

  storiesPage: async ({ page }, use) => {
    const storiesPage = new StoriesPage(page);
    await use(storiesPage);
  },
});

export { expect } from '@playwright/test';
