import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideAngularQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { CreatorDetailPage } from './creator-detail.page';
import { RedgifsApiService } from '../../services/redgifs-api.service';
import { SettingsService } from '../../services/settings.service';
import { WatchQueueService } from '../../services/watch-queue.service';
import { MockRedgifsApiService, MockSettingsService } from '../../testing/service-mocks';
import { fakeGif } from '../../testing/test-utils';
import { testStorage } from '../../../test-setup';

function makeActivatedRoute(username: string | null) {
  return { snapshot: { paramMap: { get: () => username } } } as any as ActivatedRoute;
}

describe('CreatorDetailPage', () => {
  let mockApi: MockRedgifsApiService;
  let mockSettings: MockSettingsService;
  let router: any;

  function initModule(route?: ActivatedRoute) {
    testStorage.clearAll();
    mockApi = new MockRedgifsApiService();
    mockSettings = new MockSettingsService();
    mockSettings.setSettings({ playbackMode: 'mp4', quality: 'hd', rateLimitEnabled: true, storiesNavigation: true, gridAutoplay: true });

    TestBed.configureTestingModule({
      imports: [CreatorDetailPage],
      providers: [
        provideRouter([]),
        provideAngularQuery(new QueryClient({
          defaultOptions: { queries: { retry: false } }
        })),
        { provide: RedgifsApiService, useValue: mockApi },
        { provide: SettingsService, useValue: mockSettings },
        { provide: WatchQueueService, useValue: { setQueue: vi.fn() } },
        { provide: ActivatedRoute, useValue: route ?? makeActivatedRoute(null) },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
  }

  function createPage() {
    const fixture = TestBed.createComponent(CreatorDetailPage);
    fixture.detectChanges();
    router = (fixture.componentInstance as any).router;
    return fixture.componentInstance;
  }

  beforeEach(async () => {
    initModule();
    await TestBed.compileComponents();
  });

  it('should create', () => {
    expect(createPage()).toBeTruthy();
  });

  it('should have user query', () => {
    const page = createPage();
    expect(page.userQuery).toBeDefined();
  });

  it('should have gifs query', () => {
    const page = createPage();
    expect(page.gifsQuery).toBeDefined();
  });

  it('should set username from route on init', () => {
    initModule(makeActivatedRoute('test-creator'));
    TestBed.compileComponents();
    const page = createPage();
    page.ngOnInit();
    expect((page as any).username()).toBe('test-creator');
  });

  it('should handle empty route param', () => {
    const page = createPage();
    page.ngOnInit();
    expect((page as any).username()).toBe('');
  });

  it('should set sort order', () => {
    const page = createPage();
    (page as any).sortOrder.set('trending');
    page.setSort('top');
    expect((page as any).sortOrder()).toBe('top');
  });

  it('should toggle view mode and persist', () => {
    const page = createPage();
    page.toggleViewMode();
    expect(page.viewMode).toBe('list');
    expect(localStorage.getItem('redview_creator_view')).toBe('list');
    page.toggleViewMode();
    expect(page.viewMode).toBe('grid');
  });

  it('should navigate to creator on onCreatorClick', () => {
    const page = createPage();
    const navigateSpy = vi.spyOn(router, 'navigate');
    page.onCreatorClick('other-user');
    expect(navigateSpy).toHaveBeenCalledWith(['/creator', 'other-user']);
  });

  it('should return social links from user', () => {
    const page = createPage();
    (page as any).userQuery = { data: signal(undefined) };
    expect(page.socialLinks).toEqual([]);
    (page as any).userQuery = { data: signal({ links: [{ domain: 'x.com', url: 'https://x.com/u' }] }) };
    expect(page.socialLinks.length).toBe(1);
  });

  it('should fetch next page on loadMore when hasMore', () => {
    const page = createPage();
    vi.spyOn(page.gifsQuery, 'hasNextPage', 'get').mockReturnValue(() => true);
    vi.spyOn(page.gifsQuery, 'isFetching', 'get').mockReturnValue(() => false);
    vi.spyOn(page.gifsQuery, 'fetchNextPage');
    page.loadMore();
    expect(page.gifsQuery.fetchNextPage).toHaveBeenCalled();
  });

  it('should not fetch on loadMore when already fetching', () => {
    const page = createPage();
    vi.spyOn(page.gifsQuery, 'hasNextPage', 'get').mockReturnValue(() => true);
    vi.spyOn(page.gifsQuery, 'isFetching', 'get').mockReturnValue(() => true);
    vi.spyOn(page.gifsQuery, 'fetchNextPage');
    page.loadMore();
    expect(page.gifsQuery.fetchNextPage).not.toHaveBeenCalled();
  });

  describe('onCardClick', () => {
    it('should navigate to /stories with storiesNavigation', () => {
      const page = createPage();
      vi.spyOn(page as any, 'gifs', 'get').mockReturnValue([fakeGif({ id: 'g1' })]);
      const navigateSpy = vi.spyOn(router, 'navigate');
      page.onCardClick('g1', 0);
      expect(navigateSpy).toHaveBeenCalledWith(['/stories', 'g1']);
    });

    it('should navigate to /watch without storiesNavigation', () => {
      mockSettings.setSettings({ playbackMode: 'mp4', quality: 'hd', rateLimitEnabled: true, storiesNavigation: false, gridAutoplay: true });
      const page = createPage();
      vi.spyOn(page as any, 'gifs', 'get').mockReturnValue([fakeGif({ id: 'g1' })]);
      const navigateSpy = vi.spyOn(router, 'navigate');
      page.onCardClick('g1', 0);
      expect(navigateSpy).toHaveBeenCalledWith(['/watch', 'g1']);
    });
  });
});