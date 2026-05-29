import type { Locator, Page } from '@playwright/test';

export class SearchPage {
  readonly searchInput: Locator = this.page.getByTestId('search-input');
  readonly searchTypeSegment: Locator = this.page.getByTestId('search-type-segment');
  readonly searchTypeGifs: Locator = this.page.getByTestId('search-type-gifs');
  readonly searchTypeImages: Locator = this.page.getByTestId('search-type-images');
  readonly emptyState: Locator = this.page.getByTestId('search-empty');
  readonly suggestions: Locator = this.page.locator('[data-testid^="suggestion-"]');
  readonly relatedCreators: Locator = this.page.getByTestId('related-creators');
  readonly relatedTags: Locator = this.page.getByTestId('related-tags');
  readonly relatedCreatorItems: Locator = this.page.locator('[data-testid^="related-creator-"]');
  readonly relatedTagChips: Locator = this.page.locator('[data-testid^="related-tag-"]');
  readonly gifCards: Locator = this.page.locator('[data-testid^="gif-card-"]');
  readonly noResults: Locator = this.page.getByTestId('no-results');
  readonly loadingSpinner: Locator = this.page.locator('ion-spinner').first();

  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/search');
  }

  async search(query: string) {
    await this.page.goto(`/search/${encodeURIComponent(query)}`);
    await this.page.waitForTimeout(1000);
  }

  async clearSearch() {
    await this.page.getByRole('searchbox', { name: 'search text' }).press('Escape');
  }

  async selectSuggestion(text: string) {
    await this.page.getByTestId(`suggestion-${text}`).click();
  }

  async toggleSearchType(type: 'gifs' | 'images') {
    await this.page.getByTestId(`search-type-${type}`).click();
  }
}
