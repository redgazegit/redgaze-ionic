import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class VideoStateService {
  readonly activeGifId = signal<string | null>(null);

  requestPlay(gifId: string): boolean {
    const current = this.activeGifId();
    if (current === null || current === gifId) {
      this.activeGifId.set(gifId);
      return true;
    }
    return false;
  }

  onPause(gifId: string): void {
    if (this.activeGifId() === gifId) {
      this.activeGifId.set(null);
    }
  }
}
