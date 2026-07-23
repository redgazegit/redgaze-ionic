import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { VideoPlayerComponent } from './video-player.component';
import { FavoritesService } from '../../services/favorites.service';
import { RedgifsApiService } from '../../services/redgifs-api.service';
import { SettingsService } from '../../services/settings.service';
import { VideoStateService } from '../../services/video-state.service';
import { MockFavoritesService, MockRedgifsApiService, MockSettingsService, MockVideoStateService } from '../../testing/service-mocks';
import { fakeGif } from '../../testing/test-utils';

vi.mock('plyr', () => ({
  default: class {
    on = vi.fn().mockReturnThis();
    play = vi.fn().mockResolvedValue(undefined);
    pause = vi.fn();
    destroy = vi.fn();
  },
}));

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
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  function createComponent(gif = fakeGif(), storiesMode = false) {
    const fixture = TestBed.createComponent(VideoPlayerComponent);
    fixture.componentRef.setInput('gif', gif);
    fixture.componentRef.setInput('storiesMode', storiesMode);
    return fixture;
  }

  it('should create', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should set videoSrc and posterSrc from gif input', () => {
    const gif = fakeGif({
      urls: {
        ...fakeGif({}).urls,
        thumbnail: 'https://media.redgifs.com/thumb.jpg',
        sd: 'https://media.redgifs.com/test.mp4',
        hd: 'https://media.redgifs.com/test-hd.mp4',
      }
    });
    mockSettings.setSettings({ playbackMode: 'mp4', quality: 'hd', rateLimitEnabled: true, storiesNavigation: true, gridAutoplay: true });

    const fixture = createComponent(gif);
    fixture.detectChanges();

    expect(fixture.componentInstance.posterSrc()).toBe('/cdn/thumb.jpg');
    expect(fixture.componentInstance.videoSrc()).toBe('/cdn/test-hd.mp4');
  });

  it('should use sd url when quality=sd', () => {
    const gif = fakeGif({
      urls: {
        ...fakeGif({}).urls,
        sd: 'https://media.redgifs.com/sd.mp4',
        hd: 'https://media.redgifs.com/hd.mp4',
      }
    });
    mockSettings.setSettings({ playbackMode: 'mp4', quality: 'sd', rateLimitEnabled: true, storiesNavigation: true, gridAutoplay: true });
    const fixture = createComponent(gif);
    fixture.detectChanges();
    expect(fixture.componentInstance.videoSrc()).toBe('/cdn/sd.mp4');
  });

  it('should reflect isFav from favorites service', () => {
    const gif = fakeGif({ id: 'video-fav-check' });
    vi.spyOn(mockFav, 'isFavorite').mockReturnValue(true);
    const fixture = createComponent(gif);
    expect(fixture.componentInstance.isFav).toBe(true);
  });

  it('should toggle favorite', () => {
    const gif = fakeGif({ id: 'video-fav-toggle' });
    vi.spyOn(mockFav, 'toggle');
    const fixture = createComponent(gif);
    fixture.componentInstance.toggleFav();
    expect(mockFav.toggle).toHaveBeenCalledWith(gif);
  });

  it('should navigate to creator on goToCreator', () => {
    const gif = fakeGif({ userName: 'vid-creator', id: 'nav-test' });
    const fixture = createComponent(gif);
    const routerSpy = vi.fn();
    (fixture.componentInstance as any).router = { navigate: routerSpy };
    fixture.componentInstance.goToCreator(new MouseEvent('click'));
    expect(routerSpy).toHaveBeenCalledWith(['/creator', 'vid-creator']);
  });

  describe('download', () => {
    let origCreateElement: any;

    afterEach(() => {
      if (origCreateElement) document.createElement = origCreateElement;
    });

    it('should create anchor and click', () => {
      const gif = fakeGif({
        id: 'dl-test', urls: { hd: 'https://media.redgifs.com/dl.mp4', sd: '' },
      });
      const fixture = createComponent(gif);
      fixture.componentRef.setInput('gif', gif);
      const anchor = { href: '', download: '', click: vi.fn() };
      origCreateElement = document.createElement;
      document.createElement = vi.fn().mockReturnValue(anchor as any);
      fixture.componentInstance.download();
      expect(anchor.href).toBe('/cdn/dl.mp4');
      expect(anchor.download).toBe('dl-test.mp4');
      expect(anchor.click).toHaveBeenCalledOnce();
    });

    it('should do nothing when gif is undefined', () => {
      const fixture = createComponent();
      fixture.componentRef.setInput('gif', undefined as any);
      expect(() => fixture.componentInstance.download()).not.toThrow();
    });
  });

  describe('ngOnDestroy', () => {
    it('should clean up player, observer, timer, and blob URLs', () => {
      const fixture = createComponent();
      fixture.detectChanges();
      const page = fixture.componentInstance as any;
      page.blobUrls = ['blob:http://test1', 'blob:http://test2'];
      const timer = setTimeout(() => {}, 10000);
      page.playTimer = timer;

      vi.spyOn(globalThis, 'clearTimeout');
      vi.spyOn(URL, 'revokeObjectURL');
      vi.spyOn(mockVideoState, 'onPause');

      fixture.destroy();

      expect(globalThis.clearTimeout).toHaveBeenCalledWith(timer);
      expect(page.player.destroy).toHaveBeenCalled();
      expect(mockVideoState.onPause).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    });
  });

  describe('isElementVisible (private)', () => {
    it('should return true when element is in viewport', () => {
      const page = createComponent().componentInstance as any;
      const el = { getBoundingClientRect: () => ({ top: 100, bottom: 500 }) } as HTMLElement;
      window.innerHeight = 800;
      expect(page.isElementVisible(el)).toBe(true);
    });

    it('should return false when element below viewport', () => {
      const page = createComponent().componentInstance as any;
      const el = { getBoundingClientRect: () => ({ top: 900, bottom: 1000 }) } as HTMLElement;
      window.innerHeight = 800;
      expect(page.isElementVisible(el)).toBe(false);
    });

    it('should return false when element above viewport', () => {
      const page = createComponent().componentInstance as any;
      const el = { getBoundingClientRect: () => ({ top: -100, bottom: -50 }) } as HTMLElement;
      window.innerHeight = 800;
      expect(page.isElementVisible(el)).toBe(false);
    });
  });

  describe('Plyr ready event', () => {
    function getReadyCallback(fixture: any): Function {
      const page = fixture.componentInstance as any;
      const calls = page.player.on.mock.calls;
      const readyCall = calls.find((args: any[]) => args[0] === 'ready');
      return readyCall ? readyCall[1] : null;
    }

    it('should auto-play on ready when element is visible', () => {
      const fixture = createComponent();
      fixture.detectChanges();
      const cb = getReadyCallback(fixture);
      expect(cb).toBeTruthy();
      vi.spyOn(fixture.componentInstance as any, 'isElementVisible').mockReturnValue(true);
      cb();
      expect(fixture.componentInstance['player'].play).toHaveBeenCalled();
    });

    it('should not auto-play on ready when element is not visible', () => {
      const fixture = createComponent();
      fixture.detectChanges();
      const cb = getReadyCallback(fixture);
      vi.spyOn(fixture.componentInstance as any, 'isElementVisible').mockReturnValue(false);
      cb();
      expect(fixture.componentInstance['player'].play).not.toHaveBeenCalled();
    });
  });

  describe('stories mode', () => {
    it('should not create Plyr in stories mode', () => {
      const fixture = createComponent(fakeGif(), true);
      fixture.detectChanges();
      const videoEl = (fixture.componentInstance as any).videoRef()?.nativeElement;
      expect(videoEl).toBeTruthy();
      expect(fixture.componentInstance['player']).toBeUndefined();
    });

    it('should set videoSrc and posterSrc in stories mode', () => {
      const gif = fakeGif({
        urls: {
          ...fakeGif({}).urls,
          thumbnail: 'https://media.redgifs.com/thumb.jpg',
          sd: 'https://media.redgifs.com/sd.mp4',
          hd: 'https://media.redgifs.com/hd.mp4',
        }
      });
      mockSettings.setSettings({ playbackMode: 'mp4', quality: 'hd', rateLimitEnabled: true, storiesNavigation: true, gridAutoplay: true });
      const fixture = createComponent(gif, true);
      fixture.detectChanges();
      expect(fixture.componentInstance.posterSrc()).toBe('/cdn/thumb.jpg');
      expect(fixture.componentInstance.videoSrc()).toBe('/cdn/hd.mp4');
    });
  });

  describe('IntersectionObserver', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function getPlayer(fixture: any) {
      return fixture.componentInstance['player'];
    }

    it('should pause when not intersecting', () => {
      const fixture = createComponent();
      fixture.detectChanges();
      vi.spyOn(mockVideoState, 'onPause');
      expect(observerCallback).toBeTruthy();
      observerCallback!([{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry], null! as any);
      expect(mockVideoState.onPause).toHaveBeenCalled();
      expect(getPlayer(fixture).pause).toHaveBeenCalled();
    });

    it('should play after 400ms when intersecting and allowed', () => {
      const fixture = createComponent();
      fixture.detectChanges();
      vi.spyOn(mockVideoState, 'requestPlay').mockReturnValue(true);
      observerCallback!([{ isIntersecting: true, intersectionRatio: 0.5 } as IntersectionObserverEntry], null! as any);
      vi.advanceTimersByTime(400);
      expect(mockVideoState.requestPlay).toHaveBeenCalled();
      expect(getPlayer(fixture).play).toHaveBeenCalled();
    });

    it('should not play after 400ms when requestPlay returns false', () => {
      const fixture = createComponent();
      fixture.detectChanges();
      vi.spyOn(mockVideoState, 'requestPlay').mockReturnValue(false);
      observerCallback!([{ isIntersecting: true, intersectionRatio: 0.5 } as IntersectionObserverEntry], null! as any);
      vi.advanceTimersByTime(400);
      expect(mockVideoState.requestPlay).toHaveBeenCalled();
      expect(getPlayer(fixture).play).not.toHaveBeenCalled();
    });
  });

  describe('deferred source attachment', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function getPlayer(fixture: any) {
      return fixture.componentInstance['player'];
    }

    it('should NOT set videoSrc or posterSrc on init', () => {
      const fixture = createComponent();
      fixture.detectChanges();
      expect(fixture.componentInstance.videoSrc()).toBe('');
      expect(fixture.componentInstance.posterSrc()).toBe('');
    });

    it('should set videoSrc and posterSrc when entering preload zone', () => {
      const fixture = createComponent();
      fixture.detectChanges();
      observerCallback!([{ isIntersecting: true, intersectionRatio: 0 } as IntersectionObserverEntry], null! as any);
      expect(fixture.componentInstance.videoSrc()).toBeTruthy();
      expect(fixture.componentInstance.posterSrc()).toBeTruthy();
    });

    it('should clear videoSrc and posterSrc when exiting viewport zone', () => {
      const fixture = createComponent();
      fixture.detectChanges();
      observerCallback!([{ isIntersecting: true, intersectionRatio: 0 } as IntersectionObserverEntry], null! as any);
      expect(fixture.componentInstance.videoSrc()).toBeTruthy();
      observerCallback!([{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry], null! as any);
      expect(fixture.componentInstance.videoSrc()).toBe('');
      expect(fixture.componentInstance.posterSrc()).toBe('');
    });

    it('should play video when in active zone (intersectionRatio >= 0.3)', () => {
      const fixture = createComponent();
      fixture.detectChanges();
      vi.spyOn(mockVideoState, 'requestPlay').mockReturnValue(true);
      observerCallback!([{ isIntersecting: true, intersectionRatio: 0.5 } as IntersectionObserverEntry], null! as any);
      vi.advanceTimersByTime(400);
      expect(mockVideoState.requestPlay).toHaveBeenCalled();
      expect(getPlayer(fixture).play).toHaveBeenCalled();
    });

    it('should NOT play video in preload zone (intersectionRatio between 0 and 0.3)', () => {
      const fixture = createComponent();
      fixture.detectChanges();
      vi.spyOn(mockVideoState, 'requestPlay').mockReturnValue(true);
      observerCallback!([{ isIntersecting: true, intersectionRatio: 0 } as IntersectionObserverEntry], null! as any);
      vi.advanceTimersByTime(400);
      expect(getPlayer(fixture).play).not.toHaveBeenCalled();
    });
  });
});