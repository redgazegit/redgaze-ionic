import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy } from '@angular/core';
import { RedgifsApiService } from './services/redgifs-api.service';
import { ThemeService } from './services/theme.service';
import { SettingsService } from './services/settings.service';
import { IonApp, IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular/standalone';
import { Capacitor, SystemBars } from '@capacitor/core';

@Component({
    selector: 'app-root',
    templateUrl: 'app.component.html',
    styleUrls: ['app.component.scss'],
    imports: [IonApp, IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  private api = inject(RedgifsApiService);
  private theme = inject(ThemeService);
  private settings = inject(SettingsService);

  private fsTimer?: ReturnType<typeof setInterval>;

  private applyStatusBar(hide: boolean): void {
    if (!Capacitor.isNativePlatform()) return;
    clearInterval(this.fsTimer);
    this.fsTimer = undefined;
    setTimeout(async () => {
      try {
        if (hide) {
          console.log('[FS] enter fullscreen - hiding system bars');
          await SystemBars.hide();
          console.log('[FS] system bars hidden, starting keep-alive interval');
          this.fsTimer = setInterval(() => {
            SystemBars.hide().catch(() => {});
          }, 500);
        } else {
          console.log('[FS] exit fullscreen - showing system bars');
          clearInterval(this.fsTimer);
          await SystemBars.show();
          console.log('[FS] system bars shown');
        }
      } catch (e) {
        console.error('[FS] error:', e);
      }
    }, 150);
  }

  private onFullscreenChange = (): void => {
    const el = document.fullscreenElement;
    console.log('[FS] fullscreenchange fired, element:', el?.tagName || null);
    this.applyStatusBar(!!el);
  };

  ngOnInit() {
    this.api.getAllTags().subscribe();
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', this.onFullscreenChange);
  }

  ngOnDestroy(): void {
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', this.onFullscreenChange);
  }
}
