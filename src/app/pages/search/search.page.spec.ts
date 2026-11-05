import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideAngularQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';
import { SearchPage } from './search.page';
import { RedgifsApiService } from '../../services/redgifs-api.service';
import { SettingsService } from '../../services/settings.service';
import { WatchQueueService } from '../../services/watch-queue.service';
import { MockRedgifsApiService, MockSettingsService, MockWatchQueueService } from '../../testing/service-mocks';
import { testStorage } from '../../../test-setup';

function makeActivatedRoute(query: string | null) {
  return {
    snapshot: { paramMap: { get: () => query } },
    paramMap: of({ get: () => query }),
  } as any as ActivatedRoute;
}

describe('SearchPage', () => {
  let mockApi: MockRedgifsApiService;
  let mockSettings: MockSettingsService;
  let mockWatchQueue: MockWatchQueueService;

  async function initModule(route?: ActivatedRoute) {
    testStorage.clearAll();
    mockApi = new MockRedgifsApiService();
    mockSettings = new MockSettingsService();
    mockSettings.setSettings({ playbackMode: 'mp4', quality: 'hd', rateLimitEnabled: true, storiesNavigation: true, gridAutoplay: true });
    mockWatchQueue = new MockWatchQueueService();

    await TestBed.configureTestingModule({
      imports: [SearchPage],
      providers: [
        provideRouter([]),
        provideAngularQuery(new QueryClient({
          defaultOptions: { queries: { retry: false } }
        })),
        { provide: RedgifsApiService, useValue: mockApi },
        { provide: SettingsService, useValue: mockSettings },
        { provide: WatchQueueService, useValue: mockWatchQueue },
        { provide: ActivatedRoute, useValue: route ?? makeActivatedRoute(null) },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  }

  function createPage() {
    const fixture = TestBed.createComponent(SearchPage);
    fixture.detectChanges();
    return { fixture, page: fixture.componentInstance };
  }

  describe('basic creation', () => {
    beforeEach(async () => await initModule());

    it('should create', () => {
      expect(createPage().page).toBeTruthy();
    });

    it('should have initial empty query signal', () => {
      expect(createPage().page.query()).toBe('');
    });

    it('should have search results query', () => {
      expect(createPage().page.searchResultQuery).toBeDefined();
    });

    it('should have empty suggestions array', () => {
      expect(Array.isArray(createPage().page.suggestions)).toBe(true);
    });
  });

  describe('onSearchInput', () => {
    beforeEach(async () => await initModule());

    it('should set query and fetch suggestions when value exists', () => {
      vi.useFakeTimers();
      const { page } = createPage();
      vi.spyOn(mockApi, 'getTagSuggestions').mockReturnValue(of([{ text: 'funny cats', type: 'tag', gifs: [] }]));
      page.onSearchInput({ detail: { value: 'funny' } });
      vi.advanceTimersByTime(300);
      expect(page.query()).toBe('funny');
      expect(mockApi.getTagSuggestions).toHaveBeenCalledWith('funny');
      expect(page.suggestions).toHaveLength(1);
      vi.useRealTimers();
    });

    it('should clear suggestions when value is empty', () => {
      const { page } = createPage();
      page.suggestions = [{ text: 'old', type: 'tag', gifs: [] }];
      page.onSearchInput({ detail: { value: '' } });
      expect(page.query()).toBe('');
      expect(page.suggestions).toEqual([]);
    });

    it('should handle null detail gracefully', () => {
      const { page } = createPage();
      page.onSearchInput({ detail: null });
      expect(page.query()).toBe('');
    });
  });

  describe('search', () => {
    beforeEach(async () => await initModule());

    it('should perform search with current query', () => {
      const { page } = createPage();
      page.query.set('cats');
      const routerSpy = vi.fn();
      (page as any).router = { navigate: routerSpy };
      page.search();
      expect(page.hasSearched).toBe(true);
      expect(page.loading()).toBe(true);
      expect(routerSpy).toHaveBeenCalledWith(['/search', 'cats'], { replaceUrl: true });
    });

    it('should perform search with provided value', () => {
      const { page } = createPage();
      const routerSpy = vi.fn();
      (page as any).router = { navigate: routerSpy };
      page.search('dogs');
      expect(page.hasSearched).toBe(true);
      expect(routerSpy).toHaveBeenCalledWith(['/search', 'dogs'], { replaceUrl: true });
    });

    it('should not search with empty query', () => {
      const { page } = createPage();
      const routerSpy = vi.fn();
      (page as any).router = { navigate: routerSpy };
      page.search('');
      expect(page.hasSearched).toBe(false);
      expect(routerSpy).not.toHaveBeenCalled();
    });

    it('should not clear results when same query searched again', () => {
      const { page } = createPage();
      vi.spyOn(page.searchResultQuery, 'data', 'get').mockReturnValue(() => ({ gifs: [{ id: 'gif-1' }], page: 1, pages: 1, total: 1 } as any));
      page.searchQuery.set('cats');
      page.query.set('cats');
      const routerSpy = vi.fn();
      (page as any).router = { navigate: routerSpy };
      page.search();
      expect(page.results()).toHaveLength(1);
      expect(page.suggestions).toEqual([]);
    });

    it('should clear suggestions on search', () => {
      const { page } = createPage();
      page.suggestions = [{ text: 'test', type: 'tag', gifs: [] }];
      page.query.set('test');
      const routerSpy = vi.fn();
      (page as any).router = { navigate: routerSpy };
      page.search();
      expect(page.suggestions).toEqual([]);
    });
  });

  describe('onSearchTypeChange', () => {
    beforeEach(async () => await initModule());

    it('should change search type to images', () => {
      const { page } = createPage();
      page.hasSearched = false;
      vi.spyOn(page, 'search');
      page.onSearchTypeChange({ detail: { value: 'images' } } as any);
      expect(page.searchType()).toBe('images');
      expect(page.search).not.toHaveBeenCalled();
    });

    it('should re-search when hasSearched is true', () => {
      const { page } = createPage();
      page.hasSearched = true;
      vi.spyOn(page, 'search');
      page.onSearchTypeChange({ detail: { value: 'gifs' } } as any);
      expect(page.searchType()).toBe('gifs');
      expect(page.search).toHaveBeenCalledOnce();
    });

    it('should ignore invalid value', () => {
      const { page } = createPage();
      page.searchType.set('gifs');
      page.onSearchTypeChange({ detail: { value: 'invalid' } } as any);
      expect(page.searchType()).toBe('gifs');
    });
  });

  describe('onClear', () => {
    beforeEach(async () => await initModule());

    it('should reset results, hasSearched and query', () => {
      const { page } = createPage();
      page.hasSearched = true;
      page.query.set('test');
      page.onClear({ value: 'test' } as any);
      expect(page.results()).toEqual([]);
      expect(page.hasSearched).toBe(false);
      expect(page.query()).toBe('');
    });
  });

  describe('selectSuggestion', () => {
    beforeEach(async () => await initModule());

    it('should set query and search', () => {
      const { page } = createPage();
      vi.spyOn(page, 'search');
      page.selectSuggestion('funny cats');
      expect(page.query()).toBe('funny cats');
      expect(page.search).toHaveBeenCalledOnce();
    });
  });

  describe('onCardClick', () => {
    beforeEach(async () => await initModule());

    it('should navigate to stories when storiesNavigation enabled', () => {
      const { page } = createPage();
      vi.spyOn(page, 'results').mockReturnValue([{ id: 'result-1' } as any, { id: 'result-2' } as any]);
      const routerSpy = vi.fn();
      (page as any).router = { navigate: routerSpy };
      page.onCardClick('result-1', 0);
      expect(routerSpy).toHaveBeenCalledWith(['/stories', 'result-1']);
    });

    it('should navigate to watch when storiesNavigation disabled', () => {
      const { page } = createPage();
      mockSettings.update({ storiesNavigation: false });
      vi.spyOn(page, 'results').mockReturnValue([{ id: 'result-1' } as any]);
      const routerSpy = vi.fn();
      (page as any).router = { navigate: routerSpy };
      page.onCardClick('result-1', 0);
      expect(routerSpy).toHaveBeenCalledWith(['/watch', 'result-1']);
    });
  });

  describe('onCreatorClick', () => {
    beforeEach(async () => await initModule());

    it('should navigate to creator page', () => {
      const { page } = createPage();
      const routerSpy = vi.fn();
      (page as any).router = { navigate: routerSpy };
      page.onCreatorClick('testcreator');
      expect(routerSpy).toHaveBeenCalledWith(['/creator', 'testcreator']);
    });
  });

  describe('ngOnInit', () => {
    it('should auto-search when route param has query', async () => {
      await initModule(makeActivatedRoute('auto-search'));
      const { page } = createPage();
      expect(page.query()).toBe('auto-search');
    });
  });
});
