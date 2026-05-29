import type { Locator, Page } from '@playwright/test';

export class SettingsPage {
  readonly darkModeItem: Locator = this.page.getByTestId('setting-dark-mode');
  readonly darkModeToggle: Locator = this.page.getByTestId('dark-mode-toggle');
  readonly hlsItem: Locator = this.page.getByTestId('setting-hls');
  readonly hlsToggle: Locator = this.page.getByTestId('hls-toggle');
  readonly versionItem: Locator = this.page.getByTestId('setting-version');
  readonly apiItem: Locator = this.page.getByTestId('setting-api');

  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/settings');
  }

  async toggleDarkMode() {
    await this.darkModeItem.click();
  }

  async toggleHls() {
    await this.hlsItem.click();
  }

  async isDarkMode(): Promise<boolean> {
    const checked = await this.page.locator('ion-toggle').first().evaluate(el => (el as any).checked);
    return checked;
  }

  async isHlsEnabled(): Promise<boolean> {
    const checked = await this.page.locator('ion-toggle').nth(1).evaluate(el => (el as any).checked);
    return checked;
  }
}
