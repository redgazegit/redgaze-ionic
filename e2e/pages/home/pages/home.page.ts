import type { Locator, Page } from '@playwright/test';

export class HomePage {
  readonly gifCards: Locator = this.page.locator('[data-testid^="gif-card-"]');
  readonly viewToggle: Locator = this.page.getByTestId('home-view-toggle');
  readonly feedSegment: Locator = this.page.getByTestId('home-feed-segment');
  readonly feedSections: Locator = this.page.locator('[data-testid^="feed-section-"]');
  readonly sidebarTags: Locator = this.page.getByTestId('sidebar-tags');
  readonly sidebarCreators: Locator = this.page.getByTestId('sidebar-creators');
  readonly sidebarNiches: Locator = this.page.getByTestId('sidebar-niches');
  readonly trendingTags: Locator = this.page.locator('[data-testid^="trending-tag-"]');
  readonly trendingCreators: Locator = this.page.locator('[data-testid^="trending-creator-"]');
  readonly trendingNiches: Locator = this.page.locator('[data-testid^="trending-niche-"]');
  readonly loadingSpinner: Locator = this.page.locator('ion-spinner').first();
  readonly infiniteScroll: Locator = this.page.locator('ion-infinite-scroll');
  readonly refresher: Locator = this.page.locator('ion-refresher');

  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto('/home');
  }

  async clickFirstGif() {
    await this.gifCards.first().click();
  }

  async selectFeedSection(sectionId: string) {
    await this.page.getByTestId(`feed-section-${sectionId}`).click();
  }

  async scrollToBottom() {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }

  async getFeedSectionLabels(): Promise<string[]> {
    return this.feedSections.allTextContents();
  }

  async getGifCard(id: string): Promise<Locator> {
    return this.page.getByTestId(`gif-card-${id}`);
  }

  async gifCount(): Promise<number> {
    return this.gifCards.count();
  }

  async isSegmentScrollable(): Promise<boolean> {
    return this.page.evaluate(() => {
      const seg = document.querySelector('[data-testid="home-feed-segment"]');
      if (!seg) return false;
      return seg.scrollWidth > seg.clientWidth;
    });
  }

  async scrollSegmentToEnd(): Promise<void> {
    await this.page.evaluate(() => {
      const seg = document.querySelector('[data-testid="home-feed-segment"]');
      if (seg) seg.scrollLeft = seg.scrollWidth;
    });
  }
}
