import { Component, OnInit, viewChild, ElementRef, OnDestroy, signal, effect, inject, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { injectQuery, injectMutation } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import Plyr from 'plyr';
import Hls from 'hls.js';
import { CacheFragmentLoader } from '../../services/hls-cache-loader';
import { RedgifsApiService } from '../../services/redgifs-api.service';
import { FavoritesService } from '../../services/favorites.service';
import { SettingsService, QualityPref } from '../../services/settings.service';
import { VideoStateService } from '../../services/video-state.service';
import { Gif } from '../../models/gif.model';
import { IonicModule } from '@ionic/angular';
import { DatePipe } from '@angular/common';

@Component({
    selector: 'app-watch',
    templateUrl: './watch.page.html',
    styleUrls: ['./watch.page.scss'],
    imports: [
    IonicModule,
    DatePipe,
    RouterLink
],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WatchPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  api = inject(RedgifsApiService);
  favService = inject(FavoritesService);
  private settings = inject(SettingsService);
  private videoState = inject(VideoStateService);

  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('videoPlayer');

  private readonly id = signal('');
  quality: QualityPref = 'hd';
  usingHls = false;
  private player?: Plyr;
  private hls?: Hls;
  private playStart = 0;
  private blobUrls: string[] = [];

  readonly gifQuery = injectQuery(() => ({
    queryKey: ['gif', this.id()],
    queryFn: () => firstValueFrom(this.api.getGif(this.id())),
    enabled: this.id() !== '',
    staleTime: 1000 * 60 * 5,
  }));

  readonly trackViewMutation = injectMutation(() => ({
    mutationFn: (gifId: string) => firstValueFrom(this.api.trackContentViewed(gifId)),
  }));

  readonly trackDurationMutation = injectMutation(() => ({
    mutationFn: ({ gifId, duration }: { gifId: string; duration: number }) =>
      firstValueFrom(this.api.trackViewedDuration(gifId, duration)),
  }));

  get gif(): Gif | undefined { return this.gifQuery.data(); }
  get loading(): boolean { return this.gifQuery.isLoading(); }

  constructor() {
    const settings = this.settings;

    this.quality = settings.get().quality;
    effect(() => {
      if (this.gif && this.videoRef()?.nativeElement && !this.player) {
        this.initPlayer();
      }
    });
  }

  ngOnInit(): void {
    this.id.set(this.route.snapshot.paramMap.get('id') || '');
    if (this.id()) {
      this.trackViewMutation.mutate(this.id());
    }
  }

  get posterSrc(): string {
    return this.api.proxyUrl(this.gif?.urls.thumbnail || '');
  }

  get hasHd(): boolean {
    return !!this.gif?.urls.hd;
  }

  goToCreator(): void {
    if (this.gif?.userName) {
      this.router.navigate(['/creator', this.gif.userName]);
    }
  }

  toggleQuality(): void {
    this.quality = this.quality === 'hd' ? 'sd' : 'hd';
    if (this.usingHls) {
      this.initHls();
    } else {
      this.loadMp4();
    }
  }

  private loadMp4(): void {
    const video = this.videoRef()?.nativeElement;
    if (!video || !this.gif) return;
    const rawUrl = this.quality === 'hd' ? this.gif.urls.hd : this.gif.urls.sd;
    video.src = this.api.proxyUrl(rawUrl || '');
    this.api.cachedMediaUrl(rawUrl || '').then(cachedUrl => {
      if (cachedUrl !== video.src) {
        video.src = cachedUrl;
      }
    });
    const play = () => video.play().catch(() => {});
    video.readyState >= 2 ? play() : video.addEventListener('canplay', play, { once: true });
  }

  private async initHls(): Promise<void> {
    const video = this.videoRef()?.nativeElement;
    if (!video || !this.gif) return;

    this.hls?.destroy();
    this.hls = undefined;
    video.removeAttribute('src');

    try {
      const token = await this.api.ensureAuthToken();
      const resp = await fetch(this.api.hlsUrl(this.gif.id, this.quality), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      let m3u8 = await resp.text();
      m3u8 = m3u8.replace(/https:\/\/media\.redgifs\.com\//g, `${location.origin}/cdn/`);
      const blob = new Blob([m3u8], { type: 'application/vnd.apple.mpegurl' });
      const blobUrl = URL.createObjectURL(blob);
      this.blobUrls.push(blobUrl);

      this.hls = new Hls({ fLoader: CacheFragmentLoader as any });
      this.hls.loadSource(blobUrl);
      this.hls.attachMedia(video);
      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      this.hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          this.usingHls = false;
          this.loadMp4();
        }
      });
    } catch {
      this.usingHls = false;
      this.loadMp4();
    }
  }

  private async initPlayer(): Promise<void> {
    const video = this.videoRef()?.nativeElement;
    if (this.player || !video || !this.gif) return;
    const useHls = this.settings.get().playbackMode === 'hls' && this.gif.hls && Hls.isSupported();

    if (useHls) {
      this.usingHls = true;
      this.player = new Plyr(video, {
        controls: [
          'play-large', 'play', 'progress', 'current-time',
          'mute', 'volume', 'settings', 'pip', 'airplay', 'fullscreen'
        ],
        resetOnEnd: true,
        hideControls: true,
        clickToPlay: true,
      });
      this.player.on('ready', () => {
        this.setupTracking();
      });
      this.initHls();
      return;
    }

    const rawUrl = this.quality === 'hd' ? this.gif.urls.hd : this.gif.urls.sd;
    video.src = this.api.proxyUrl(rawUrl || '');
    this.player = new Plyr(video, {
      controls: [
        'play-large', 'play', 'progress', 'current-time',
        'mute', 'volume', 'settings', 'pip', 'airplay', 'fullscreen'
      ],
      resetOnEnd: true,
      hideControls: true,
      clickToPlay: true,
    });
    if (!video.hasAttribute('poster')) video.poster = this.posterSrc;

    this.setupTracking();
    this.api.cachedMediaUrl(rawUrl || '').then(cachedUrl => {
      if (cachedUrl !== video.src) {
        video.src = cachedUrl;
        const resume = () => video.play().catch(() => {});
        video.readyState >= 2 ? resume() : video.addEventListener('canplay', resume, { once: true });
      }
    });
    this.player.on('ready', () => {
      this.player?.play();
    });
  }

  private setupTracking(): void {
    this.player?.on('play', () => { this.playStart = Date.now(); });
    this.player?.on('pause', () => this.sendDuration());
    this.player?.on('ended', () => this.sendDuration());
  }

  private sendDuration(): void {
    if (!this.gif || this.playStart === 0) return;
    const elapsed = Date.now() - this.playStart;
    if (elapsed > 1000) {
      this.trackDurationMutation.mutate({ gifId: this.gif.id, duration: elapsed });
    }
    this.playStart = 0;
  }

  ngOnDestroy(): void {
    this.sendDuration();
    this.videoRef()?.nativeElement?.pause();
    this.videoState.onPause(this.gif?.id || '');
    this.hls?.destroy();
    this.player?.destroy();
    this.blobUrls.forEach(url => URL.revokeObjectURL(url));
  }

  download(): void {
    if (!this.gif) return;
    const url = this.quality === 'hd' ? this.gif.urls.hd : this.gif.urls.sd;
    const proxied = this.api.proxyUrl(url || '');
    const a = document.createElement('a');
    a.href = proxied;
    a.download = `${this.gif.id}.mp4`;
    a.click();
  }

  get isFav(): boolean {
    return this.gif ? this.favService.isFavorite(this.gif.id) : false;
  }

  toggleFav(): void {
    if (this.gif) this.favService.toggle(this.gif);
  }
}
