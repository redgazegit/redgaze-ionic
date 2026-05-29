import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CacheFragmentLoader } from './hls-cache-loader';

const TEST_URL = 'https://media.redgifs.com/TestId.m4s';

function createLoaderContext(overrides: Partial<any> = {}): any {
  return {
    url: TEST_URL,
    rangeStart: undefined,
    rangeEnd: undefined,
    ...overrides,
  };
}

function createLoaderConfig(): any {
  return {};
}

function createLoaderCallbacks(): { onSuccess: any; onError: any } {
  const onSuccess = vi.fn();
  const onError = vi.fn();
  return { onSuccess, onError };
}

describe('CacheFragmentLoader', () => {
  let loader: CacheFragmentLoader;
  let originalCaches: any;
  let originalFetch: any;
  let originalPerformanceNow: any;

  beforeEach(() => {
    originalCaches = (globalThis as any).caches;
    originalFetch = globalThis.fetch;
    originalPerformanceNow = performance.now;
    performance.now = vi.fn(() => 1000);
    vi.useFakeTimers();
  });

  afterEach(() => {
    (globalThis as any).caches = originalCaches;
    globalThis.fetch = originalFetch;
    performance.now = originalPerformanceNow;
    vi.useRealTimers();
    loader?.destroy();
  });

  describe('constructor and basic lifecycle', () => {
    it('should create instance with HlsConfig', () => {
      loader = new CacheFragmentLoader({} as any);
      expect(loader).toBeInstanceOf(CacheFragmentLoader);
    });

    it('should initialize stats with zeros', () => {
      loader = new CacheFragmentLoader({} as any);
      expect(loader.stats.loaded).toBe(0);
      expect(loader.stats.total).toBe(0);
      expect(loader.stats.aborted).toBe(false);
    });

    it('destroy should call abort and set stats', () => {
      loader = new CacheFragmentLoader({} as any);
      vi.spyOn(loader, 'abort');
      loader.destroy();
      expect(loader.abort).toHaveBeenCalledOnce();
    });

    it('abort should set aborted flag and null abortController', () => {
      loader = new CacheFragmentLoader({} as any);
      loader.abort();
      expect(loader.stats.aborted).toBe(true);
    });

    it('getCacheAge should return null', () => {
      loader = new CacheFragmentLoader({} as any);
      expect(loader.getCacheAge()).toBeNull();
    });

    it('getResponseHeader should return null', () => {
      loader = new CacheFragmentLoader({} as any);
      expect(loader.getResponseHeader('Content-Type')).toBeNull();
    });
  });

  describe('load without Cache API', () => {
    beforeEach(() => {
      (globalThis as any).caches = undefined;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      });
    });

    it('should fetch and call onSuccess when caches is undefined', async () => {
      loader = new CacheFragmentLoader({} as any);
      const context = createLoaderContext();
      const config = createLoaderConfig();
      const callbacks = createLoaderCallbacks();

      await loader.load(context, config, callbacks);

      expect(globalThis.fetch).toHaveBeenCalledWith(TEST_URL, expect.objectContaining({}));
      expect(callbacks.onSuccess).toHaveBeenCalledOnce();
      const [payload] = callbacks.onSuccess.mock.calls[0];
      expect(payload.url).toBe(TEST_URL);
      expect(payload.code).toBe(200);
      expect(loader.stats.loaded).toBe(10);
      expect(loader.stats.total).toBe(10);
    });

    it('should call onError when fetch fails without Cache API', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });
      loader = new CacheFragmentLoader({} as any);
      const context = createLoaderContext();
      const config = createLoaderConfig();
      const callbacks = createLoaderCallbacks();

      await loader.load(context, config, callbacks);

      expect(callbacks.onError).toHaveBeenCalledOnce();
      const [errPayload] = callbacks.onError.mock.calls[0];
      expect(errPayload.code).toBe(0);
    });
  });

  describe('load with Cache API', () => {
    let mockCache: any;
    let mockCacheStorage: any;

    beforeEach(() => {
      mockCache = {
        match: vi.fn(),
        put: vi.fn(),
      };
      mockCacheStorage = {
        open: vi.fn().mockResolvedValue(mockCache),
      };
      (globalThis as any).caches = mockCacheStorage;
      globalThis.fetch = vi.fn();
    });

    it('should serve from cache on cache hit (no range)', async () => {
      const cachedData = new ArrayBuffer(20);
      mockCache.match.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(cachedData),
      });
      globalThis.fetch = vi.fn();

      loader = new CacheFragmentLoader({} as any);
      const context = createLoaderContext();
      const config = createLoaderConfig();
      const callbacks = createLoaderCallbacks();

      await loader.load(context, config, callbacks);

      expect(mockCache.match).toHaveBeenCalledWith(TEST_URL);
      expect(callbacks.onSuccess).toHaveBeenCalledOnce();
      const [payload] = callbacks.onSuccess.mock.calls[0];
      expect(payload.code).toBe(206);
      expect(payload.data.byteLength).toBe(20);
      expect(loader.stats.loaded).toBe(20);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('should serve sliced data from cache when range is specified', async () => {
      const fullData = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).buffer;
      mockCache.match.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(fullData),
      });

      loader = new CacheFragmentLoader({} as any);
      const context = createLoaderContext({ rangeStart: 2, rangeEnd: 7 });
      const config = createLoaderConfig();
      const callbacks = createLoaderCallbacks();

      await loader.load(context, config, callbacks);

      const [payload] = callbacks.onSuccess.mock.calls[0];
      expect(payload.data.byteLength).toBe(5);
    });

    it('should fetch and cache on cache miss (no range)', async () => {
      mockCache.match.mockResolvedValue(undefined);
      const responseBody = new ArrayBuffer(15);
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(responseBody),
        clone: () => ({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(15)) }),
      });

      loader = new CacheFragmentLoader({} as any);
      const context = createLoaderContext();
      const config = createLoaderConfig();
      const callbacks = createLoaderCallbacks();

      await loader.load(context, config, callbacks);

      expect(globalThis.fetch).toHaveBeenCalledWith(TEST_URL, expect.any(Object));
      expect(mockCache.put).toHaveBeenCalledWith(TEST_URL, expect.any(Object));
      expect(callbacks.onSuccess).toHaveBeenCalledOnce();
      const [payload] = callbacks.onSuccess.mock.calls[0];
      expect(payload.code).toBe(200);
      expect(payload.data.byteLength).toBe(15);
    });

    it('should fetch and cache on cache miss (with range)', async () => {
      mockCache.match.mockResolvedValue(undefined);
      const rangeResponseBody = new ArrayBuffer(5);
      const fullResponseBody = new ArrayBuffer(20);

      let fetchCallCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        fetchCallCount++;
        if (fetchCallCount === 1) {
          return Promise.resolve({
            ok: true,
            status: 206,
            arrayBuffer: () => Promise.resolve(rangeResponseBody),
          });
        }
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(fullResponseBody),
        });
      });

      loader = new CacheFragmentLoader({} as any);
      const context = createLoaderContext({ rangeStart: 0, rangeEnd: 5 });
      const config = createLoaderConfig();
      const callbacks = createLoaderCallbacks();

      await loader.load(context, config, callbacks);

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      expect(mockCache.put).toHaveBeenCalledWith(TEST_URL, expect.any(Object));
      expect(callbacks.onSuccess).toHaveBeenCalledOnce();
      const [payload] = callbacks.onSuccess.mock.calls[0];
      expect(payload.code).toBe(206);
      expect(payload.data.byteLength).toBe(5);
    });

    it('should add Range header when rangeEnd specified', async () => {
      mockCache.match.mockResolvedValue(undefined);
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
        clone: () => ({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) }),
      });

      loader = new CacheFragmentLoader({} as any);
      const context = createLoaderContext({ rangeStart: 10, rangeEnd: 20 });
      const config = createLoaderConfig();
      const callbacks = createLoaderCallbacks();

      await loader.load(context, config, callbacks);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        TEST_URL,
        expect.objectContaining({
          headers: { Range: 'bytes=10-19' },
        })
      );
    });

    it('should silently swallow AbortError', async () => {
      mockCache.match.mockRejectedValue(new DOMException('Aborted', 'AbortError'));

      loader = new CacheFragmentLoader({} as any);
      const context = createLoaderContext();
      const config = createLoaderConfig();
      const callbacks = createLoaderCallbacks();

      await loader.load(context, config, callbacks);

      expect(callbacks.onError).not.toHaveBeenCalled();
      expect(callbacks.onSuccess).not.toHaveBeenCalled();
    });

    it('should call onError for non-Abort fetch failures', async () => {
      mockCache.match.mockResolvedValue(undefined);
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

      loader = new CacheFragmentLoader({} as any);
      const context = createLoaderContext();
      const config = createLoaderConfig();
      const callbacks = createLoaderCallbacks();

      await loader.load(context, config, callbacks);

      expect(callbacks.onError).toHaveBeenCalledOnce();
      const [errPayload] = callbacks.onError.mock.calls[0];
      expect(errPayload.text).toContain('Network failure');
    });
  });
});
