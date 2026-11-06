import { Component, viewChild, ElementRef, OnDestroy, inject, signal, input, computed, effect, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import Plyr from 'plyr';
import Hls from 'hls.js';
import { Capacitor, SystemBars } from '@capacitor/core';
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
  private preloadObserver?: IntersectionObserver;
  private playObserver?: IntersectionObserver;
  private playTimer?: ReturnType<typeof setTimeout>;
  private blobUrls: string[] = [];

  private sourceAttached = false;
  protected readonly sourceReady = signal(false);
  protected readonly posterLoading = signal(true);
  private sourceGeneration = 0;
  private sourceGifId: string | null = null;
  private lastGifId = '';
  private inPlayZone = false;
  private playRetries = 0;
  private usingHls = false;
  private gridInitDone = false;

  readonly preloadStrategy = signal<'none' | 'metadata' | 'auto'>('none');
  readonly videoSrc = signal('');
  readonly posterSrc = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly isFav = computed(() => this.favService.isFavorite(this.gif()?.id || ''));
  readonly hasHd = computed(() => !!this.gif()?.urls.hd);
  readonly quality = computed(() => this.settings.get().quality);
  readonly playbackMode = computed(() => this.settings.get().playbackMode);

  constructor() {
    effect(() => {
      const gif = this.gif();
      if (this.mode() !== 'grid') return;
      const thumb = gif?.urls?.thumbnail;
      if (thumb) {
        this.posterLoading.set(true);
        this.posterSrc.set(thumb);
      }
    });

    effect(() => {
      const videoEl = this.videoRef()?.nativeElement;
      const gif = this.gif();
      const mode = this.mode();
      if (!videoEl || !gif) return;

      if (mode !== 'grid' && gif.id !== this.lastGifId && this.sourceAttached) {
        this.teardownPlayback();
      }
      this.lastGifId = gif.id;

      if (mode === 'stories') {
        if (this.sourceGifId !== gif.id) {
          this.releaseSource();
          this.sourceGifId = gif.id;
        }
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
      if (this.mode() !== 'stories' || !this.sourceReady()) return;
      const videoEl = this.videoRef()?.nativeElement;
      const src = this.videoSrc();
      if (!videoEl || !src) return;
      videoEl.muted = true;
      queueMicrotask(() => {
        if (videoEl.isConnected) videoEl.play().catch(() => {});
      });
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
      return;
    }

    try {
      this.preloadStrategy.set('metadata');
      await this.ensureSource();
      if (gif.id === this.lastGifId) {
        this.loading.set(false);
      }
    } catch {
      if (gif.id === this.lastGifId) {
        this.loading.set(false);
        this.error.set('Failed to load video');
      }
    }
  }

  private async initWatchPlayer(gif: Gif, videoEl: HTMLVideoElement): Promise<void> {
    const useHls = this.playbackMode() === 'hls' && !!gif.hls && Hls.isSupported();

    if (useHls) {
      this.usingHls = true;
      this.createWatchPlyr(videoEl);
      this.player!.on('ready', () => {
        this.loading.set(false);
      });
      await this.initHls(gif, videoEl);
      return;
    }

    try {
      this.preloadStrategy.set('auto');
      await this.applySource(gif, videoEl);
      this.createWatchPlyr(videoEl);
      if (!videoEl.hasAttribute('poster')) videoEl.poster = this.posterSrc();
      this.player!.on('ready', () => {
        this.player?.play();
        this.loading.set(false);
      });
    } catch {
      this.loading.set(false);
      this.error.set('Failed to load video');
    }
  }

  private createWatchPlyr(videoEl: HTMLVideoElement): void {
    this.player = new Plyr(videoEl, {
      controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'pip', 'airplay', 'fullscreen'],
      resetOnEnd: true,
      hideControls: true,
      clickToPlay: true,
      iconUrl: '/assets/plyr/plyr.svg',
    });
    this.wirePlyrFsEvents();
  }

  private createPlyr(videoEl: HTMLVideoElement): void {
    this.player = new Plyr(videoEl, {
      controls: ['play', 'progress', 'current-time', 'mute', 'fullscreen'],
      resetOnEnd: true,
      hideControls: false,
      clickToPlay: true,
      iconUrl: '/assets/plyr/plyr.svg',
    });

    this.wirePlyrFsEvents();

    this.player.on('ready', () => {
      if (this.sourceAttached && videoEl && this.isElementVisible(videoEl)) {
        if (this.videoState.requestPlay(this.gif().id)) {
          this.player?.play().catch(() => {});
        }
      }
    });
  }

  private initGridPlayer(videoEl: HTMLVideoElement): void {
    this.preloadObserver?.disconnect();
    this.playObserver?.disconnect();

    this.preloadObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.ensureSource()
            .then(() => { if (!this.player) this.createPlyr(videoEl); })
            .catch(() => {});
          return;
        }

        clearTimeout(this.playTimer);
        this.inPlayZone = false;
        this.videoState.onPause(this.gif().id);
        this.player?.pause();
        this.releaseSource();
      });
    }, { rootMargin: '400px 0px', threshold: 0 });
    this.preloadObserver.observe(videoEl);

    this.playObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!this.player || document.fullscreenElement) return;

        if (entry.isIntersecting) {
          this.ensureSource()
            .then(() => {
              this.inPlayZone = true;
              this.playRetries = 0;
              this.schedulePlay();
            })
            .catch(() => {});
        } else {
          this.inPlayZone = false;
          clearTimeout(this.playTimer);
          this.videoState.onPause(this.gif().id);
          this.player?.pause();
        }
      });
    }, { rootMargin: '-15% 0px -15% 0px', threshold: [0, 0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1] });
    this.playObserver.observe(videoEl);
  }

  private schedulePlay(): void {
    clearTimeout(this.playTimer);
    this.playTimer = setTimeout(() => {
      if (!this.inPlayZone || !this.player) return;
      if (this.videoState.requestPlay(this.gif().id)) {
        this.playRetries = 0;
        this.player.play().catch(() => {});
      } else if (this.playRetries++ < 10) {
        this.schedulePlay();
      }
    }, 400);
  }

  private async ensureSource(): Promise<void> {
    if (this.sourceAttached) return;
    this.sourceAttached = true;
    this.sourceReady.set(false);
    this.preloadStrategy.set('metadata');
    const gif = this.gif();
    if (!gif) { this.sourceAttached = false; return; }
    const rawUrl = this.pickUrl(gif);
    if (!rawUrl) { this.sourceAttached = false; throw new Error('No video URL'); }
    this.sourceGifId = gif.id;
    const thumb = gif.urls.thumbnail || '';
    const gen = this.sourceGeneration;
    await this.setMediaSources(rawUrl, thumb, gen);
    if (gen === this.sourceGeneration) {
      this.sourceReady.set(true);
    }
  }

  private async applySource(gif: Gif, videoEl: HTMLVideoElement): Promise<void> {
    this.sourceAttached = true;
    this.sourceReady.set(false);
    const rawUrl = this.pickUrl(gif);
    if (!rawUrl) throw new Error('No video URL');
    const thumb = gif.urls.thumbnail || '';
    await this.setMediaSources(rawUrl, thumb, this.sourceGeneration);
    this.sourceReady.set(true);
  }

  private async setMediaSources(rawUrl: string, thumb: string, gen: number): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      const posterUrl = await this.mediaProxy.proxyImage(thumb);
      if (this.sourceAttached && gen === this.sourceGeneration) this.posterSrc.set(posterUrl);
      const videoUrl = await this.mediaProxy.proxyVideoProgressive(rawUrl);
      if (this.sourceAttached && gen === this.sourceGeneration) {
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
        if (!data.fatal) return;
        this.usingHls = false;
        this.hls?.destroy();
        this.hls = undefined;
        if (this.mode() === 'stories') {
          this.startStoriesPlayback(gif, videoEl).catch(() => {});
        } else if (this.mode() === 'watch') {
          this.loadMp4();
        }
      });
    } catch {
      this.usingHls = false;
      if (this.mode() === 'stories') {
        await this.startStoriesPlayback(gif, videoEl);
      } else if (this.mode() === 'watch') {
        await this.loadMp4();
      }
    }
  }

  private releaseSource(): void {
    if (!this.sourceAttached) return;
    this.sourceAttached = false;
    this.sourceReady.set(false);
    this.sourceGeneration++;
    this.preloadStrategy.set('none');
    this.videoSrc.set('');
    this.posterSrc.set('');
    const videoEl = this.videoRef()?.nativeElement;
    if (videoEl) {
      videoEl.pause?.();
      videoEl.removeAttribute('src');
      if (typeof videoEl.load === 'function') videoEl.load();
    }
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
    this.sourceAttached = false;
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
    this.inPlayZone = false;
    this.preloadObserver?.disconnect();
    this.playObserver?.disconnect();
    this.player?.destroy();
    this.hls?.destroy();
    this.videoState.onPause(this.gif()?.id || '');
    this.releaseSource();
  }
}

