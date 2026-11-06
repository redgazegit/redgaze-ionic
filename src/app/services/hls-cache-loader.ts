import type {
  Loader,
  FragmentLoaderContext,
  LoaderConfiguration,
  LoaderCallbacks,
  LoaderStats,
  HlsConfig,
} from 'hls.js';
import { Capacitor, CapacitorHttp, HttpResponse } from '@capacitor/core';

const CACHE_NAME = 'redgaze-media-v1';

type Fragment = { data: ArrayBuffer; code: number };

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
      const fragment = await this.fetchFragment(context);
      this.reportSuccess(fragment, context, callbacks);
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

  private fetchFragment(context: FragmentLoaderContext): Promise<Fragment> {
    if (Capacitor.isNativePlatform()) return this.fetchNative(context);
    if (typeof caches === 'undefined') return this.fetchDirect(context);
    return this.fetchViaCache(context);
  }

  private async fetchNative(context: FragmentLoaderContext): Promise<Fragment> {
    const headers: Record<string, string> = {};
    if (context.rangeEnd != null) {
      headers['Range'] = `bytes=${context.rangeStart ?? 0}-${context.rangeEnd - 1}`;
    }
    const res: HttpResponse = await CapacitorHttp.request({
      url: context.url,
      method: 'GET',
      headers,
      responseType: 'arraybuffer',
    });
    if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
    return { data: base64ToArrayBuffer(res.data as string), code: res.status };
  }

  private async fetchDirect(context: FragmentLoaderContext): Promise<Fragment> {
    const response = await fetch(context.url, this.requestInit(context));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { data: await response.arrayBuffer(), code: response.status };
  }

  private async fetchViaCache(context: FragmentLoaderContext): Promise<Fragment> {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(context.url);

    if (cached) {
      let data = await cached.arrayBuffer();
      if (context.rangeEnd != null) {
        data = data.slice(context.rangeStart ?? 0, context.rangeEnd);
      }
      return { data, code: 206 };
    }

    const response = await fetch(context.url, this.requestInit(context));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const cacheTarget = context.rangeEnd != null
      ? await fetch(context.url, { signal: this.abortController!.signal })
      : response.clone();
    if (cacheTarget.ok) {
      await cache.put(context.url, cacheTarget);
    }

    return { data: await response.arrayBuffer(), code: response.status };
  }

  private requestInit(context: FragmentLoaderContext): RequestInit {
    const init: RequestInit = { signal: this.abortController!.signal };
    if (context.rangeEnd != null) {
      init.headers = {
        Range: `bytes=${context.rangeStart ?? 0}-${context.rangeEnd - 1}`,
      };
    }
    return init;
  }

  private reportSuccess(
    fragment: Fragment,
    context: FragmentLoaderContext,
    callbacks: LoaderCallbacks<FragmentLoaderContext>,
  ): void {
    this.stats.loaded = fragment.data.byteLength;
    this.stats.total = fragment.data.byteLength;
    this.stats.loading.end = performance.now();
    callbacks.onSuccess({ url: context.url, data: fragment.data, code: fragment.code }, this.stats, context, null);
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    bytes[i] = byteChars.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}
