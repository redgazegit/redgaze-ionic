import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ThemeService, ThemeMode } from '../../services/theme.service';
import { SettingsService, PlaybackMode, QualityPref } from '../../services/settings.service';
import { IonicModule } from '@ionic/angular';

@Component({
    selector: 'app-settings',
    templateUrl: './settings.page.html',
    styleUrls: ['./settings.page.scss'],
    imports: [IonicModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  theme = inject(ThemeService);
  ss = inject(SettingsService);

  currentMode = signal<ThemeMode>('system');
  settings = this.ss.get();

  constructor() {
    this.theme.mode$.subscribe(m => this.currentMode.set(m));
    this.ss.settings$.subscribe(s => this.settings = s);
  }

  toggleDarkMode(): void {
    const next: ThemeMode = this.currentMode() === 'dark' ? 'light' : 'dark';
    this.theme.setMode(next);
    this.currentMode.set(next);
  }

  toggleHls(): void {
    const next: PlaybackMode = this.settings.playbackMode === 'hls' ? 'mp4' : 'hls';
    this.ss.update({ playbackMode: next });
    this.settings = this.ss.get();
  }

  toggleQuality(): void {
    const next: QualityPref = this.settings.quality === 'hd' ? 'sd' : 'hd';
    this.ss.update({ quality: next });
    this.settings = this.ss.get();
  }

  toggleRateLimit(): void {
    this.ss.update({ rateLimitEnabled: !this.settings.rateLimitEnabled });
    this.settings = this.ss.get();
  }

  toggleGridAutoplay(): void {
    this.ss.update({ gridAutoplay: !this.settings.gridAutoplay });
    this.settings = this.ss.get();
  }

  toggleStoriesNav(): void {
    this.ss.update({ storiesNavigation: !this.settings.storiesNavigation });
    this.settings = this.ss.get();
  }
}
