import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type PlaybackMode = 'hls' | 'mp4';
export type QualityPref = 'hd' | 'sd';

export interface AppSettings {
  playbackMode: PlaybackMode;
  quality: QualityPref;
  rateLimitEnabled: boolean;
  storiesNavigation: boolean;
  gridAutoplay: boolean;
}

const STORAGE_KEY = 'redgaze-settings';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private defaults: AppSettings = { playbackMode: 'mp4', quality: 'hd', rateLimitEnabled: true, storiesNavigation: true, gridAutoplay: true };
  private subject = new BehaviorSubject<AppSettings>(this.load());

  settings$: Observable<AppSettings> = this.subject.asObservable();

  get(): AppSettings {
    return this.subject.value;
  }

  update(partial: Partial<AppSettings>): void {
    const next = { ...this.get(), ...partial };
    this.subject.next(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  private load(): AppSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...this.defaults, ...JSON.parse(raw) } : { ...this.defaults };
    } catch {
      return { ...this.defaults };
    }
  }
}
