import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideAngularQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { NicheBrowsePage } from './niche-browse.page';
import { RedgifsApiService } from '../../services/redgifs-api.service';
import { SettingsService } from '../../services/settings.service';
import { WatchQueueService } from '../../services/watch-queue.service';
import { MockRedgifsApiService, MockSettingsService } from '../../testing/service-mocks';
import { fakeGif } from '../../testing/test-utils';
import { testStorage } from '../../../test-setup';

function makeActivatedRoute(nicheId: string | null) {
  return { snapshot: { paramMap: { get: () => nicheId } } } as any as ActivatedRoute;
}

describe('NicheBrowsePage', () => {
  let mockApi: MockRedgifsApiService;
  let mockSettings: MockSettingsService;
  let router: any;

  function initModule(route?: ActivatedRoute) {
    testStorage.clearAll();
    mockApi = new MockRedgifsApiService();
    mockSettings = new MockSettingsService();
    mockSettings.setSettings({ playbackMode: 'mp4', quality: 'hd', rateLimitEnabled: true, storiesNavigation: true, gridAutoplay: true });

    TestBed.configureTestingModule({
      imports: [NicheBrowsePage],
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
    const fixture = TestBed.createComponent(NicheBrowsePage);
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

  it('should have gifs query', () => {
    const page = createPage();
    expect(page.gifsQuery).toBeDefined();
  });

  it('should set nicheId from route', () => {
    initModule(makeActivatedRoute('test-niche'));
    TestBed.compileComponents();
    const page = createPage();
    page.ngOnInit();
    expect((page as any).nicheId()).toBe('test-niche');
  });

  it('should handle empty route param', () => {
    const page = createPage();
    page.ngOnInit();
    expect((page as any).nicheId()).toBe('');
  });

  it('should navigate to creator on onCreatorClick', () => {
    const page = createPage();
    const navigateSpy = vi.spyOn(router, 'navigate');
    page.onCreatorClick('test-user');
    expect(navigateSpy).toHaveBeenCalledWith(['/creator', 'test-user']);
  });

  it('should fetch next page on loadMore when hasMore', () => {
    const page = createPage();
    vi.spyOn(page.gifsQuery, 'hasNextPage', 'get').mockReturnValue(() => true);
    vi.spyOn(page.gifsQuery, 'isFetching', 'get').mockReturnValue(() => false);
    vi.spyOn(page.gifsQuery, 'fetchNextPage');
    page.loadMore();
    expect(page.gifsQuery.fetchNextPage).toHaveBeenCalled();
  });

  it('should not fetch on loadMore when fetching', () => {
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