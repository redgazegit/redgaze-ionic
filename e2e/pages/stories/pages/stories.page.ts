import type { Locator, Page } from '@playwright/test';

export class StoriesPage {
  readonly videoWrapper: Locator = this.page.getByTestId('stories-video-wrapper');
  readonly progressBar: Locator = this.page.getByTestId('stories-progress');
  readonly favBtn: Locator = this.page.getByTestId('stories-fav-btn');
  readonly downloadBtn: Locator = this.page.getByTestId('stories-download-btn');
  readonly gifInfo: Locator = this.page.getByTestId('stories-gif-info');

  constructor(readonly page: Page) {}

  async goto(gifId: string) {
    await this.page.goto(`/stories/${gifId}`);
  }

  async goNext(): Promise<void> {
    await this.page.keyboard.press('ArrowDown');
  }

  async goPrev(): Promise<void> {
    await this.page.keyboard.press('ArrowUp');
  }

  async swipeUp(): Promise<void> {
    const box = await this.videoWrapper.boundingBox();
    if (!box) return;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await this.page.mouse.move(cx, cy);
    await this.page.mouse.down();
    await this.page.mouse.move(cx, cy - 150, { steps: 10 });
    await this.page.mouse.up();
  }

  async swipeDown(): Promise<void> {
    const box = await this.videoWrapper.boundingBox();
    if (!box) return;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await this.page.mouse.move(cx, cy);
    await this.page.mouse.down();
    await this.page.mouse.move(cx, cy + 150, { steps: 10 });
    await this.page.mouse.up();
  }

  async getProgressText(): Promise<string> {
    return (await this.progressBar.textContent()) || '';
  }
}
