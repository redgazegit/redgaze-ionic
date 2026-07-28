import { Component, viewChild, ElementRef, OnDestroy, inject, signal, input, output, computed, effect, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import Plyr from 'plyr';
import Hls from 'hls.js';
import { Capacitor } from '@capacitor/core';
import { SystemBars } from '@capacitor/core';
import { CacheFragmentLoader } from '../../services/hls-cache-loader';
import { Gif } from '../../models/gif.model';
import { FavoritesService } from '../../services/favorites.service';
import { RedgifsApiService } from '../../services/redgifs-api.service';
import { MediaProxyService } from '../../services/media-proxy.service';
import { SettingsService } from '../../services/settings.service';
import { VideoStateService } from '../../services/video-state.service';
import { IonButton, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { SkeletonCardComponent } from '../skeleton-card/skeleton-card.component';

export type PlayerMode = 'grid' | 'stories' | 'watch';

@Component({
    selector: 'app-video-player',
    templateUrl: './video-player.component.html',
    styleUrls: ['./video-player.component.scss'],
    imports: [IonButton, IonIcon, IonSpinner, SkeletonCardComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoPlayerComponent implements OnDestroy {
  private favService = inject(FavoritesService);
  private api = inject(RedgifsApiService);
  private mediaProxy = inject(MediaProxyService);
  private router = inject(Router);
  private settings = inject(SettingsService);
  private videoState = inject(VideoStateService);

  readonly gif = input.required<Gif>();
  readonly mode = input<PlayerMode>('grid');
  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('videoPlayer');

  private player?: Plyr;
  private hls?: Hls;
  private observer?: IntersectionObserver;
  private playTimer?: ReturnType<typeof setTimeout>;
  private blobUrls: string[] = [];
  protected readonly sourceAttached = signal(false);
  protected readonly sourceReady = signal(false);
  protected readonly posterLoading = signal(true);
  private sourceGeneration = 0;
  private lastGifId = '';
  private usingHls = false;
  private playStart = 0;
  private gridInitDone = false;
  private pendingPlyrInit = false;

  readonly preloadStrategy = signal<'none' | 'metadata' | 'auto'>('none');
  readonly videoSrc = signal('');
  readonly posterSrc = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly isFav = computed(() => this.favService.isFavorite(this.gif()?.id || ''));
  readonly hasHd = computed(() => !!this.gif()?.urls.hd);
  readonly durationElapsed = output<{gifId: string; duration: number}>();
  readonly quality = computed(() => this.settings.get().quality);
  readonly playbackMode = computed(() => this.settings.get().playbackMode);

  constructor() {
    effect(() => {
      const gif = this.gif();
      const mode = this.mode();
      if (mode === 'grid') {
        const thumb = gif?.urls?.thumbnail;
        if (thumb) {
          this.posterLoading.set(true);
          this.posterSrc.set(thumb);
        }
      }
    });

    effect(() => {
      const videoEl = this.videoRef()?.nativeElement;
      const gif = this.gif();
      const mode = this.mode();
      if (!videoEl || !gif) return;

      if (mode !== 'grid' && this.sourceAttached() && gif.id !== this.lastGifId) {
        this.teardownPlayback();
      }
      this.lastGifId = gif.id;

      if (mode === 'stories') {
        this.loading.set(true);
        this.error.set(null);
        this.startStoriesPlayback(gif, videoEl);
        return;
      }

      if (mode === 'watch') {
        if (this.player) return;
        this.loading.set(true);
        this.error.set(null);
        this.initWatchPlayer(gif, videoEl);
        return;
      }

      if (this.gridInitDone) return;
      this.gridInitDone = true;
      this.initGridPlayer(videoEl);
    });

    effect(() => {
      const activeId = this.videoState.activeGifId();
      if (activeId && activeId !== this.gif()?.id) {
        this.player?.pause();
      }
    });
  }

  private async startStoriesPlayback(gif: Gif, videoEl: HTMLVideoElement): Promise<void> {
    const useHls = this.playbackMode() === 'hls' && !!gif.hls && Hls.isSupported();
    if (useHls) {
      this.usingHls = true;
      await this.initHls(gif, videoEl);
      if (gif.id === this.lastGifId) {
        this.loading.set(false);
      }
    } else {
      try {
        this.sourceAttached.set(true);
        this.preloadStrategy.set('metadata');
        await this.applySource(gif, videoEl);
        if (gif.id === this.lastGifId) {
          this.loading.set(false);
          videoEl.play().catch(() => {});
        }
      } catch {
        if (gif.id === this.lastGifId) {
          this.loading.set(false);
          this.error.set('Failed to load video');
        }
      }
    }
  }

  private async initWatchPlayer(gif: Gif, videoEl: HTMLVideoElement): Promise<void> {
    const useHls = this.playbackMode() === 'hls' && !!gif.hls && Hls.isSupported();

    if (useHls) {
      this.usingHls = true;
      this.player = new Plyr(videoEl, {
        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'pip', 'airplay', 'fullscreen'],
        resetOnEnd: true,
        hideControls: true,
        clickToPlay: true,
        iconUrl: '/assets/plyr/plyr.svg',
      });
      this.wirePlyrFsEvents();
      this.player.on('ready', () => {
        this.setupTracking();
        this.loading.set(false);
      });
      await this.initHls(gif, videoEl);
      return;
    }

    try {
      this.sourceAttached.set(true);
      this.preloadStrategy.set('auto');
      await this.applySource(gif, videoEl);
      this.player = new Plyr(videoEl, {
        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'pip', 'airplay', 'fullscreen'],
        resetOnEnd: true,
        hideControls: true,
        clickToPlay: true,
        iconUrl: '/assets/plyr/plyr.svg',
      });
      this.wirePlyrFsEvents();
      if (!videoEl.hasAttribute('poster')) videoEl.poster = this.posterSrc();
      this.setupTracking();
      this.player.on('ready', () => {
        this.player?.play();
        this.loading.set(false);
      });
    } catch {
      this.loading.set(false);
      this.error.set('Failed to load video');
    }
  }

  private createPlyr(videoEl: HTMLVideoElement): void {
    this.player = new Plyr(videoEl, {
      controls: ['play', 'progress', 'current-time', 'mute', 'fullscreen'],
      resetOnEnd: true,
      hideControls: false,
      clickToPlay: true,
      iconUrl: '/assets/plyr/plyr.svg',
    });

    if (Capacitor.isNativePlatform()) {
      this.player.on('enterfullscreen', () => {
        SystemBars.hide().catch(() => {});
      });
      this.player.on('exitfullscreen', () => {
        SystemBars.show().catch(() => {});
      });
    }

    this.player.on('ready', () => {
      if (this.sourceAttached() && videoEl && this.isElementVisible(videoEl)) {
        if (this.videoState.requestPlay(this.gif().id)) {
          this.player?.play().catch(() => {});
        }
      }
    });
  }

  private initGridPlayer(videoEl: HTMLVideoElement): void {
    this.observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (document.fullscreenElement) return;

        if (!this.player) {
          if (!entry.isIntersecting || this.pendingPlyrInit) return;
          this.pendingPlyrInit = true;
          this.ensureSource().then(() => {
            if (!this.player) this.createPlyr(videoEl);
            this.pendingPlyrInit = false;
          });
          return;
        }

        clearTimeout(this.playTimer);
        if (entry.intersectionRatio >= 0.3) {
          this.ensureSource().then(() => {
            this.playTimer = setTimeout(() => {
              if (this.player && this.videoState.requestPlay(this.gif().id)) {
                this.player!.play().catch(() => {});
              }
            }, 400);
          });
        } else if (entry.isIntersecting) {
          this.ensureSource();
          this.videoState.onPause(this.gif().id);
          this.player.pause();
        } else {
          this.videoState.onPause(this.gif().id);
          this.player.pause();
          this.releaseSource();
        }
      });
    }, { rootMargin: '400px 0px', threshold: [0, 0.3] });
    this.observer.observe(videoEl);

    const rect = videoEl.getBoundingClientRect();
    const inPreload = rect.top < window.innerHeight + 400 && rect.bottom > -400;
    if (inPreload) {
      this.ensureSource().then(() => {
        if (!this.player) this.createPlyr(videoEl);
      });
    }
  }

  private async ensureSource(): Promise<void> {
    if (this.sourceAttached()) return;
    this.sourceAttached.set(true);
    this.sourceReady.set(false);
    this.preloadStrategy.set('metadata');
    const gif = this.gif();
    if (!gif) { this.sourceAttached.set(false); return; }
    const rawUrl = this.pickUrl(gif);
    if (!rawUrl) { this.sourceAttached.set(false); throw new Error('No video URL'); }
    const thumb = gif.urls.thumbnail || '';
    const gen = this.sourceGeneration;
    await this.setMediaSources(rawUrl, thumb, gen);
    if (gen === this.sourceGeneration) {
      this.sourceReady.set(true);
    }
  }

  private async applySource(gif: Gif, videoEl: HTMLVideoElement): Promise<void> {
    const rawUrl = this.pickUrl(gif);
    if (!rawUrl) throw new Error('No video URL');
    const thumb = gif.urls.thumbnail || '';
    await this.setMediaSources(rawUrl, thumb, this.sourceGeneration);
  }

  private async setMediaSources(rawUrl: string, thumb: string, gen: number): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      const posterUrl = await this.mediaProxy.proxyImage(thumb);
      if (this.sourceAttached() && gen === this.sourceGeneration) this.posterSrc.set(posterUrl);
      const videoUrl = await this.mediaProxy.proxyVideoProgressive(rawUrl);
      if (this.sourceAttached() && gen === this.sourceGeneration) {
        this.videoSrc.set(videoUrl);
        this.blobUrls.push(videoUrl);
      }
    } else {
      this.posterSrc.set(this.api.proxyUrl(thumb));
      this.videoSrc.set(this.api.proxyUrl(rawUrl));
    }
  }

  private pickUrl(gif: Gif): string {
    const prefHd = this.quality() === 'hd';
    return prefHd ? (gif.urls.hd || gif.urls.sd || '') : (gif.urls.sd || gif.urls.hd || '');
  }

  private async initHls(gif: Gif, videoEl: HTMLVideoElement): Promise<void> {
    this.hls?.destroy();
    this.hls = undefined;
    videoEl.removeAttribute('src');

    try {
      const token = await this.api.ensureAuthToken();
      const blobUrl = await this.mediaProxy.proxyM3u8(
        this.api.hlsUrl(gif.id, this.quality()),
        token
      );
      this.blobUrls.push(blobUrl);

      this.hls = new Hls({ fLoader: CacheFragmentLoader as any });
      this.hls.loadSource(blobUrl);
      this.hls.attachMedia(videoEl);
      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (this.mode() === 'grid') return;
        if (gif.id === this.lastGifId) {
          videoEl.play().catch(() => {});
        }
      });
      this.hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          this.usingHls = false;
          this.hls?.destroy();
          this.hls = undefined;
          if (this.mode() !== 'grid') {
            this.startStoriesPlayback(gif, videoEl).catch(() => {});
          }
        }
      });
    } catch {
      this.usingHls = false;
      if (this.mode() !== 'grid') {
        await this.startStoriesPlayback(gif, videoEl);
      }
    }
  }

  private releaseSource(): void {
    if (!this.sourceAttached()) return;
    this.sourceAttached.set(false);
    this.sourceReady.set(false);
    this.sourceGeneration++;
    this.preloadStrategy.set('none');
    this.videoSrc.set('');
    const urls = this.blobUrls;
    this.blobUrls = [];
    urls.forEach(url => this.mediaProxy.abortProgressiveStream(url));
  }

  private teardownPlayback(): void {
    this.videoState.onPause(this.lastGifId);
    this.hls?.destroy();
    this.hls = undefined;
    this.usingHls = false;
    this.releaseSource();
  }

  private isElementVisible(el: HTMLElement): boolean {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    return rect.top < vh * 0.8 && rect.bottom > 0;
  }

  private wirePlyrFsEvents(): void {
    if (!Capacitor.isNativePlatform() || !this.player) return;
    this.player.on('enterfullscreen', () => {
      SystemBars.hide().catch(() => {});
    });
    this.player.on('exitfullscreen', () => {
      SystemBars.show().catch(() => {});
    });
  }

  private setupTracking(): void {
    this.player?.on('play', () => { this.playStart = Date.now(); });
    this.player?.on('pause', () => this.sendDuration());
    this.player?.on('ended', () => this.sendDuration());
  }

  private sendDuration(): void {
    if (this.playStart === 0) return;
    const elapsed = Date.now() - this.playStart;
    this.playStart = 0;
    if (elapsed > 1000) {
      this.durationElapsed.emit({ gifId: this.gif()?.id || '', duration: elapsed });
    }
  }

  toggleQuality(): void {
    if (this.mode() !== 'watch') return;
    const next = this.quality() === 'hd' ? 'sd' : 'hd';
    this.settings.update({ quality: next });
    if (this.usingHls) {
      const gif = this.gif();
      const videoEl = this.videoRef()?.nativeElement;
      if (gif && videoEl) this.initHls(gif, videoEl);
    } else {
      this.loadMp4();
    }
  }

  private async loadMp4(): Promise<void> {
    const gif = this.gif();
    const videoEl = this.videoRef()?.nativeElement;
    if (!gif || !videoEl) return;
    this.teardownPlayback();
    this.loading.set(true);
    this.error.set(null);
    try {
      this.sourceAttached.set(true);
      this.preloadStrategy.set('auto');
      await this.applySource(gif, videoEl);
      this.loading.set(false);
      videoEl.play().catch(() => {});
    } catch {
      this.loading.set(false);
      this.error.set('Failed to load video');
    }
  }

  retry(): void {
    const gif = this.gif();
    if (!gif) return;
    this.teardownPlayback();
    this.lastGifId = '';
    this.sourceAttached.set(false);
    this.error.set(null);
    const videoEl = this.videoRef()?.nativeElement;
    if (!videoEl) return;
    if (this.mode() === 'stories') {
      this.startStoriesPlayback(gif, videoEl);
    } else {
      this.loading.set(true);
      this.ensureSource()
        .then(() => {
          this.loading.set(false);
          videoEl.play().catch(() => {});
        })
        .catch(() => {
          this.loading.set(false);
          this.error.set('Failed to load video');
        });
    }
  }

  toggleFav(): void {
    const g = this.gif();
    if (g) this.favService.toggle(g);
  }

  download(): void {
    const gif = this.gif();
    if (!gif) return;
    const url = this.pickUrl(gif);
    const a = document.createElement('a');
    a.href = url || '';
    a.download = `${gif.id}.mp4`;
    a.click();
  }

  goToCreator(event?: Event): void {
    event?.stopPropagation();
    const gif = this.gif();
    if (gif?.userName) {
      this.router.navigate(['/creator', gif.userName]);
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.playTimer);
    this.observer?.disconnect();
    this.player?.destroy();
    this.hls?.destroy();
    this.videoState.onPause(this.gif()?.id || '');
    this.releaseSource();
  }
}
