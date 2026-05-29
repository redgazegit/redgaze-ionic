import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, EMPTY } from 'rxjs';
import type { RedgifsApiService } from './redgifs-api.service';
import type { Gif, SearchResult, CreatorResult } from '../models/gif.model';
import {
  homeFeedGenerator,
  creatorFeedGenerator,
  searchFeedGenerator,
  nicheFeedGenerator,
} from './feed-generators';

function createMockGif(id: string): Gif {
  return { id, urls: {}, userName: 'test', tags: [], likes: 0 } as any as Gif;
}

function createSearchResult(gifCount: number, pages?: number): SearchResult {
  const gifs = Array.from({ length: gifCount }, (_, i) => createMockGif(`gif-${i}`));
  return { gifs, pages, total: gifCount, niches: [], tags: [], creators: [] } as SearchResult;
}

function createCreatorResult(gifCount: number, pages?: number): CreatorResult {
  const gifs = Array.from({ length: gifCount }, (_, i) => createMockGif(`gif-${i}`));
  return { items: gifs, gifs, pages, total: gifCount } as CreatorResult;
}

function createMockApi(): Partial<RedgifsApiService> {
  return {
    getPopularFeed: vi.fn(),
    getTopThisWeek: vi.fn(),
    searchGifs: vi.fn(),
    searchImages: vi.fn(),
    searchCreator: vi.fn(),
    getNicheGifs: vi.fn(),
  };
}

describe('feed-generators', () => {
  let api: Partial<RedgifsApiService>;

  beforeEach(() => {
    api = createMockApi();
  });

  describe('homeFeedGenerator', () => {
    it('should yield first page of trending for popular section', async () => {
      const result = createSearchResult(2, 5);
      (api.getPopularFeed as any).mockReturnValue(of(result));

      const gen = homeFeedGenerator(api as RedgifsApiService, 'popular')();
      const first = await gen.next();

      expect(first.done).toBe(false);
      expect(first.value).toHaveLength(2);
      expect(first.value[0].id).toBe('gif-0');
      expect(api.getPopularFeed).toHaveBeenCalledWith('trending', 40, 2);
    });

    it('should yield first page of top-week section', async () => {
      const result = createSearchResult(1, 3);
      (api.getTopThisWeek as any).mockReturnValue(of(result));

      const gen = homeFeedGenerator(api as RedgifsApiService, 'top-week')();
      const first = await gen.next();

      expect(first.done).toBe(false);
      expect(first.value).toHaveLength(1);
      expect(api.getTopThisWeek).toHaveBeenCalledWith(30, 2);
    });

    it('should yield first page of top28 section via searchGifs', async () => {
      const result = createSearchResult(3);
      (api.searchGifs as any).mockReturnValue(of(result));

      const gen = homeFeedGenerator(api as RedgifsApiService, 'top28')();
      const first = await gen.next();

      expect(first.done).toBe(false);
      expect(first.value).toHaveLength(3);
      expect(api.searchGifs).toHaveBeenCalledWith('', 'top28', 40, 2);
    });

    it('should yield first page of top section via searchGifs', async () => {
      const result = createSearchResult(2);
      (api.searchGifs as any).mockReturnValue(of(result));

      const gen = homeFeedGenerator(api as RedgifsApiService, 'top')();
      const first = await gen.next();

      expect(first.done).toBe(false);
      expect(api.searchGifs).toHaveBeenCalledWith('', 'top', 40, 2);
    });

    it('should yield first page of score section via searchGifs', async () => {
      const result = createSearchResult(2);
      (api.searchGifs as any).mockReturnValue(of(result));

      const gen = homeFeedGenerator(api as RedgifsApiService, 'score')();
      const first = await gen.next();

      expect(first.done).toBe(false);
      expect(api.searchGifs).toHaveBeenCalledWith('', 'score', 40, 2);
    });

    it('should yield first page of latest section via searchGifs', async () => {
      const result = createSearchResult(2);
      (api.searchGifs as any).mockReturnValue(of(result));

      const gen = homeFeedGenerator(api as RedgifsApiService, 'latest')();
      const first = await gen.next();

      expect(first.done).toBe(false);
      expect(api.searchGifs).toHaveBeenCalledWith('', 'latest', 40, 2);
    });

    it('should fallback to trending for unknown section', async () => {
      const result = createSearchResult(2);
      (api.searchGifs as any).mockReturnValue(of(result));

      const gen = homeFeedGenerator(api as RedgifsApiService, 'unknown')();
      const first = await gen.next();

      expect(first.done).toBe(false);
      expect(api.searchGifs).toHaveBeenCalledWith('', 'trending', 40, 2);
    });

    it('should increment page on each yield', async () => {
      const page1 = createSearchResult(1, 5);
      const page2 = createSearchResult(1, 5);
      (api.getPopularFeed as any)
        .mockReturnValueOnce(of(page1))
        .mockReturnValueOnce(of(page2));

      const gen = homeFeedGenerator(api as RedgifsApiService, 'popular')();
      await gen.next();
      await gen.next();

      expect(api.getPopularFeed).toHaveBeenNthCalledWith(1, 'trending', 40, 2);
      expect(api.getPopularFeed).toHaveBeenNthCalledWith(2, 'trending', 40, 3);
    });

    it('should stop when empty gifs array returned', async () => {
      const result = createSearchResult(0);
      (api.getPopularFeed as any).mockReturnValue(of(result));

      const gen = homeFeedGenerator(api as RedgifsApiService, 'popular')();
      const first = await gen.next();

      expect(first.done).toBe(true);
    });

    it('should stop when page exceeds result.pages', async () => {
      const result = createSearchResult(2, 2);
      (api.getPopularFeed as any).mockReturnValue(of(result));

      const gen = homeFeedGenerator(api as RedgifsApiService, 'popular')();
      await gen.next();
      const second = await gen.next();

      expect(second.done).toBe(true);
    });
  });

  describe('creatorFeedGenerator', () => {
    it('should yield first page with correct params', async () => {
      const result = createCreatorResult(3, 10);
      (api.searchCreator as any).mockReturnValue(of(result));

      const gen = creatorFeedGenerator(api as RedgifsApiService, 'testuser', 'latest')();
      const first = await gen.next();

      expect(first.done).toBe(false);
      expect(first.value).toHaveLength(3);
      expect(api.searchCreator).toHaveBeenCalledWith('testuser', 2, 80, 'latest');
    });

    it('should stop when empty gifs returned', async () => {
      const result = createCreatorResult(0);
      (api.searchCreator as any).mockReturnValue(of(result));

      const gen = creatorFeedGenerator(api as RedgifsApiService, 'testuser', 'latest')();
      const first = await gen.next();

      expect(first.done).toBe(true);
    });
  });

  describe('searchFeedGenerator', () => {
    it('should call searchGifs when type is gifs', async () => {
      const result = createSearchResult(2, 5);
      (api.searchGifs as any).mockReturnValue(of(result));

      const gen = searchFeedGenerator(api as RedgifsApiService, 'test query', 'gifs')();
      const first = await gen.next();

      expect(first.done).toBe(false);
      expect(first.value).toHaveLength(2);
      expect(api.searchGifs).toHaveBeenCalledWith('test query', 'trending', 40, 2);
      expect(api.searchImages).not.toHaveBeenCalled();
    });

    it('should call searchImages when type is images', async () => {
      const result = createSearchResult(2, 5);
      (api.searchImages as any).mockReturnValue(of(result));

      const gen = searchFeedGenerator(api as RedgifsApiService, 'test query', 'images')();
      const first = await gen.next();

      expect(first.done).toBe(false);
      expect(first.value).toHaveLength(2);
      expect(api.searchImages).toHaveBeenCalledWith('test query', 'trending', 40, 2);
      expect(api.searchGifs).not.toHaveBeenCalled();
    });
  });

  describe('nicheFeedGenerator', () => {
    it('should yield first page with correct params', async () => {
      const result = createSearchResult(4, 8);
      (api.getNicheGifs as any).mockReturnValue(of(result));

      const gen = nicheFeedGenerator(api as RedgifsApiService, 'niche-123')();
      const first = await gen.next();

      expect(first.done).toBe(false);
      expect(first.value).toHaveLength(4);
      expect(api.getNicheGifs).toHaveBeenCalledWith('niche-123', 'trending', 40, 2);
    });

    it('should stop when empty gifs returned', async () => {
      const result = createSearchResult(0);
      (api.getNicheGifs as any).mockReturnValue(of(result));

      const gen = nicheFeedGenerator(api as RedgifsApiService, 'niche-123')();
      const first = await gen.next();

      expect(first.done).toBe(true);
    });
  });
});
