import type { Locator, Page } from '@playwright/test';

export class CreatorDetailPage {
  readonly title: Locator = this.page.getByTestId('creator-title');
  readonly viewToggle: Locator = this.page.getByTestId('creator-view-toggle');
  readonly avatar: Locator = this.page.getByTestId('creator-avatar');
  readonly avatarImg: Locator = this.page.getByTestId('creator-avatar-img');
  readonly name: Locator = this.page.getByTestId('creator-name');
  readonly description: Locator = this.page.getByTestId('creator-desc');
  readonly stats: Locator = this.page.getByTestId('creator-stats');
  readonly statGifs: Locator = this.page.getByTestId('stat-gifs');
  readonly statFollowers: Locator = this.page.getByTestId('stat-followers');
  readonly statViews: Locator = this.page.getByTestId('stat-views');
  readonly statLikes: Locator = this.page.getByTestId('stat-likes');
  readonly statFollowing: Locator = this.page.getByTestId('stat-following');
  readonly createdInfo: Locator = this.page.getByTestId('creator-created');
  readonly joinDate: Locator = this.page.getByTestId('creator-join-date');
  readonly badgeVerified: Locator = this.page.getByTestId('badge-verified');
  readonly badgeAgeVerified: Locator = this.page.getByTestId('badge-age-verified');
  readonly badgeKyc: Locator = this.page.getByTestId('badge-kyc');
  readonly badgeActive: Locator = this.page.getByTestId('badge-active');
  readonly socialLinks: Locator = this.page.getByTestId('social-links');
  readonly socialLinkItems: Locator = this.page.locator('[data-testid^="social-link-"]');
  readonly gifCards: Locator = this.page.locator('[data-testid^="gif-card-"]');
  readonly loadingSpinner: Locator = this.page.locator('ion-spinner').first();
  readonly infiniteScroll: Locator = this.page.locator('ion-infinite-scroll');
  readonly sortBar: Locator = this.page.locator('[data-testid^="sort-"]');

  constructor(private readonly page: Page) {}

  async goto(username: string) {
    await this.page.goto(`/creator/${username}`);
  }

  async toggleView() {
    await this.viewToggle.click();
  }

  async gifCount(): Promise<number> {
    return this.gifCards.count();
  }
}
