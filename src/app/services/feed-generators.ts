import { firstValueFrom } from 'rxjs';
import { RedgifsApiService } from './redgifs-api.service';
import { Gif, SearchResult, CreatorResult } from '../models/gif.model';

export function homeFeedGenerator(
  api: RedgifsApiService,
  section: string
): () => AsyncGenerator<Gif[], void, void> {
  return async function* () {
    let page = 2;
    while (true) {
      let result: SearchResult;
      switch (section) {
        case 'popular':
          result = await firstValueFrom(api.getPopularFeed('trending', 40, page));
          break;
        case 'top-week':
          result = await firstValueFrom(api.getTopThisWeek(30, page));
          break;
        case 'top28':
          result = await firstValueFrom(api.searchGifs('', 'top28', 40, page));
          break;
        case 'top':
          result = await firstValueFrom(api.searchGifs('', 'top', 40, page));
          break;
        case 'score':
          result = await firstValueFrom(api.searchGifs('', 'score', 40, page));
          break;
        case 'latest':
          result = await firstValueFrom(api.searchGifs('', 'latest', 40, page));
          break;
        default:
          result = await firstValueFrom(api.searchGifs('', 'trending', 40, page));
      }
      if (!result.gifs.length) return;
      yield result.gifs;
      page++;
      if (result.pages && page > result.pages) return;
    }
  };
}

export function creatorFeedGenerator(
  api: RedgifsApiService,
  username: string,
  order: string
): () => AsyncGenerator<Gif[], void, void> {
  return async function* () {
    let page = 2;
    while (true) {
      const result: CreatorResult = await firstValueFrom(
        api.searchCreator(username, page, 80, order)
      );
      if (!result.gifs.length) return;
      yield result.gifs;
      page++;
      if (result.pages && page > result.pages) return;
    }
  };
}

export function searchFeedGenerator(
  api: RedgifsApiService,
  query: string,
  type: 'gifs' | 'images'
): () => AsyncGenerator<Gif[], void, void> {
  return async function* () {
    let page = 2;
    while (true) {
      const result: SearchResult = await firstValueFrom(
        type === 'gifs'
          ? api.searchGifs(query, 'trending', 40, page)
          : api.searchImages(query, 'trending', 40, page)
      );
      if (!result.gifs.length) return;
      yield result.gifs;
      page++;
      if (result.pages && page > result.pages) return;
    }
  };
}

export function nicheFeedGenerator(
  api: RedgifsApiService,
  nicheId: string
): () => AsyncGenerator<Gif[], void, void> {
  return async function* () {
    let page = 2;
    while (true) {
      const result: SearchResult = await firstValueFrom(
        api.getNicheGifs(nicheId, 'trending', 40, page)
      );
      if (!result.gifs.length) return;
      yield result.gifs;
      page++;
      if (result.pages && page > result.pages) return;
    }
  };
}
