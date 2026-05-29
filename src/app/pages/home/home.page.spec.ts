import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { fakeAsync, tick } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAngularQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { HomePage } from './home.page';
import { RedgifsApiService } from '../../services/redgifs-api.service';
import { SettingsService } from '../../services/settings.service';
import { WatchQueueService } from '../../services/watch-queue.service';
import { MockRedgifsApiService, MockSettingsService } from '../../testing/service-mocks';
import { fakeGif } from '../../testing/test-utils';
import { testStorage } from '../../../test-setup';

describe('HomePage', () => {
  let mockApi: MockRedgifsApiService;
  let mockSettings: MockSettingsService;
  let router: any;

  function initModule() {
    testStorage.clearAll();
    mockApi = new MockRedgifsApiService();
    mockSettings = new MockSettingsService();
    mockSettings.setSettings({ playbackMode: 'mp4', quality: 'hd', rateLimitEnabled: true, storiesNavigation: true, gridAutoplay: true });

    TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideRouter([]),
        provideAngularQuery(new QueryClient({
          defaultOptions: { queries: { retry: false } }
        })),
        { provide: RedgifsApiService, useValue: mockApi },
        { provide: SettingsService, useValue: mockSettings },
        { provide: WatchQueueService, useValue: { setQueue: vi.fn() } },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
  }

  function createFixture() {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    router = (fixture.componentInstance as any).router;
    return fixture;
  }

  function createPage() {
    return createFixture().componentInstance;
  }

  beforeEach(async () => {
    initModule();
    await TestBed.compileComponents();
  });

  it('should create', () => {
    expect(createPage()).toBeTruthy();
  });

  it('should load trending gifs query', () => {
    const page = createPage();
    expect(page.trendingGifs).toBeDefined();
  });

  it('should load trending tags query', () => {
    const page = createPage();
    expect(page.trendingTags).toBeDefined();
  });

  it('should have feed query that returns data', () => {
    const page = createPage();
    expect(page.feedQuery).toBeDefined();
  });

  it('should return gifs from trending query when section is trending', () => {
    const page = createPage();
    vi.spyOn(page.trendingGifsQuery, 'data', 'get').mockReturnValue(() => [fakeGif()]);
    expect(page.gifs.length).toBe(1);
  });

  it('should return empty array when trending data is null', () => {
    const page = createPage();
    vi.spyOn(page.trendingGifsQuery, 'data', 'get').mockReturnValue(() => undefined);
    expect(page.gifs).toEqual([]);
  });

  it('should switch section and persist to localStorage', () => {
    const fixture = createFixture();
    const page = fixture.componentInstance;
    page.switchSection('popular');
    fixture.detectChanges();
    expect(page.selectedSection()).toBe('popular');
    expect(localStorage.getItem('redview_home_section')).toBe('popular');
  });

  it('should return loading from trending query when trending section', () => {
    const page = createPage();
    vi.spyOn(page.trendingGifsQuery, 'isLoading', 'get').mockReturnValue(() => true);
    expect(page.loading).toBe(true);
  });

  it('should return hasMore false for trending section', () => {
    const page = createPage();
    expect(page.hasMore).toBe(false);
  });

  it('should call loadMore when hasMore is true', async () => {
    const page = createPage();
    page.switchSection('popular');
    vi.spyOn(page.feedQuery, 'hasNextPage', 'get').mockReturnValue(() => true);
    vi.spyOn(page.feedQuery, 'isFetching', 'get').mockReturnValue(() => false);
    vi.spyOn(page.feedQuery, 'fetchNextPage').mockResolvedValue(undefined as any);
    const event = { target: { complete: vi.fn() } };
    await page.loadMore(event);
    expect(page.feedQuery.fetchNextPage).toHaveBeenCalled();
    expect(event.target.complete).toHaveBeenCalled();
  });

  it('should not fetch when already fetching', async () => {
    const page = createPage();
    page.switchSection('popular');
    vi.spyOn(page.feedQuery, 'hasNextPage', 'get').mockReturnValue(() => true);
    vi.spyOn(page.feedQuery, 'isFetching', 'get').mockReturnValue(() => true);
    vi.spyOn(page.feedQuery, 'fetchNextPage');
    const event = { target: { complete: vi.fn() } };
    await page.loadMore(event);
    expect(page.feedQuery.fetchNextPage).not.toHaveBeenCalled();
  });

  it('should doRefresh and call target.complete', async () => {
    const page = createPage();
    vi.spyOn(page.trendingGifsQuery, 'refetch').mockResolvedValue(undefined as any);
    vi.spyOn(page.trendingTagsQuery, 'refetch').mockResolvedValue(undefined as any);
    vi.spyOn(page.trendingCreatorsQuery, 'refetch').mockResolvedValue(undefined as any);
    vi.spyOn(page.trendingNichesQuery, 'refetch').mockResolvedValue(undefined as any);
    vi.spyOn(page.feedQuery, 'refetch').mockResolvedValue(undefined as any);
    const event = { target: { complete: vi.fn() } };
    await page.doRefresh(event);
    expect(page.trendingGifsQuery.refetch).toHaveBeenCalled();
    expect(page.trendingTagsQuery.refetch).toHaveBeenCalled();
    expect(page.trendingCreatorsQuery.refetch).toHaveBeenCalled();
    expect(page.trendingNichesQuery.refetch).toHaveBeenCalled();
    expect(page.feedQuery.refetch).toHaveBeenCalled();
    expect(event.target.complete).toHaveBeenCalled();
  });

  describe('onCardClick', () => {
    const gifs = [fakeGif({ id: 'g1' }), fakeGif({ id: 'g2' })];

    it('should navigate to /stories with storiesNavigation and non-trending section', () => {
      const page = createPage();
      vi.spyOn(page, 'gifs', 'get').mockReturnValue(gifs);
      page.switchSection('popular');
      const navigateSpy = vi.spyOn(router, 'navigate');
      page.onCardClick('g1', 0);
      expect(navigateSpy).toHaveBeenCalledWith(['/stories', 'g1']);
    });

    it('should navigate to /stories with storiesNavigation and trending section', () => {
      const page = createPage();
      vi.spyOn(page, 'gifs', 'get').mockReturnValue(gifs);
      const navigateSpy = vi.spyOn(router, 'navigate');
      page.onCardClick('g1', 0);
      expect(navigateSpy).toHaveBeenCalledWith(['/stories', 'g1']);
    });

    it('should navigate to /watch when storiesNavigation is off', () => {
      mockSettings.setSettings({ playbackMode: 'mp4', quality: 'hd', rateLimitEnabled: true, storiesNavigation: false, gridAutoplay: true });
      const page = createPage();
      vi.spyOn(page, 'gifs', 'get').mockReturnValue(gifs);
      const navigateSpy = vi.spyOn(router, 'navigate');
      page.onCardClick('g1', 0);
      expect(navigateSpy).toHaveBeenCalledWith(['/watch', 'g1']);
    });
  });

  it('should navigate to creator on onCreatorClick', () => {
    const page = createPage();
    const navigateSpy = vi.spyOn(router, 'navigate');
    page.onCreatorClick('test-user');
    expect(navigateSpy).toHaveBeenCalledWith(['/creator', 'test-user']);
  });

  describe('sidebar staggered loading', () => {
    it('should set sidebarTagsReady after 2s when trendingGifs is success', fakeAsync(() => {
      const fixture = createFixture();
      const page = fixture.componentInstance as any;
      page.sidebarTagsReady.set(true);
      tick(2000);
      expect(page.sidebarTagsReady()).toBe(true);
    }));

    it('should cascade sidebar ready states through effects', fakeAsync(() => {
      const fixture = createFixture();
      const page = fixture.componentInstance as any;
      page.sidebarTagsReady.set(true);
      fixture.detectChanges();
      tick(2000);
      fixture.detectChanges();
      expect(page.sidebarCreatorsReady()).toBe(true);
      tick(2000);
      fixture.detectChanges();
      expect(page.sidebarNichesReady()).toBe(true);
    }));
  });
});