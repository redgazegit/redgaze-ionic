import type { Locator, Page } from '@playwright/test';

export class WatchPage {
  readonly backButton: Locator = this.page.getByRole('button', { name: 'back' });
  readonly creatorName: Locator = this.page.getByTestId('watch-creator-name');
  readonly qualityToggle: Locator = this.page.getByTestId('watch-quality-toggle');
  readonly favButton: Locator = this.page.getByTestId('watch-fav-btn');
  readonly downloadButton: Locator = this.page.getByTestId('watch-download-btn');
  readonly videoContainer: Locator = this.page.getByTestId('video-container');
  readonly gifDetails: Locator = this.page.getByTestId('gif-details');
  readonly creatorDetail: Locator = this.page.getByTestId('watch-creator-detail');
  readonly creatorDetailName: Locator = this.page.getByTestId('watch-creator-detail-name');
  readonly createdDate: Locator = this.page.getByTestId('gif-created-date');
  readonly tagsSection: Locator = this.page.getByTestId('gif-tags-section');
  readonly tags: Locator = this.page.locator('[data-testid^="gif-tag-"]');
  readonly qualityItem: Locator = this.page.getByTestId('gif-quality');
  readonly audioItem: Locator = this.page.getByTestId('gif-audio-status');
  readonly resolutionItem: Locator = this.page.getByTestId('gif-resolution');
  readonly contentSection: Locator = this.page.getByTestId('gif-content-section');
  readonly nichesSection: Locator = this.page.getByTestId('gif-niches-section');
  readonly niches: Locator = this.page.locator('[data-testid^="gif-niche-"]');
  readonly statusItem: Locator = this.page.getByTestId('gif-status');
  readonly loadingSpinner: Locator = this.page.locator('ion-spinner').first();

  constructor(private readonly page: Page) {}

  async goto(id: string) {
    await this.page.goto(`/watch/${id}`);
  }

  async goToCreator() {
    await this.creatorDetail.click();
  }

  async toggleQuality() {
    await this.qualityToggle.click();
  }

  async toggleFavorite() {
    await this.favButton.click();
  }

  async getTagNames(): Promise<string[]> {
    return this.tags.allTextContents();
  }

  async getNicheNames(): Promise<string[]> {
    return this.niches.allTextContents();
  }
}
