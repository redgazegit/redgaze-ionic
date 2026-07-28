import { Component, OnInit, OnDestroy, DestroyRef, inject, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { RedgifsApiService } from './services/redgifs-api.service';
import { ThemeService } from './services/theme.service';
import { SettingsService } from './services/settings.service';
import { IonApp, IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular/standalone';
import { Capacitor, SystemBars } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { fromEvent, merge, interval } from 'rxjs';
import { filter, map, distinctUntilChanged, switchMap, takeUntil, tap } from 'rxjs/operators';

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
  private location = inject(Location);
  private destroyRef = inject(DestroyRef);
  private backHandler?: Promise<PluginListenerHandle>;

  ngOnInit() {
    this.theme.setMode('system')
    this.api.getAllTags().subscribe();

    this.backHandler = App.addListener('backButton', () => {
      const path = this.location.path();
      console.log('[Back] hardware back pressed, current path:', path);
      if (path !== '/home') {
        console.log('[Back] navigating back');
        this.location.back();
      } else {
        console.log('[Back] at /home, doing nothing');
      }
    });

    const fs$ = merge(
      fromEvent(document, 'fullscreenchange'),
      fromEvent(document, 'webkitfullscreenchange'),
    ).pipe(
      map(() => document.fullscreenElement),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    );

    fs$.pipe(
      filter(el => !!el && Capacitor.isNativePlatform()),
      tap(() => { console.log('[FS] entering fullscreen, hiding bars'); SystemBars.hide().then(() => console.log('[FS] initial hide ok')).catch(e => console.error('[FS] initial hide error:', e)); }),
      switchMap(() => merge(
        fromEvent(document, 'touchstart'),
        interval(4000),
      ).pipe(
        takeUntil(fs$.pipe(filter(el => !el))),
      )),
    ).subscribe(() => {
      console.log('[FS] re-hiding bars (tap or poll)');
      SystemBars.hide()
        .then(() => console.log('[FS] re-hide resolved ok'))
        .catch(e => console.error('[FS] re-hide error:', e));
    });

    fs$.pipe(
      filter(el => !el && Capacitor.isNativePlatform()),
    ).subscribe(() => {
      console.log('[FS] exiting fullscreen, showing bars');
      SystemBars.show()
        .then(() => console.log('[FS] show ok'))
        .catch(e => console.error('[FS] show error:', e));
    });
  }

  ngOnDestroy(): void {
    this.backHandler?.then(h => h.remove());
  }
}
