import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideAngularQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { WatchPage } from './watch.page';
import { RedgifsApiService } from '../../services/redgifs-api.service';
import { FavoritesService } from '../../services/favorites.service';
import { SettingsService } from '../../services/settings.service';
import { MockRedgifsApiService, MockFavoritesService, MockSettingsService } from '../../testing/service-mocks';
import { testStorage } from '../../../test-setup';
import { of } from 'rxjs';

vi.mock('plyr', () => ({
  default: class {
    on = vi.fn().mockReturnThis();
    play = vi.fn().mockResolvedValue(undefined);
    pause = vi.fn();
    destroy = vi.fn();
  },
}));

const MockHlsModule = vi.hoisted(() => {
  const cl = vi.fn().mockImplementation(() => ({
    loadSource: vi.fn(),
    attachMedia: vi.fn(),
    on: vi.fn(),
    destroy: vi.fn(),
  }));
  (cl as any).isSupported = vi.fn().mockReturnValue(true);
  (cl as any).Events = { MANIFEST_PARSED: 'hlsManifestParsed', ERROR: 'hlsError' };
  return { default: cl };
});

vi.mock('hls.js', () => MockHlsModule);

function makeActivatedRoute(id: string | null) {
  return {
    snapshot: { paramMap: { get: () => id } },
    paramMap: { subscribe: vi.fn() },
  } as any as ActivatedRoute;
}

describe('WatchPage', () => {
  let mockFav: MockFavoritesService;
  let mockApi: MockRedgifsApiService;
  let mockSettings: MockSettingsService;

  async function initModule(route?: ActivatedRoute) {
    testStorage.clearAll();
    mockFav = new MockFavoritesService();
    mockApi = new MockRedgifsApiService();
    mockSettings = new MockSettingsService();
    mockSettings.setSettings({ playbackMode: 'mp4', quality: 'hd', rateLimitEnabled: true, storiesNavigation: true, gridAutoplay: true });

    await TestBed.configureTestingModule({
      imports: [WatchPage],
      providers: [
        provideRouter([]),
        provideAngularQuery(new QueryClient({
          defaultOptions: { queries: { retry: false } }
        })),
        { provide: RedgifsApiService, useValue: mockApi },
        { provide: FavoritesService, useValue: mockFav },
        { provide: SettingsService, useValue: mockSettings },
        { provide: ActivatedRoute, useValue: route ?? makeActivatedRoute(null) },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  }

  function createPage() {
    const fixture = TestBed.createComponent(WatchPage);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  describe('basic creation', () => {
    beforeEach(async () => await initModule());

    it('should create', () => {
      expect(createPage()).toBeTruthy();
    });

    it('should have gif query', () => {
      expect(createPage().gifQuery).toBeDefined();
    });
  });

  describe('ngOnInit', () => {
    it('should set id from route param and track view', async () => {
      await initModule(makeActivatedRoute('test-gif-123'));
      const page = createPage();
      vi.spyOn(page.trackViewMutation, 'mutate');
      page.ngOnInit();
      expect((page as any).id()).toBe('test-gif-123');
      expect(page.trackViewMutation.mutate).toHaveBeenCalledWith('test-gif-123');
    });

    it('should handle null route param gracefully', async () => {
      await initModule(makeActivatedRoute(null));
      const page = createPage();
      vi.spyOn(page.trackViewMutation, 'mutate');
      page.ngOnInit();
      expect((page as any).id()).toBe('');
      expect(page.trackViewMutation.mutate).not.toHaveBeenCalled();
    });
  });

  describe('hasHd', () => {
    beforeEach(async () => await initModule());

    it('should return true when gif has hd url', () => {
      const page = createPage();
      vi.spyOn(page, 'gif', 'get').mockReturnValue({
        id: 'test', urls: { hd: 'https://media.redgifs.com/hd.mp4', sd: 'https://media.redgifs.com/sd.mp4' }
      } as any);
      expect(page.hasHd).toBe(true);
    });

    it('should return false when gif has no hd url', () => {
      const page = createPage();
      vi.spyOn(page, 'gif', 'get').mockReturnValue({
        id: 'test', urls: { sd: 'https://media.redgifs.com/sd.mp4' }
      } as any);
      expect(page.hasHd).toBe(false);
    });

    it('should return false when gif is undefined', () => {
      const page = createPage();
      vi.spyOn(page, 'gif', 'get').mockReturnValue(undefined);
      expect(page.hasHd).toBe(false);
    });
  });

  describe('posterSrc', () => {
    beforeEach(async () => await initModule());

    it('should return proxied thumbnail url', () => {
      const page = createPage();
      vi.spyOn(page, 'gif', 'get').mockReturnValue({
        urls: { thumbnail: 'https://media.redgifs.com/thumb.jpg' }
      } as any);
      expect(page.posterSrc).toBe('/cdn/thumb.jpg');
    });

    it('should return empty string when no thumbnail', () => {
      const page = createPage();
      vi.spyOn(page, 'gif', 'get').mockReturnValue({ urls: {} } as any);
      expect(page.posterSrc).toBe('');
    });

    it('should return empty when gif is undefined', () => {
      const page = createPage();
      vi.spyOn(page, 'gif', 'get').mockReturnValue(undefined);
      expect(page.posterSrc).toBe('');
    });
  });

  describe('goToCreator', () => {
    beforeEach(async () => await initModule());

    it('should navigate to creator page', () => {
      const page = createPage();
      vi.spyOn(page, 'gif', 'get').mockReturnValue({ userName: 'testcreator' } as any);
      const routerSpy = vi.fn();
      (page as any).router = { navigate: routerSpy };
      page.goToCreator();
      expect(routerSpy).toHaveBeenCalledWith(['/creator', 'testcreator']);
    });

    it('should do nothing when no userName', () => {
      const page = createPage();
      vi.spyOn(page, 'gif', 'get').mockReturnValue({ userName: undefined } as any);
      const routerSpy = vi.fn();
      (page as any).router = { navigate: routerSpy };
      page.goToCreator();
      expect(routerSpy).not.toHaveBeenCalled();
    });
  });

  describe('toggleQuality', () => {
    beforeEach(async () => await initModule());

    it('should toggle from hd to sd and call loadMp4', () => {
      const page = createPage();
      page.quality = 'hd';
      (page as any).usingHls = false;
      vi.spyOn(page as any, 'loadMp4').mockImplementation(() => {});
      page.toggleQuality();
      expect(page.quality).toBe('sd');
      expect((page as any).loadMp4).toHaveBeenCalledOnce();
    });

    it('should toggle from sd to hd and call initHls when usingHls', () => {
      const page = createPage();
      page.quality = 'sd';
      (page as any).usingHls = true;
      vi.spyOn(page as any, 'initHls').mockImplementation(() => {});
      page.toggleQuality();
      expect(page.quality).toBe('hd');
      expect((page as any).initHls).toHaveBeenCalledOnce();
    });
  });

  describe('loadMp4', () => {
    beforeEach(async () => await initModule());

    it('should set video src and play', () => {
      const page = createPage();
      const videoEl = document.createElement('video');
      vi.spyOn(page as any, 'videoRef').mockReturnValue({ nativeElement: videoEl } as any);
      vi.spyOn(page, 'gif', 'get').mockReturnValue({
        id: 'test',
        urls: { hd: 'https://media.redgifs.com/hd.mp4', sd: 'https://media.redgifs.com/sd.mp4' }
      } as any);
      page.quality = 'hd';
      vi.spyOn(videoEl, 'play').mockResolvedValue();
      (page as any).loadMp4();
      expect(videoEl.src).toContain('/cdn/hd.mp4');
    });

    it('should do nothing when no video element', () => {
      const page = createPage();
      vi.spyOn(page as any, 'videoRef').mockReturnValue(null);
      vi.spyOn(page, 'gif', 'get').mockReturnValue({
        id: 'test', urls: { hd: 'https://media.redgifs.com/hd.mp4' }
      } as any);
      expect(() => (page as any).loadMp4()).not.toThrow();
    });
  });

  describe('toggleFav', () => {
    beforeEach(async () => await initModule());

    it('should call favService.toggle when gif exists', () => {
      const page = createPage();
      const gif = { id: 'fav-test' } as any;
      vi.spyOn(page, 'gif', 'get').mockReturnValue(gif);
      vi.spyOn(mockFav, 'toggle');
      page.toggleFav();
      expect(mockFav.toggle).toHaveBeenCalledWith(gif);
    });

    it('should do nothing when gif is undefined', () => {
      const page = createPage();
      vi.spyOn(page, 'gif', 'get').mockReturnValue(undefined);
      vi.spyOn(mockFav, 'toggle');
      page.toggleFav();
      expect(mockFav.toggle).not.toHaveBeenCalled();
    });
  });

  describe('isFav', () => {
    beforeEach(async () => await initModule());

    it('should return true when gif is favorite', () => {
      const page = createPage();
      vi.spyOn(page, 'gif', 'get').mockReturnValue({ id: 'fav-check' } as any);
      vi.spyOn(mockFav, 'isFavorite').mockReturnValue(true);
      expect(page.isFav).toBe(true);
    });

    it('should return false when gif is not favorite', () => {
      const page = createPage();
      vi.spyOn(page, 'gif', 'get').mockReturnValue({ id: 'fav-check' } as any);
      vi.spyOn(mockFav, 'isFavorite').mockReturnValue(false);
      expect(page.isFav).toBe(false);
    });

    it('should return false when gif is undefined', () => {
      const page = createPage();
      vi.spyOn(page, 'gif', 'get').mockReturnValue(undefined);
      expect(page.isFav).toBe(false);
    });
  });

  describe('download', () => {
    let origCreateElement: any;
    beforeEach(async () => await initModule());

    afterEach(() => {
      if (origCreateElement) {
        document.createElement = origCreateElement;
      }
    });

    it('should create anchor and click', () => {
      const page = createPage();
      vi.spyOn(page, 'gif', 'get').mockReturnValue({
        id: 'dl-test',
        urls: { hd: 'https://media.redgifs.com/dl.mp4' }
      } as any);
      const anchor = { href: '', download: '', click: vi.fn() };
      origCreateElement = document.createElement;
      document.createElement = vi.fn().mockReturnValue(anchor as any);
      page.download();
      expect(anchor.href).toBe('/cdn/dl.mp4');
      expect(anchor.download).toBe('dl-test.mp4');
      expect(anchor.click).toHaveBeenCalledOnce();
    });

    it('should do nothing when gif is undefined', () => {
      const page = createPage();
      vi.spyOn(page, 'gif', 'get').mockReturnValue(undefined);
      expect(() => page.download()).not.toThrow();
    });
  });

  describe('sendDuration', () => {
    beforeEach(async () => await initModule());
    function setupPage() {
      const page = createPage();
      vi.spyOn(page, 'gif', 'get').mockReturnValue({ id: 'test-dur' } as any);
      vi.spyOn(page.trackDurationMutation, 'mutate');
      return page;
    }

    it('should send duration when playStart is set and elapsed > 1s', () => {
      const page = setupPage();
      (page as any).playStart = Date.now() - 5000;
      (page as any).sendDuration();
      expect(page.trackDurationMutation.mutate).toHaveBeenCalled();
    });

    it('should not send duration when playStart is 0', () => {
      const page = setupPage();
      (page as any).playStart = 0;
      (page as any).sendDuration();
      expect(page.trackDurationMutation.mutate).not.toHaveBeenCalled();
    });

    it('should not send duration when elapsed <= 1s', () => {
      const page = setupPage();
      (page as any).playStart = Date.now() - 500;
      (page as any).sendDuration();
      expect(page.trackDurationMutation.mutate).not.toHaveBeenCalled();
    });

    it('should reset playStart to 0 after sending', () => {
      const page = setupPage();
      (page as any).playStart = Date.now() - 5000;
      (page as any).sendDuration();
      expect((page as any).playStart).toBe(0);
    });
  });

  describe('setupTracking', () => {
    beforeEach(async () => await initModule());
    it('should register play, pause, ended handlers on player', () => {
      const fixture = TestBed.createComponent(WatchPage);
      fixture.detectChanges();
      const page = fixture.componentInstance;
      const player = { on: vi.fn(), destroy: vi.fn() };
      (page as any).player = player;
      (page as any).setupTracking();
      fixture.destroy();
      expect(player.on).toHaveBeenCalledWith('play', expect.any(Function));
      expect(player.on).toHaveBeenCalledWith('pause', expect.any(Function));
      expect(player.on).toHaveBeenCalledWith('ended', expect.any(Function));
    });
  });

  describe('ngOnDestroy', () => {
    it('should send duration and destroy hls, player, blob URLs', async () => {
      await initModule(makeActivatedRoute('test'));
      const fixture = TestBed.createComponent(WatchPage);
      fixture.detectChanges();
      const page = fixture.componentInstance as any;
      page.player = { destroy: vi.fn() };
      page.hls = { destroy: vi.fn() };
      page.blobUrls = ['blob:http://test'];
      vi.spyOn(page, 'sendDuration');
      vi.spyOn(URL, 'revokeObjectURL');

      fixture.destroy();

      expect(page.sendDuration).toHaveBeenCalled();
      expect(page.hls.destroy).toHaveBeenCalled();
      expect(page.player.destroy).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://test');
    });
  });

  describe('initPlayer', () => {
    beforeEach(async () => await initModule());
    function setupForInit() {
      const page = createPage() as any;
      page.videoRef = vi.fn().mockReturnValue({ nativeElement: document.createElement('video') });
      return page;
    }

    it('should create Plyr and set video source in MP4 mode', () => {
      const page = setupForInit();
      vi.spyOn(page, 'gif', 'get').mockReturnValue({ id: 'test', urls: { hd: 'https://media.redgifs.com/hd.mp4', sd: '' } } as any);
      page.initPlayer();
      expect(page.player).toBeDefined();
      expect(page.videoRef().nativeElement.src).toContain('/cdn/');
    });

    it('should not create duplicate player', () => {
      const page = setupForInit();
      vi.spyOn(page, 'gif', 'get').mockReturnValue({ id: 'test', urls: { hd: '', sd: 'https://media.redgifs.com/sd.mp4' } } as any);
      page.initPlayer();
      const firstPlayer = page.player;
      page.initPlayer();
      expect(page.player).toBe(firstPlayer);
    });

    it('should use HLS when playbackMode is hls and gif has hls', () => {
      mockSettings.setSettings({ playbackMode: 'hls', quality: 'hd', rateLimitEnabled: true, storiesNavigation: true, gridAutoplay: true });
      const page = setupForInit();
      vi.spyOn(page, 'gif', 'get').mockReturnValue({ id: 'hls-test', urls: { hd: '', sd: '' }, hls: true } as any);
      page.initPlayer();
      expect(page.usingHls).toBe(true);
      expect(page.player).toBeDefined();
    });
  });
});

