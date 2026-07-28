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
import { By } from '@angular/platform-browser';

function makeActivatedRoute(id: string | null) {
  return {
    snapshot: { paramMap: { get: () => id } },
    paramMap: { subscribe: vi.fn() },
  } as any as ActivatedRoute;
}

const mockGif = {
  id: 'test-gif',
  userName: 'testuser',
  description: 'Test GIF',
  urls: {
    sd: 'https://media.redgifs.com/sd.mp4',
    hd: 'https://media.redgifs.com/hd.mp4',
    thumbnail: 'https://media.redgifs.com/thumb.jpg',
    poster: 'https://media.redgifs.com/poster.jpg',
  },
  type: 'gif',
  width: 400,
  height: 300,
  hasAudio: false,
  createDate: Date.now() / 1000,
  tags: ['test'],
  likes: 10,
  views: 100,
  verified: 'n',
  duration: 5,
  published: true,
  promoted: false,
  niches: ['funny'],
  sexuality: ['sfw'],
};

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

  function createFixture() {
    const fixture = TestBed.createComponent(WatchPage);
    fixture.detectChanges();
    return fixture;
  }

  describe('basic creation', () => {
    beforeEach(async () => await initModule());

    it('should create', () => {
      expect(createFixture().componentInstance).toBeTruthy();
    });

    it('should have gif query', () => {
      expect(createFixture().componentInstance.gifQuery).toBeDefined();
    });
  });

  describe('ngOnInit', () => {
    it('should set id from route param and track view', async () => {
      await initModule(makeActivatedRoute('test-gif-123'));
      const page = createFixture().componentInstance;
      vi.spyOn(page.trackViewMutation, 'mutate');
      page.ngOnInit();
      expect((page as any).id()).toBe('test-gif-123');
      expect(page.trackViewMutation.mutate).toHaveBeenCalledWith('test-gif-123');
    });

    it('should handle null route param gracefully', async () => {
      await initModule(makeActivatedRoute(null));
      const page = createFixture().componentInstance;
      vi.spyOn(page.trackViewMutation, 'mutate');
      page.ngOnInit();
      expect((page as any).id()).toBe('');
      expect(page.trackViewMutation.mutate).not.toHaveBeenCalled();
    });
  });

  describe('goToCreator', () => {
    beforeEach(async () => await initModule());

    it('should navigate to creator page', () => {
      const page = createFixture().componentInstance;
      vi.spyOn(page, 'gif', 'get').mockReturnValue(() => ({ userName: 'testcreator' } as any));
      const routerSpy = vi.fn();
      (page as any).router = { navigate: routerSpy };
      page.goToCreator();
      expect(routerSpy).toHaveBeenCalledWith(['/creator', 'testcreator']);
    });

    it('should do nothing when no userName', () => {
      const page = createFixture().componentInstance;
      vi.spyOn(page, 'gif', 'get').mockReturnValue(() => ({ userName: undefined } as any));
      const routerSpy = vi.fn();
      (page as any).router = { navigate: routerSpy };
      page.goToCreator();
      expect(routerSpy).not.toHaveBeenCalled();
    });
  });

  describe('onDuration', () => {
    beforeEach(async () => await initModule());

    it('should call trackDurationMutation', () => {
      const page = createFixture().componentInstance;
      vi.spyOn(page.trackDurationMutation, 'mutate');
      page.onDuration({ gifId: 'test', duration: 5000 });
      expect(page.trackDurationMutation.mutate).toHaveBeenCalledWith({ gifId: 'test', duration: 5000 });
    });
  });

  describe('template rendering', () => {
    beforeEach(async () => await initModule());

    function createWithGif() {
      const fixture = TestBed.createComponent(WatchPage);
      const page = fixture.componentInstance;
      vi.spyOn(page, 'gif', 'get').mockReturnValue(() => mockGif as any);
      fixture.detectChanges();
      return fixture;
    }

    it('should show app-video-player when gif is loaded', () => {
      const fixture = createWithGif();
      const player = fixture.debugElement.query(By.css('app-video-player'));
      expect(player).toBeTruthy();
    });

    it('should show gif details when gif is loaded', () => {
      const fixture = createWithGif();
      const details = fixture.debugElement.query(By.css('[data-testid="gif-details"]'));
      expect(details).toBeTruthy();
    });

    it('should show creator name in header', () => {
      const fixture = createWithGif();
      const creatorEl = fixture.debugElement.query(By.css('[data-testid="watch-creator-name"]'));
      expect(creatorEl).toBeTruthy();
      expect(creatorEl.nativeElement.textContent).toContain('testuser');
    });

    it('should show gif details content', () => {
      const fixture = createWithGif();
      const nameEl = fixture.debugElement.query(By.css('[data-testid="watch-creator-detail-name"]'));
      expect(nameEl).toBeTruthy();
      expect(nameEl.nativeElement.textContent).toContain('testuser');
    });

    it('should show tags section', () => {
      const fixture = createWithGif();
      const tags = fixture.debugElement.query(By.css('[data-testid="gif-tags-section"]'));
      expect(tags).toBeTruthy();
    });

    it('should show quality badge', () => {
      const fixture = createWithGif();
      const qualityItem = fixture.debugElement.query(By.css('[data-testid="gif-quality"]'));
      expect(qualityItem).toBeTruthy();
    });

    it('should show not-found state when no gif, not loading, not error', () => {
      const fixture = TestBed.createComponent(WatchPage);
      const page = fixture.componentInstance;
      vi.spyOn(page, 'gif', 'get').mockReturnValue(() => undefined);
      vi.spyOn(page, 'loading', 'get').mockReturnValue(() => false);
      vi.spyOn(page, 'error', 'get').mockReturnValue(() => false);
      fixture.detectChanges();

      const errorEl = fixture.debugElement.query(By.css('.error-state'));
      expect(errorEl).toBeTruthy();
      expect(errorEl.nativeElement.textContent).toContain('GIF not found');
    });
  });
});
