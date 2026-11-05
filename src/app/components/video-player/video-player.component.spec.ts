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
let playObserverCallback: IntersectionObserverCallback | null;

class MockObserver {
  static instances: MockObserver[] = [];
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn((): IntersectionObserverEntry[] => []);
  constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = cb;
    this.options = options;
    MockObserver.instances.push(this);
    if (MockObserver.instances.length === 1) {
      observerCallback = cb;
    } else if (MockObserver.instances.length === 2) {
      playObserverCallback = cb;
    }
  }
}
vi.stubGlobal('IntersectionObserver', MockObserver as any);

describe('VideoPlayerComponent', () => {
  let mockFav: MockFavoritesService;
  let mockApi: MockRedgifsApiService;
  let mockSettings: MockSettingsService;
  let mockVideoState: MockVideoStateService;

  beforeEach(async () => {
    observerCallback = null;
    playObserverCallback = null;
    MockObserver.instances = [];
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

  afterEach(() => {
    vi.restoreAllMocks();
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

    expect(fixture.componentInstance.posterSrc()).toBe('');
    expect(fixture.componentInstance.videoSrc()).toBe('');

    observerCallback!([{ isIntersecting: true, intersectionRatio: 0 } as IntersectionObserverEntry], null! as any);
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
    expect(fixture.componentInstance.videoSrc()).toBe('');
    observerCallback!([{ isIntersecting: true, intersectionRatio: 0 } as IntersectionObserverEntry], null! as any);
    expect(fixture.componentInstance.videoSrc()).toBe('/cdn/sd.mp4');
  });

  it('should reflect isFav from favorites service', () => {
    const gif = fakeGif({ id: 'video-fav-check' });
    vi.spyOn(mockFav, 'isFavorite').mockReturnValue(true);
    const fixture = createComponent(gif);
    expect(fixture.componentInstance.isFav()).toBe(true);
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
      expect(anchor.href).toBe('https://media.redgifs.com/dl.mp4');
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
      page.sourceAttached = true;
      page.player = { destroy: vi.fn(), on: vi.fn(), play: vi.fn().mockResolvedValue(undefined), pause: vi.fn() };
      page.blobUrls = ['blob:http://test1', 'blob:http://test2'];
      const timer = setTimeout(() => {}, 10000);
      page.playTimer = timer;

      vi.spyOn(globalThis, 'clearTimeout');
      const abortSpy = vi.spyOn(page.mediaProxy, 'abortProgressiveStream');
      vi.spyOn(mockVideoState, 'onPause');

      fixture.destroy();

      expect(globalThis.clearTimeout).toHaveBeenCalledWith(timer);
      expect(page.player.destroy).toHaveBeenCalled();
      expect(mockVideoState.onPause).toHaveBeenCalled();
      expect(abortSpy).toHaveBeenCalledTimes(2);
      expect(abortSpy).toHaveBeenCalledWith('blob:http://test1');
      expect(abortSpy).toHaveBeenCalledWith('blob:http://test2');
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
    function getReadyCallback(fixture: any): Function | null {
      const page = fixture.componentInstance as any;
      const calls = page.player.on.mock.calls;
      const readyCall = calls.find((args: any[]) => args[0] === 'ready');
      return readyCall ? readyCall[1] : null;
    }

    it('should auto-play on ready when element is visible', () => {
      const fixture = createComponent();
      fixture.detectChanges();
      observerCallback!([{ isIntersecting: true, intersectionRatio: 0.5 } as IntersectionObserverEntry], null! as any);
      fixture.detectChanges();
      const cb = getReadyCallback(fixture);
      expect(cb).toBeTruthy();
      const page = fixture.componentInstance as any;
      page.sourceAttached = true;
      vi.spyOn(page, 'isElementVisible').mockReturnValue(true);
      cb!();
      expect(page.player.play).toHaveBeenCalled();
    });

    it('should not auto-play on ready when element is not visible', () => {
      const fixture = createComponent();
      fixture.detectChanges();
      observerCallback!([{ isIntersecting: true, intersectionRatio: 0.5 } as IntersectionObserverEntry], null! as any);
      fixture.detectChanges();
      const cb = getReadyCallback(fixture);
      vi.spyOn(fixture.componentInstance as any, 'isElementVisible').mockReturnValue(false);
      cb!();
      expect(fixture.componentInstance['player']!.play).not.toHaveBeenCalled();
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

    it('should swap the source when the gif input changes', async () => {
      const gifA = fakeGif({
        id: 'story-a',
        urls: { sd: '', hd: 'https://media.redgifs.com/a-hd.mp4', thumbnail: 'https://media.redgifs.com/a.jpg' },
      });
      const gifB = fakeGif({
        id: 'story-b',
        urls: { sd: '', hd: 'https://media.redgifs.com/b-hd.mp4', thumbnail: 'https://media.redgifs.com/b.jpg' },
      });

      const playedSrc: Array<string | null> = [];
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
        playedSrc.push(this.getAttribute('src'));
        return Promise.resolve();
      });

      const fixture = createComponent(gifA, true);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fixture.componentInstance.videoSrc()).toBe('/cdn/a-hd.mp4');
      expect(playedSrc.at(-1)).toBe('/cdn/a-hd.mp4');
      expect(fixture.componentInstance['videoRef']()!.nativeElement.muted).toBe(true);

      fixture.componentRef.setInput('gif', gifB);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fixture.componentInstance.videoSrc()).toBe('/cdn/b-hd.mp4');
      expect(fixture.componentInstance.posterSrc()).toBe('/cdn/b.jpg');
      expect(playedSrc.at(-1)).toBe('/cdn/b-hd.mp4');
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
      observerCallback!([{ isIntersecting: true, intersectionRatio: 0.5 } as IntersectionObserverEntry], null! as any);
      vi.spyOn(mockVideoState, 'onPause');
      expect(observerCallback).toBeTruthy();
      observerCallback!([{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry], null! as any);
      expect(mockVideoState.onPause).toHaveBeenCalled();
      expect(getPlayer(fixture).pause).toHaveBeenCalled();
    });

    it('should play after 400ms when inside the play zone and allowed', () => {
      const fixture = createComponent();
      fixture.detectChanges();
      observerCallback!([{ isIntersecting: true, intersectionRatio: 0 } as IntersectionObserverEntry], null! as any);
      vi.spyOn(mockVideoState, 'requestPlay').mockReturnValue(true);
      playObserverCallback!([{ isIntersecting: true, intersectionRatio: 0.5 } as IntersectionObserverEntry], null! as any);
      vi.advanceTimersByTime(400);
      expect(mockVideoState.requestPlay).toHaveBeenCalled();
      expect(getPlayer(fixture).play).toHaveBeenCalled();
    });

    it('should not play after 400ms when requestPlay returns false', () => {
      const fixture = createComponent();
      fixture.detectChanges();
      observerCallback!([{ isIntersecting: true, intersectionRatio: 0 } as IntersectionObserverEntry], null! as any);
      vi.spyOn(mockVideoState, 'requestPlay').mockReturnValue(false);
      playObserverCallback!([{ isIntersecting: true, intersectionRatio: 0.5 } as IntersectionObserverEntry], null! as any);
      vi.advanceTimersByTime(400);
      expect(mockVideoState.requestPlay).toHaveBeenCalled();
      expect(getPlayer(fixture).play).not.toHaveBeenCalled();
    });

    it('should pause when it leaves the play zone', () => {
      const fixture = createComponent();
      fixture.detectChanges();
      observerCallback!([{ isIntersecting: true, intersectionRatio: 0 } as IntersectionObserverEntry], null! as any);
      playObserverCallback!([{ isIntersecting: true, intersectionRatio: 0.5 } as IntersectionObserverEntry], null! as any);
      vi.spyOn(mockVideoState, 'onPause');
      playObserverCallback!([{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry], null! as any);
      expect(mockVideoState.onPause).toHaveBeenCalled();
      expect(getPlayer(fixture).pause).toHaveBeenCalled();
    });

    it('should preload with a 400px margin and play against the central viewport band', () => {
      const fixture = createComponent();
      fixture.detectChanges();
      expect(MockObserver.instances).toHaveLength(2);
      expect(MockObserver.instances[0].options?.rootMargin).toBe('400px 0px');
      expect(MockObserver.instances[1].options?.rootMargin).toBe('-15% 0px -15% 0px');
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