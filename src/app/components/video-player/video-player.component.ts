import { Component, viewChild, ElementRef, OnDestroy, inject, signal, input, computed, effect, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import Plyr from 'plyr';
import { Capacitor, SystemBars } from '@capacitor/core';
import { Gif } from '../../models/gif.model';
import { FavoritesService } from '../../services/favorites.service';
import { RedgifsApiService } from '../../services/redgifs-api.service';
import { MediaProxyService } from '../../services/media-proxy.service';
import { SettingsService } from '../../services/settings.service';
import { VideoStateService } from '../../services/video-state.service';

import { IonButton, IonIcon } from '@ionic/angular/standalone';

@Component({
    selector: 'app-video-player',
    templateUrl: './video-player.component.html',
    styleUrls: ['./video-player.component.scss'],
    imports: [IonButton, IonIcon],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoPlayerComponent implements OnDestroy {
  favService = inject(FavoritesService);
  api = inject(RedgifsApiService);
  private mediaProxy = inject(MediaProxyService);
  private router = inject(Router);
  private settings = inject(SettingsService);


  readonly gif = input.required<Gif>();
  readonly storiesMode = input(false);
  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('videoPlayer');

  private player?: Plyr;
  private observer?: IntersectionObserver;
  private playTimer?: ReturnType<typeof setTimeout>;
  private videoState = inject(VideoStateService);
  private blobUrls: string[] = [];

  readonly videoSrc = signal('');
  readonly posterSrc = signal('');

  constructor() {
    effect(() => {
      const videoEl = this.videoRef()?.nativeElement;
      const gif = this.gif();
      if (!videoEl || !gif) return;

      const isStories = this.storiesMode();
      const prefHd = this.settings.get().quality === 'hd';
      const rawUrl = prefHd ? (gif.urls.hd || gif.urls.sd || '') : (gif.urls.sd || gif.urls.hd || '');
      const thumb = gif.urls.thumbnail || '';

      setTimeout(() => this.setMediaSources(rawUrl, thumb));

      if (isStories) {
        videoEl.play().catch(() => {});
        return;
      }

      if (this.player) return;

      this.player = new Plyr(videoEl, {
        controls: ['play', 'progress', 'current-time', 'mute', 'fullscreen'],
        resetOnEnd: true,
        hideControls: false,
        clickToPlay: true,
        iconUrl: '/assets/plyr/plyr.svg',
      });

      if (Capacitor.isNativePlatform()) {
        this.player.on('enterfullscreen', () => {
          console.log('[VP] Plyr enterfullscreen');
          SystemBars.hide().catch(() => {});
        });
        this.player.on('exitfullscreen', () => {
          console.log('[VP] Plyr exitfullscreen');
          SystemBars.show().catch(() => {});
        });
      }

      this.observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!this.player || document.fullscreenElement) return;
          clearTimeout(this.playTimer);
          if (!entry.isIntersecting) {
            this.videoState.onPause(this.gif().id);
            this.player.pause();
          } else {
            this.playTimer = setTimeout(() => {
              if (this.player && this.videoState.requestPlay(this.gif().id)) {
                this.player.play().catch(() => {});
              }
            }, 400);
          }
        });
      }, { threshold: 0.3 });
      this.observer.observe(videoEl);

      this.player.on('ready', () => {
        if (videoEl && this.isElementVisible(videoEl)) {
          this.player?.play().catch(() => {});
        }
      });
    });

    effect(() => {
      const activeId = this.videoState.activeGifId();
      if (activeId && activeId !== this.gif()?.id && this.player) {
        this.player.pause();
      }
    });
  }

  private setMediaSources(rawUrl: string, thumb: string): void {
    if (Capacitor.isNativePlatform()) {
      this.mediaProxy.proxyImage(thumb).then(url => this.posterSrc.set(url));
      this.mediaProxy.proxyVideoProgressive(rawUrl).then(url => {
        this.videoSrc.set(url);
        this.blobUrls.push(url);
      });
    } else {
      this.posterSrc.set(this.api.proxyUrl(thumb));
      this.videoSrc.set(this.api.proxyUrl(rawUrl));
    }
  }

  private isElementVisible(el: HTMLElement): boolean {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    return rect.top < vh * 0.8 && rect.bottom > 0;
  }

  ngOnDestroy(): void {
    clearTimeout(this.playTimer);
    this.observer?.disconnect();
    this.player?.destroy();
    this.videoState.onPause(this.gif()?.id || '');
    this.blobUrls.forEach(url => this.mediaProxy.abortProgressiveStream(url));
  }

  readonly isFav = computed(() => this.favService.isFavorite(this.gif()?.id || ''));

  toggleFav(): void {
    const g = this.gif();
    if (g) this.favService.toggle(g);
  }

  download(): void {
    const gif = this.gif();
    if (!gif) return;
    const prefHd = this.settings.get().quality === 'hd';
    const url = prefHd ? (gif.urls.hd || gif.urls.sd) : (gif.urls.sd || gif.urls.hd);
    const a = document.createElement('a');
    a.href = url || '';
    a.download = `${gif.id}.mp4`;
    a.click();
  }

  goToCreator(event: Event): void {
    event.stopPropagation();
    const gif = this.gif();
    if (gif?.userName) {
      this.router.navigate(['/creator', gif.userName]);
    }
  }
}
