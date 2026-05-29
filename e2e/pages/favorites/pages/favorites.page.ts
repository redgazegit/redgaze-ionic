import type { Locator, Page } from '@playwright/test';

export class FavoritesPage {
  readonly title: Locator = this.page.locator('ion-title');
  readonly viewToggle: Locator = this.page.getByTestId('fav-view-toggle');
  readonly emptyState: Locator = this.page.getByTestId('fav-empty');
  readonly browseGifsBtn: Locator = this.page.getByTestId('browse-gifs-btn');
  readonly gifCards: Locator = this.page.locator('[data-testid^="gif-card-"]');
  readonly videoPlayers: Locator = this.page.locator('[data-testid^="video-player-"]');

  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/favorites');
  }

  async toggleView() {
    await this.viewToggle.click();
  }

  async gifCount(): Promise<number> {
    return this.gifCards.count();
  }

  async isEmpty(): Promise<boolean> {
    return this.emptyState.isVisible();
  }
}
