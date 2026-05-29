import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { StoriesPage } from './stories.page';
import { RedgifsApiService } from '../../services/redgifs-api.service';
import { FavoritesService } from '../../services/favorites.service';
import { WatchQueueService } from '../../services/watch-queue.service';
import { MockRedgifsApiService, MockFavoritesService, MockWatchQueueService } from '../../testing/service-mocks';
import { testStorage } from '../../../test-setup';

function makeActivatedRoute() {
  return { snapshot: { paramMap: { get: () => 'test' } }, paramMap: { subscribe: vi.fn() } } as any as ActivatedRoute;
}

describe('StoriesPage', () => {
  let mockFav: MockFavoritesService;
  let mockApi: MockRedgifsApiService;

  async function initModule() {
    testStorage.clearAll();
    mockFav = new MockFavoritesService();
    mockApi = new MockRedgifsApiService();
    const wq = new MockWatchQueueService();
    wq.setQueue([{ id: 'gif-1', userName: 'gc-user' } as any, { id: 'gif-2' } as any], 0);

    await TestBed.configureTestingModule({
      imports: [StoriesPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: makeActivatedRoute() },
        { provide: RedgifsApiService, useValue: mockApi },
        { provide: FavoritesService, useValue: mockFav },
        { provide: WatchQueueService, useValue: wq },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  }

  function createPage() {
    const fixture = TestBed.createComponent(StoriesPage);
    return { fixture, page: fixture.componentInstance };
  }

  describe('basic creation', () => {
    beforeEach(async () => await initModule());

    it('should create', () => {
      const { page } = createPage();
      expect(page).toBeTruthy();
    });
  });

  describe('ngOnInit', () => {
    beforeEach(async () => await initModule());

    it('should not redirect when queue has items', () => {
      const { page } = createPage();
      const routerSpy = vi.fn();
      (page as any).router = { navigate: routerSpy };
      page.ngOnInit();
      expect(routerSpy).not.toHaveBeenCalled();
    });
  });

  describe('redirect on empty queue', () => {
    it('should redirect to home when queue is empty and restore fails', async () => {
      testStorage.clearAll();
      const emptyWq = new MockWatchQueueService();
      mockFav = new MockFavoritesService();
      mockApi = new MockRedgifsApiService();
      await TestBed.configureTestingModule({
        imports: [StoriesPage],
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: makeActivatedRoute() },
          { provide: RedgifsApiService, useValue: mockApi },
          { provide: FavoritesService, useValue: mockFav },
          { provide: WatchQueueService, useValue: emptyWq },
        ],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
      }).compileComponents();
      const { page } = createPage();
      const routerSpy = vi.fn();
      (page as any).router = { navigate: routerSpy };
      page.ngOnInit();
      expect(routerSpy).toHaveBeenCalledWith(['/home']);
    });
  });

  describe('isFav', () => {
    beforeEach(async () => await initModule());

    it('should return true when current gif is favorite', () => {
      const { page } = createPage();
      vi.spyOn(mockFav, 'isFavorite').mockReturnValue(true);
      expect(page.isFav).toBe(true);
    });

    it('should return false when current gif is not favorite', () => {
      const { page } = createPage();
      vi.spyOn(mockFav, 'isFavorite').mockReturnValue(false);
      expect(page.isFav).toBe(false);
    });
  });

  describe('toggleFav', () => {
    beforeEach(async () => await initModule());

    it('should call toggle on favorites service', () => {
      const { page } = createPage();
      vi.spyOn(mockFav, 'toggle');
      page.toggleFav();
      expect(mockFav.toggle).toHaveBeenCalledOnce();
    });
  });

  describe('goToCreator', () => {
    beforeEach(async () => await initModule());

    it('should navigate to creator page', () => {
      const { page } = createPage();
      const routerSpy = vi.fn();
      (page as any).router = { navigate: routerSpy };
      page.goToCreator();
      expect(routerSpy).toHaveBeenCalledWith(['/creator', 'gc-user']);
    });
  });

  describe('goNext', () => {
    beforeEach(async () => await initModule());

    it('should navigate to next story', async () => {
      const { page } = createPage();
      const routerSpy = vi.fn();
      (page as any).router = { navigateByUrl: routerSpy };
      await page.goNext();
      expect(routerSpy).toHaveBeenCalledWith('/stories/gif-2', { replaceUrl: true });
    });

    it('should do nothing when no next story', async () => {
      const wq = new MockWatchQueueService();
      wq.setQueue([{ id: 'only' } as any], 0);
      const { page } = createPage();
      vi.spyOn(page as any, 'watchQueue', 'get').mockReturnValue(wq);
      const routerSpy = vi.fn();
      (page as any).router = { navigateByUrl: routerSpy };
      await page.goNext();
      expect(routerSpy).not.toHaveBeenCalled();
    });
  });

  describe('goPrev', () => {
    beforeEach(async () => await initModule());

    it('should navigate to previous story', () => {
      const wq = TestBed.inject(WatchQueueService) as MockWatchQueueService;
      wq.setQueue([{ id: 'first' } as any, { id: 'second' } as any], 1);
      const fixture = TestBed.createComponent(StoriesPage);
      const page = fixture.componentInstance;
      const routerSpy = vi.fn();
      (page as any).router = { navigateByUrl: routerSpy };
      page.goPrev();
      expect(routerSpy).toHaveBeenCalledWith('/stories/first', { replaceUrl: true });
    });

    it('should do nothing when at first story', () => {
      const fixture = TestBed.createComponent(StoriesPage);
      const page = fixture.componentInstance;
      const routerSpy = vi.fn();
      (page as any).router = { navigateByUrl: routerSpy };
      page.goPrev();
      expect(routerSpy).not.toHaveBeenCalled();
    });
  });

  describe('touch gestures', () => {
    beforeEach(async () => await initModule());

    it('should record touch start coordinates', () => {
      const { page } = createPage();
      page.onTouchStart({ touches: [{ clientY: 200, clientX: 100 }] } as any);
      expect((page as any).touchStartY).toBe(200);
      expect((page as any).touchStartX).toBe(100);
    });

    it('should call goNext when swipe up > 50px', () => {
      const { page } = createPage();
      page.onTouchStart({ touches: [{ clientY: 300, clientX: 100 }] } as any);
      vi.spyOn(page, 'goNext');
      page.onTouchEnd({ changedTouches: [{ clientY: 200, clientX: 100 }] } as any);
      expect(page.goNext).toHaveBeenCalledOnce();
    });

    it('should call goPrev when swipe down > 50px', () => {
      const { page } = createPage();
      page.onTouchStart({ touches: [{ clientY: 100, clientX: 100 }] } as any);
      vi.spyOn(page, 'goPrev');
      page.onTouchEnd({ changedTouches: [{ clientY: 200, clientX: 100 }] } as any);
      expect(page.goPrev).toHaveBeenCalledOnce();
    });

    it('should do nothing for horizontal swipe', () => {
      const { page } = createPage();
      page.onTouchStart({ touches: [{ clientY: 200, clientX: 50 }] } as any);
      vi.spyOn(page, 'goNext');
      page.onTouchEnd({ changedTouches: [{ clientY: 200, clientX: 150 }] } as any);
      expect(page.goNext).not.toHaveBeenCalled();
    });

    it('should do nothing when swipe distance <= 50px', () => {
      const { page } = createPage();
      page.onTouchStart({ touches: [{ clientY: 200, clientX: 100 }] } as any);
      vi.spyOn(page, 'goNext');
      page.onTouchEnd({ changedTouches: [{ clientY: 180, clientX: 100 }] } as any);
      expect(page.goNext).not.toHaveBeenCalled();
    });
  });

  describe('onKeyDown', () => {
    beforeEach(async () => await initModule());

    it('should call goNext on ArrowDown', () => {
      const { page } = createPage();
      vi.spyOn(page, 'goNext');
      const event = { key: 'ArrowDown', preventDefault: vi.fn() } as any;
      page.onKeyDown(event);
      expect(event.preventDefault).toHaveBeenCalledOnce();
      expect(page.goNext).toHaveBeenCalledOnce();
    });

    it('should call goPrev on ArrowUp', () => {
      const { page } = createPage();
      vi.spyOn(page, 'goPrev');
      const event = { key: 'ArrowUp', preventDefault: vi.fn() } as any;
      page.onKeyDown(event);
      expect(event.preventDefault).toHaveBeenCalledOnce();
      expect(page.goPrev).toHaveBeenCalledOnce();
    });

    it('should do nothing for other keys', () => {
      const { page } = createPage();
      vi.spyOn(page, 'goNext');
      const event = { key: 'ArrowLeft', preventDefault: vi.fn() } as any;
      page.onKeyDown(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(page.goNext).not.toHaveBeenCalled();
    });
  });
});
