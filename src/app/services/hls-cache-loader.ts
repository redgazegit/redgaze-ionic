import type {
  Loader,
  FragmentLoaderContext,
  LoaderConfiguration,
  LoaderCallbacks,
  LoaderStats,
  HlsConfig,
} from 'hls.js';

const CACHE_NAME = 'redview-media-v1';

export class CacheFragmentLoader implements Loader<FragmentLoaderContext> {
  private abortController: AbortController | null = null;

  context: FragmentLoaderContext | null = null;
  stats: LoaderStats = {
    aborted: false,
    loaded: 0,
    retry: 0,
    total: 0,
    chunkCount: 1,
    bwEstimate: 0,
    loading: { start: 0, first: 0, end: 0 },
    parsing: { start: 0, end: 0 },
    buffering: { start: 0, first: 0, end: 0 },
  };

  constructor(confg: HlsConfig) {}

  destroy(): void {
    this.abort();
  }

  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.stats.aborted = true;
  }

  async load(
    context: FragmentLoaderContext,
    config: LoaderConfiguration,
    callbacks: LoaderCallbacks<FragmentLoaderContext>
  ): Promise<void> {
    this.abortController = new AbortController();
    this.context = context;
    this.stats.aborted = false;
    this.stats.loading.start = performance.now();

    try {
      const url = context.url;
      const isRange = context.rangeEnd != null;
      const init: RequestInit = { signal: this.abortController.signal };
      if (context.rangeEnd != null) {
        init.headers = {
          Range: `bytes=${context.rangeStart ?? 0}-${context.rangeEnd - 1}`,
        };
      }

      if (typeof caches === 'undefined') {
        const response = await fetch(url, init);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        let data = await response.arrayBuffer();
        this.stats.loaded = data.byteLength;
        this.stats.total = data.byteLength;
        this.stats.loading.end = performance.now();
        callbacks.onSuccess({ url, data, code: response.status }, this.stats, context, null);
        return;
      }

      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(url);

      if (cached) {
        let data = await cached.arrayBuffer();
        if (context.rangeEnd != null) {
          data = data.slice(context.rangeStart ?? 0, context.rangeEnd);
        }
        this.stats.loaded = data.byteLength;
        this.stats.total = data.byteLength;
        this.stats.loading.end = performance.now();
        callbacks.onSuccess({ url, data, code: 206 }, this.stats, context, null);
        return;
      }

      const response = await fetch(url, init);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const cacheTarget = isRange
        ? await fetch(url, { signal: this.abortController.signal })
        : response.clone();
      if (cacheTarget.ok) {
        await cache.put(url, cacheTarget);
      }

      let data = await response.arrayBuffer();
      this.stats.loaded = data.byteLength;
      this.stats.total = data.byteLength;
      this.stats.loading.end = performance.now();
      callbacks.onSuccess({ url, data, code: response.status }, this.stats, context, null);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      this.stats.loading.end = performance.now();
      callbacks.onError({ code: 0, text: err.message || 'CacheFragmentLoader error' }, context, null, this.stats);
    }
  }

  getCacheAge(): number | null {
    return null;
  }

  getResponseHeader(name: string): string | null {
    return null;
  }
}
