import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class VideoStateService {
  private readonly _activeGifId = signal<string | null>(null);
  readonly activeGifId = this._activeGifId.asReadonly();

  requestPlay(gifId: string): boolean {
    const current = this._activeGifId();
    if (current === null || current === gifId) {
      this._activeGifId.set(gifId);
      return true;
    }
    return false;
  }

  onPause(gifId: string): void {
    if (this._activeGifId() === gifId) {
      this._activeGifId.set(null);
    }
  }
}
