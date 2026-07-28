import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { VideoPlayerComponent } from './video-player.component';
import { FavoritesService } from '../../services/favorites.service';
import { RedgifsApiService } from '../../services/redgifs-api.service';
import { SettingsService } from '../../services/settings.service';
import { VideoStateService } from '../../services/video-state.service';
import { MediaProxyService } from '../../services/media-proxy.service';
import { MockFavoritesService, MockRedgifsApiService, MockSettingsService, MockVideoStateService } from '../../testing/service-mocks';
import { fakeGif } from '../../testing/test-utils';

vi.mock('plyr', () => ({
  default: class {
    cbs: Record<string, Function[]> = {};
    on = vi.fn(function(this: any, event: string, cb: Function) {
      if (!this.cbs) this.cbs = {};
      if (!this.cbs[event]) this.cbs[event] = [];
      this.cbs[event].push(cb);
      if (event === 'ready') setTimeout(cb, 0);
      return this;
    });
    play = vi.fn().mockResolvedValue(undefined);
    pause = vi.fn();
    destroy = vi.fn();
  },
}));

const MockHls = vi.hoisted(function () {
  const cl = vi.fn().mockImplementation(function () {
    return {
      loadSource: vi.fn(function () {}),
      attachMedia: vi.fn(function () {}),
      on: vi.fn(function () {}),
      destroy: vi.fn(function () {}),
    };
  });
  (cl as any).isSupported = vi.fn().mockReturnValue(true);
  (cl as any).Events = { MANIFEST_PARSED: 'hlsManifestParsed', ERROR: 'hlsError' };
  return { default: cl };
});
vi.mock('hls.js', () => MockHls);

let observerCallback: IntersectionObserverCallback | null;
class MockObserver {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = cb;
    this.options = options;
    observerCallback = cb;
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
    this.takeRecords = vi.fn(() => []);
  }
}
vi.stubGlobal('IntersectionObserver', MockObserver as any);

const mockProxyVideoProgressive = vi.fn(function (url: string) { return Promise.resolve(url); });
const mockProxyM3u8 = vi.fn(function (url: string, _token: string) { return Promise.resolve('blob:mock-m3u8'); });
const mockProxyImage = vi.fn(function (url: string) { return Promise.resolve(url); });
const mockAbortProgressiveStream = vi.fn(function () {});

describe('VideoPlayerComponent', () => {
  let mockFav: MockFavoritesService;
  let mockApi: MockRedgifsApiService;
  let mockSettings: MockSettingsService;
  let mockVideoState: MockVideoStateService;

  beforeEach(async () => {
    mockFav = new MockFavoritesService();
    mockApi = new MockRedgifsApiService();
    mockSettings = new MockSettingsService();
    mockVideoState = new MockVideoStateService();

    await TestBed.configureTestingModule({
      imports: [VideoPlayerComponent],
      providers: [
        provideRouter([]),
        { provide: FavoritesService, useValue: mockFav },
        { provide: RedgifsApiService, useValue: mockApi },
        { provide: SettingsService, useValue: mockSettings },
        { provide: VideoStateService, useValue: mockVideoState },
        { provide: MediaProxyService, useValue: {
          proxyImage: mockProxyImage,
          proxyVideoProgressive: mockProxyVideoProgressive,
          proxyM3u8: mockProxyM3u8,
          abortProgressiveStream: mockAbortProgressiveStream,
        }},
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  afterAll(() => { vi.unstubAllGlobals(); });

  function createComponent(gif = fakeGif(), mode: 'grid' | 'stories' | 'watch' = 'grid') {
    const fixture = TestBed.createComponent(VideoPlayerComponent);
    fixture.componentRef.setInput('gif', gif);
    fixture.componentRef.setInput('mode', mode);
    return fixture;
  }

  describe('grid mode', () => {
    it('should create', () => {
      expect(createComponent().componentInstance).toBeTruthy();
    });

    it('should set videoSrc and posterSrc when entering preload zone', async () => {
      mockSettings.setSettings({ playbackMode: 'mp4', quality: 'hd', rateLimitEnabled: true, storiesNavigation: true, gridAutoplay: true });
      const gif = fakeGif({ urls: { ...fakeGif({}).urls, thumbnail: 'https://media.redgifs.com/thumb.jpg', sd: 'https://media.redgifs.com/test.mp4', hd: 'https://media.redgifs.com/test-hd.mp4' }});
      const fixture = createComponent(gif);
      fixture.detectChanges();
      observerCallback!([{ isIntersecting: true, intersectionRatio: 0 } as IntersectionObserverEntry], null! as any);
      await new Promise(r => setTimeout(r));
      expect(fixture.componentInstance.posterSrc()).toBe('/cdn/thumb.jpg');
      expect(fixture.componentInstance.videoSrc()).toBe('/cdn/test-hd.mp4');
    });

    it('should use sd url when quality=sd when entering preload zone', async () => {
      mockSettings.setSettings({ playbackMode: 'mp4', quality: 'sd', rateLimitEnabled: true, storiesNavigation: true, gridAutoplay: true });
      const gif = fakeGif({ urls: { ...fakeGif({}).urls, sd: 'https://media.redgifs.com/sd.mp4', hd: 'https://media.redgifs.com/hd.mp4' }});
      const fixture = createComponent(gif);
      fixture.detectChanges();
      observerCallback!([{ isIntersecting: true, intersectionRatio: 0 } as IntersectionObserverEntry], null! as any);
      await new Promise(r => setTimeout(r));
      expect(fixture.componentInstance.videoSrc()).toBe('/cdn/sd.mp4');
    });

    it('should reflect isFav', () => {
      vi.spyOn(mockFav, 'isFavorite').mockReturnValue(true);
      expect(createComponent().componentInstance.isFav()).toBe(true);
    });

    it('should toggle favorite', () => {
      const gif = fakeGif({ id: 'fav-toggle' });
      vi.spyOn(mockFav, 'toggle');
      createComponent(gif).componentInstance.toggleFav();
      expect(mockFav.toggle).toHaveBeenCalledWith(gif);
    });

    it('should navigate to creator', () => {
      const gif = fakeGif({ userName: 'vid-creator', id: 'nav-test' });
      const page = createComponent(gif).componentInstance;
      const routerSpy = vi.fn();
      (page as any).router = { navigate: routerSpy };
      page.goToCreator(new MouseEvent('click'));
      expect(routerSpy).toHaveBeenCalledWith(['/creator', 'vid-creator']);
    });

    it('should create Plyr in grid mode', () => {
      const fixture = createComponent();
      fixture.detectChanges();
      expect((fixture.componentInstance as any).player).toBeTruthy();
    });

    it('should pause when not intersecting', () => {
      const fixture = createComponent();
      fixture.detectChanges();
      vi.spyOn(mockVideoState, 'onPause');
      observerCallback!([{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry], null! as any);
      expect((fixture.componentInstance as any).player.pause).toHaveBeenCalled();
    });

    it('should play after 400ms when intersecting and allowed', () => {
      vi.useFakeTimers();
      const fixture = createComponent();
      fixture.detectChanges();
      vi.spyOn(mockVideoState, 'requestPlay').mockReturnValue(true);
      observerCallback!([{ isIntersecting: true, intersectionRatio: 0.5 } as IntersectionObserverEntry], null! as any);
      vi.advanceTimersByTime(400);
      expect((fixture.componentInstance as any).player.play).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should NOT set videoSrc on init (deferred)', () => {
      const fixture = createComponent();
      fixture.detectChanges();
      expect(fixture.componentInstance.videoSrc()).toBe('');
    });

    it('should set videoSrc when entering preload zone', async () => {
      const fixture = createComponent();
      fixture.detectChanges();
      observerCallback!([{ isIntersecting: true, intersectionRatio: 0 } as IntersectionObserverEntry], null! as any);
      await new Promise(r => setTimeout(r));
      expect(fixture.componentInstance.videoSrc()).toBeTruthy();
    });
  });

  describe('stories mode', () => {
    it('should NOT create Plyr', () => {
      const fixture = createComponent(fakeGif(), 'stories');
      fixture.detectChanges();
      expect((fixture.componentInstance as any).player).toBeUndefined();
    });

    it('should set videoSrc and posterSrc', async () => {
      mockSettings.setSettings({ playbackMode: 'mp4', quality: 'hd', rateLimitEnabled: true, storiesNavigation: true, gridAutoplay: true });
      const gif = fakeGif({ urls: { ...fakeGif({}).urls, thumbnail: 'https://media.redgifs.com/thumb.jpg', sd: 'https://media.redgifs.com/sd.mp4', hd: 'https://media.redgifs.com/hd.mp4' }});
      const fixture = createComponent(gif, 'stories');
      fixture.detectChanges();
      await new Promise(r => setTimeout(r));
      expect(fixture.componentInstance.posterSrc()).toBe('/cdn/thumb.jpg');
      expect(fixture.componentInstance.videoSrc()).toBe('/cdn/hd.mp4');
    });

    it('should release and re-attach when gif changes', async () => {
      const gif1 = fakeGif({ id: 'story-1', urls: { ...fakeGif({}).urls, hd: 'https://media.redgifs.com/story1.mp4' }});
      const gif2 = fakeGif({ id: 'story-2', urls: { ...fakeGif({}).urls, hd: 'https://media.redgifs.com/story2.mp4' }});
      mockSettings.setSettings({ playbackMode: 'mp4', quality: 'hd', rateLimitEnabled: true, storiesNavigation: true, gridAutoplay: true });
      const fixture = createComponent(gif1, 'stories');
      fixture.detectChanges();
      await new Promise(r => setTimeout(r));
      expect(fixture.componentInstance.videoSrc()).toBe('/cdn/story1.mp4');
      fixture.componentRef.setInput('gif', gif2);
      fixture.detectChanges();
      await new Promise(r => setTimeout(r));
      expect(fixture.componentInstance.videoSrc()).toBe('/cdn/story2.mp4');
    });

    it('should set loading=true then false after source resolves', async () => {
      const gif = fakeGif({ id: 'loading-test' });
      const fixture = createComponent(gif, 'stories');
      fixture.detectChanges();
      expect(fixture.componentInstance.loading()).toBe(true);
      await new Promise(r => setTimeout(r));
      expect(fixture.componentInstance.loading()).toBe(false);
    });

    it('should call play after source attached', async () => {
      const gif = fakeGif({ id: 'story-play' });
      const fixture = createComponent(gif, 'stories');
      const videoEl = (fixture.componentInstance as any).videoRef()?.nativeElement;
      vi.spyOn(videoEl, 'play').mockResolvedValue(undefined);
      fixture.detectChanges();
      await new Promise(r => setTimeout(r));
      expect(videoEl.play).toHaveBeenCalled();
    });

    it('should show error when no video URL', async () => {
      const gif = fakeGif({ id: 'no-url', urls: { ...fakeGif({}).urls, hd: '', sd: '' }});
      const fixture = createComponent(gif, 'stories');
      fixture.detectChanges();
      await new Promise(r => setTimeout(r));
      expect(fixture.componentInstance.error()).toBeTruthy();
    });
  });

  describe('watch mode', () => {
    it('should create Plyr', async () => {
      const fixture = createComponent(fakeGif(), 'watch');
      fixture.detectChanges();
      await new Promise(r => setTimeout(r));
      expect((fixture.componentInstance as any).player).toBeTruthy();
    });

    it('should set loading then false', async () => {
      const fixture = createComponent(fakeGif(), 'watch');
      fixture.detectChanges();
      expect(fixture.componentInstance.loading()).toBe(true);
      await new Promise(r => setTimeout(r));
      expect(fixture.componentInstance.loading()).toBe(false);
    });

    it('should use HLS when playbackMode=hls and gif has hls', () => {
      mockSettings.setSettings({ playbackMode: 'hls', quality: 'hd', rateLimitEnabled: true, storiesNavigation: true, gridAutoplay: true });
      const gif = fakeGif({ id: 'hls-watch', hls: true });
      const fixture = createComponent(gif, 'watch');
      fixture.detectChanges();
      expect((fixture.componentInstance as any).usingHls).toBe(true);
    });

    it('should toggle quality and reload', async () => {
      vi.spyOn(mockSettings, 'update');
      const gif = fakeGif({ id: 'q-toggle', urls: { ...fakeGif({}).urls, hd: 'https://media.redgifs.com/hd.mp4', sd: 'https://media.redgifs.com/sd.mp4' }});
      const fixture = createComponent(gif, 'watch');
      fixture.detectChanges();
      await new Promise(r => setTimeout(r));
      (fixture.componentInstance as any).usingHls = false;
      vi.spyOn(fixture.componentInstance as any, 'loadMp4');
      fixture.componentInstance.toggleQuality();
      expect(mockSettings.update).toHaveBeenCalledWith({ quality: 'sd' });
    });

    it('should show error state and allow retry', async () => {
      const gif = fakeGif({ id: 'watch-error', urls: { hd: '', sd: '', thumbnail: '', poster: '' } });
      const fixture = createComponent(gif, 'watch');
      fixture.detectChanges();
      await new Promise(r => setTimeout(r));
      expect(fixture.componentInstance.error()).toBeTruthy();
      const recovered = fakeGif({ id: 'watch-recovered' });
      fixture.componentRef.setInput('gif', recovered);
      fixture.componentInstance.retry();
      await new Promise(r => setTimeout(r));
      expect(fixture.componentInstance.error()).toBeNull();
    });
  });

  it('should clean up on destroy', () => {
    const fixture = createComponent();
    fixture.detectChanges();
    const page = fixture.componentInstance as any;
    page.blobUrls = ['blob:http://test1'];
    vi.spyOn(URL, 'revokeObjectURL');
    fixture.destroy();
    expect(page.player.destroy).toHaveBeenCalled();
  });
});
