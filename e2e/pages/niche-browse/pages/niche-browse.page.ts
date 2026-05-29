import type { Locator, Page } from '@playwright/test';

export class NicheBrowsePage {
  readonly title: Locator = this.page.getByTestId('niche-title');
  readonly backButton: Locator = this.page.getByRole('button', { name: 'back' });
  readonly gifCards: Locator = this.page.locator('[data-testid^="gif-card-"]');
  readonly loadingSpinner: Locator = this.page.locator('ion-spinner').first();
  readonly infiniteScroll: Locator = this.page.locator('ion-infinite-scroll');

  constructor(private readonly page: Page) {}

  async goto(nicheId: string) {
    await this.page.goto(`/niche/${nicheId}`);
  }

  async gifCount(): Promise<number> {
    return this.gifCards.count();
  }
}
