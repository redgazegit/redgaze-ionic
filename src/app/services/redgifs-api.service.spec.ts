import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { RedgifsApiService } from './redgifs-api.service';
import { SettingsService } from './settings.service';
import { API_CONFIG, DEV_API_CONFIG } from './api-config';
import { testStorage } from '../../test-setup';

describe('RedgifsApiService', () => {
  let service: RedgifsApiService;
  let httpCtrl: HttpTestingController;

  function initService() {
    testStorage.clearAll();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        RedgifsApiService,
        SettingsService,
        { provide: API_CONFIG, useValue: DEV_API_CONFIG },
      ],
    });
    const settings = TestBed.inject(SettingsService);
    settings.update({ rateLimitEnabled: false, playbackMode: 'mp4', quality: 'hd', storiesNavigation: true, gridAutoplay: true });
    service = TestBed.inject(RedgifsApiService);
    httpCtrl = TestBed.inject(HttpTestingController);
  }

  const TOP_WEEK_PATH = '/api/v2/gifs/search?order=top7&count=30&page=1&type=g';

  function flushAuth(token = 'test-token') {
    const req = httpCtrl.expectOne('/api/v2/auth/temporary');
    expect(req.request.method).toBe('GET');
    req.flush({ token });
  }

  // ── Auth ───────────────────────────────────────────────────────

  it('should be created', () => {
    initService();
    expect(service).toBeTruthy();
  });

  it('should request auth token on first request', () => {
    initService();
    service.getTopThisWeek().subscribe();
    flushAuth();
    httpCtrl.expectOne(TOP_WEEK_PATH).flush({ gifs: [] });
  });

  it('should reuse token for subsequent requests', () => {
    initService();
    service.getTopThisWeek().subscribe();
    flushAuth();
    httpCtrl.expectOne(TOP_WEEK_PATH).flush({ gifs: [{ id: 'first' }] });

    service.getTopThisWeek().subscribe();
    httpCtrl.expectNone('/api/v2/auth/temporary');
    httpCtrl.expectOne(TOP_WEEK_PATH).flush({ gifs: [{ id: 'second' }] });
  });

  it('should share one auth request between concurrent callers', () => {
    initService();
    service.getTopThisWeek().subscribe();
    service.getTopThisWeek().subscribe();
    httpCtrl.expectOne('/api/v2/auth/temporary').flush({ token: 'shared-token' });
    const requests = httpCtrl.match(TOP_WEEK_PATH);
    expect(requests.length).toBe(2);
    requests.forEach(r => r.flush({ gifs: [] }));
  });

  it('should re-auth when token expires', () => {
    initService();
    service.getTopThisWeek().subscribe();
    flushAuth('first-token');
    httpCtrl.expectOne(TOP_WEEK_PATH).flush({ gifs: [{ id: 'ok' }] });

    (service as any).tokenExpiry = Date.now() - 1000;

    let result: any;
    service.getTopThisWeek().subscribe(r => result = r);
    flushAuth('second-token');
    const req = httpCtrl.expectOne(TOP_WEEK_PATH);
    expect(req.request.headers.get('Authorization')).toBe('Bearer second-token');
    req.flush({ gifs: [{ id: 'refreshed' }] });
    expect(result.gifs[0].id).toBe('refreshed');
  });

  it('should emit error when auth fails', () => {
    initService();
    let error: any;
    service.getTopThisWeek().subscribe({ error: err => error = err });
    httpCtrl.expectOne('/api/v2/auth/temporary')
      .flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    expect(error.message).toBe('Auth failed');
  });

  it('should respect the rate limiter gap before re-authenticating', fakeAsync(() => {
    initService();
    (TestBed.inject(SettingsService) as any).update({ rateLimitEnabled: true });

    service.getTopThisWeek().subscribe();
    httpCtrl.expectOne('/api/v2/auth/temporary').flush({ token: 'first-token' });
    tick(1000);
    httpCtrl.expectOne(TOP_WEEK_PATH).flush({ gifs: [] });

    (service as any).tokenExpiry = Date.now() - 1;

    service.getTopThisWeek().subscribe();
    expect(httpCtrl.match('/api/v2/auth/temporary').length).toBe(0);

    tick(1000);
    const authRequests = httpCtrl.match('/api/v2/auth/temporary');
    expect(authRequests.length).toBe(1);
    authRequests[0].flush({ token: 'second-token' });

    tick(2000);
    httpCtrl.expectOne(TOP_WEEK_PATH).flush({ gifs: [] });
    expect(service.getToken()).toBe('second-token');
  }));

  it('should share a single queued auth request between concurrent callers', fakeAsync(() => {
    initService();
    (TestBed.inject(SettingsService) as any).update({ rateLimitEnabled: true });

    service.getTopThisWeek().subscribe();
    service.getTopThisWeek().subscribe();

    const authRequests = httpCtrl.match('/api/v2/auth/temporary');
    expect(authRequests.length).toBe(1);
    authRequests[0].flush({ token: 'shared-token' });

    tick(2000);
    for (const req of httpCtrl.match(TOP_WEEK_PATH)) {
      req.flush({ gifs: [] });
    }
    tick(5000);
  }));

  it('should retry auth on 429 with Retry-After', fakeAsync(() => {
    initService();
    (TestBed.inject(SettingsService) as any).update({ rateLimitEnabled: true });

    service.getTopThisWeek().subscribe();
    tick(0);
    httpCtrl.expectOne('/api/v2/auth/temporary')
      .flush('Rate limited', { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '0' } });

    tick(2000);
    httpCtrl.expectOne('/api/v2/auth/temporary').flush({ token: 'retry-token' });
    tick(2000);
    httpCtrl.expectOne(TOP_WEEK_PATH).flush({ gifs: [] });

    expect(service.getToken()).toBe('retry-token');
  }));

  it('should stop retrying auth 429 after MAX_RETRIES and reject', fakeAsync(() => {
    initService();
    (TestBed.inject(SettingsService) as any).update({ rateLimitEnabled: true });

    let error: any;
    service.getTopThisWeek().subscribe({ error: err => error = err });
    tick(0);

    for (let i = 0; i < 4; i++) {
      httpCtrl.expectOne('/api/v2/auth/temporary')
        .flush('Rate limited', { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '0' } });
      tick(3000);
    }

    expect(error.message).toBe('Auth failed');
  }));

  // ── GET endpoints ──────────────────────────────────────────────


  it('should search gifs with query params', () => {
    initService();
    service.searchGifs('funny cats', 'trending', 40, 1).subscribe();
    flushAuth();
    httpCtrl.expectOne('/api/v2/gifs/search?type=g&order=trending&count=40&page=1&tags=funny%20cats')
      .flush({ gifs: [], page: 1, pages: 1, total: 0 });
  });

  it('should get single gif by id', () => {
    initService();
    let result: any;
    service.getGif('test-id').subscribe(r => result = r);
    flushAuth();
    httpCtrl.expectOne('/api/v2/gifs/test-id').flush({ gif: { id: 'test-id', userName: 'u' } });
    expect(result.id).toBe('test-id');
  });

  it('should get popular feed with pagination', () => {
    initService();
    let result: any;
    service.getPopularFeed('trending', 40, 2).subscribe(r => result = r);
    flushAuth();
    httpCtrl.expectOne('/api/v2/feeds/trending/popular?order=trending&count=40&page=2')
      .flush({ gifs: [], page: 2, pages: 10, total: 100 });
    expect(result.page).toBe(2);
  });

  it('should get creator suggestions', () => {
    initService();
    let result: any;
    service.getCreatorSuggestions('test', 5).subscribe(r => result = r);
    flushAuth();
    httpCtrl.expectOne('/api/v2/creators/suggest?query=test&count=5&order=trending')
      .flush({ items: [{ name: 'Creator1' }] });
    expect(result.length).toBe(1);
  });

  it('should get user info', () => {
    initService();
    let result: any;
    service.getUser('testuser').subscribe(r => result = r);
    flushAuth();
    httpCtrl.expectOne('/api/v1/users/testuser').flush({ name: 'testuser' });
    expect(result.name).toBe('testuser');
  });

  it('should get trending tags', () => {
    initService();
    service.getTrendingTags().subscribe();
    flushAuth();
    httpCtrl.expectOne('/api/v2/tags/trending').flush({ tags: [{ text: 'funny', type: 'tag', gifs: [] }] });
  });

  it('should return cached trending tags from localStorage', () => {
    initService();
    localStorage.setItem('redgifs_trending_tags', JSON.stringify([{ text: 'cached-tag', type: 'tag', gifs: [] }]));
    let result: any;
    service.getTrendingTags().subscribe(r => result = r);
    httpCtrl.expectNone('/api/v2/auth/temporary');
    expect(result).toEqual([{ text: 'cached-tag', type: 'tag', gifs: [] }]);
  });

  it('should get trending creators', () => {
    initService();
    service.getTrendingCreators().subscribe();
    flushAuth();
    httpCtrl.expectOne('/api/v1/creators/trending').flush({ items: [{ name: 'Creator1' }] });
  });

  it('should return cached trending creators from localStorage', () => {
    initService();
    localStorage.setItem('redgifs_trending_creators', JSON.stringify([{ name: 'CachedCreator' }]));
    let result: any;
    service.getTrendingCreators().subscribe(r => result = r);
    httpCtrl.expectNone('/api/v1/creators/trending');
    expect(result[0].name).toBe('CachedCreator');
  });

  it('should get trending niches', () => {
    initService();
    service.getNicheTrending().subscribe();
    flushAuth();
    httpCtrl.expectOne('/api/v2/niches/trending').flush({ niches: [{ name: 'funny' }] });
  });

  it('should return cached trending niches from localStorage', () => {
    initService();
    localStorage.setItem('redgifs_trending_niches', JSON.stringify([{ name: 'CachedNiche' }]));
    let result: any;
    service.getNicheTrending().subscribe(r => result = r);
    httpCtrl.expectNone('/api/v2/niches/trending');
    expect(result[0].name).toBe('CachedNiche');
  });

  it('should get niche gifs with params', () => {
    initService();
    service.getNicheGifs('niche-1', '', 20, 1).subscribe();
    flushAuth();
    httpCtrl.expectOne('/api/v2/niches/niche-1/gifs?count=20&page=1').flush({ gifs: [] });
  });

  it('should search niches', () => {
    initService();
    service.searchNiches('funny').subscribe();
    flushAuth();
    httpCtrl.expectOne('/api/v2/niches/search?query=funny&order=best_match&count=40&page=1').flush({ niches: [] });
  });

  it('should get verified creators', () => {
    initService();
    service.getVerifiedCreators().subscribe();
    flushAuth();
    httpCtrl.expectOne('/api/v2/creators/verified').flush({ creators: [] });
  });

  it('should search creator with params', () => {
    initService();
    service.searchCreator('testuser', 1, 80, 'recent', 'g').subscribe();
    flushAuth();
    httpCtrl.expectOne('/api/v2/users/testuser/search?page=1&count=80&order=recent&type=g')
      .flush({ gifs: [], user: {} });
  });

  it('should get top this week', () => {
    initService();
    service.getTopThisWeek(30, 1, 'g').subscribe();
    flushAuth();
    httpCtrl.expectOne('/api/v2/gifs/search?order=top7&count=30&page=1&type=g').flush({ gifs: [] });
  });

  it('should get niche info', () => {
    initService();
    service.getNicheInfo('niche-1').subscribe();
    flushAuth();
    httpCtrl.expectOne('/api/v2/niches/niche-1').flush({ name: 'Niche1' });
  });

  it('should get tag suggestions', () => {
    initService();
    service.getTagSuggestions('fun', 5).subscribe();
    flushAuth();
    httpCtrl.expectOne('/api/v2/search/suggest?query=fun&count=5').flush([]);
  });

  it('should search creators', () => {
    initService();
    service.searchCreators(1, 'trending', true, ['funny']).subscribe();
    flushAuth();
    httpCtrl.expectOne('/api/v1/creators/search?page=1&order=trending&verified=y&tags=funny')
      .flush({ items: [], page: 1, pages: 1, total: 0 });
  });

  it('should pass a supported niche order when provided', () => {
    initService();
    service.getNicheGifs('niche-1', 'top', 20, 1).subscribe();
    flushAuth();
    httpCtrl.expectOne('/api/v2/niches/niche-1/gifs?count=20&page=1&order=top').flush({ gifs: [] });
  });

  // ── Retry logic ────────────────────────────────────────────────

  it('should retry on 429 with Retry-After', fakeAsync(() => {
    initService();
    (TestBed.inject(SettingsService) as any).update({ rateLimitEnabled: true });

    let result: any;
    service.getTopThisWeek().subscribe(r => result = r);
    flushAuth();
    tick(2000); // flush initial waitForSlot + request

    httpCtrl.expectOne(TOP_WEEK_PATH)
      .flush('Rate limited', { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '0' } });

    tick(2000); // flush backoff timer + retry

    httpCtrl.expectOne(TOP_WEEK_PATH).flush({ gifs: [{ id: 'retried' }] });
    expect(result.gifs[0].id).toBe('retried');
  }));

  it('should honour the delay carried in the RateLimited body', fakeAsync(() => {
    initService();
    (TestBed.inject(SettingsService) as any).update({ rateLimitEnabled: true });

    service.getTopThisWeek().subscribe(() => {});
    flushAuth();
    tick(2000);

    httpCtrl.expectOne(TOP_WEEK_PATH).flush(
      { error: { code: 'RateLimited', message: 'Too many requests, please retry later.', status: 429, delay: 4000, subject: '2a06:98c0:3600:0|gif-search|498307' } },
      { status: 429, statusText: 'Too Many Requests' }
    );

    tick(3000);
    httpCtrl.expectNone(TOP_WEEK_PATH);

    tick(2000);
    httpCtrl.expectOne(TOP_WEEK_PATH).flush({ gifs: [] });
  }));

  it('should fail fast when RedGIFs asks for a longer wait than we will retry', fakeAsync(() => {
    initService();
    (TestBed.inject(SettingsService) as any).update({ rateLimitEnabled: true });

    let error: any;
    service.getTopThisWeek().subscribe({ error: err => error = err });
    flushAuth();
    tick(2000);

    httpCtrl.expectOne(TOP_WEEK_PATH).flush(
      { error: { code: 'RateLimited', message: 'Too many requests, please retry later.', status: 429, delay: 416000, subject: '2a06:98c0:3600:0|niche-gifs|498307' } },
      { status: 429, statusText: 'Too Many Requests' }
    );

    tick(2000);
    httpCtrl.expectNone(TOP_WEEK_PATH);
    expect(error.status).toBe(429);
  }));

  it('should stop retrying 429 after MAX_RETRIES and emit the error', fakeAsync(() => {
    initService();
    (TestBed.inject(SettingsService) as any).update({ rateLimitEnabled: true });

    let error: any;
    service.getTopThisWeek().subscribe({ error: err => error = err });
    flushAuth();
    tick(2000);

    for (let i = 0; i < 4; i++) {
      httpCtrl.expectOne(TOP_WEEK_PATH)
        .flush('Rate limited', { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '0' } });
      tick(2000);
    }

    expect(error.status).toBe(429);
  }));

  it('should retry on 401 with token refresh', () => {
    initService();
    let result: any;
    service.getTopThisWeek().subscribe(r => result = r);
    flushAuth('first-token');
    httpCtrl.expectOne(TOP_WEEK_PATH)
      .flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    flushAuth('refreshed-token');
    const retryReq = httpCtrl.expectOne(TOP_WEEK_PATH);
    expect(retryReq.request.headers.get('Authorization')).toBe('Bearer refreshed-token');
    retryReq.flush({ gifs: [{ id: 'refreshed' }] });
    expect(result.gifs[0].id).toBe('refreshed');
  });

  it('should stop retrying 401 after one re-auth and emit the error', () => {
    initService();
    let error: any;
    service.getTopThisWeek().subscribe({ error: err => error = err });
    flushAuth('first-token');
    httpCtrl.expectOne(TOP_WEEK_PATH)
      .flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    flushAuth('second-token');
    httpCtrl.expectOne(TOP_WEEK_PATH)
      .flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    expect(error.status).toBe(401);
  });

  // ── Caching via localStorage ───────────────────────────────────

  it('should return cached allTags from localStorage', () => {
    initService();
    localStorage.setItem('redgifs_tags', JSON.stringify([{ name: 'funny', count: 100 }]));
    let result: any;
    service.getAllTags().subscribe(r => result = r);
    httpCtrl.expectNone('/api/v1/tags');
    expect(result).toEqual([{ name: 'funny', count: 100 }]);
  });

  it('should force-refresh allTags when requested', () => {
    initService();
    localStorage.setItem('redgifs_tags', JSON.stringify([{ name: 'stale', count: 0 }]));
    let result: any;
    service.getAllTags(true).subscribe(r => result = r);
    flushAuth();
    httpCtrl.expectOne('/api/v1/tags').flush({ tags: [{ name: 'fresh', count: 50 }] });
    expect(result[0].name).toBe('fresh');
  });

  // ── Utility methods ────────────────────────────────────────────

  it('should proxy URL by replacing cdn domain', () => {
    initService();
    expect(service.proxyUrl('https://media.redgifs.com/path/to/video.mp4')).toBe('/cdn/path/to/video.mp4');
  });

  it('should handle null/undefined in proxyUserpicUrl', () => {
    initService();
    expect(service.proxyUserpicUrl(null)).toBe('assets/default-avatar.svg');
    expect(service.proxyUserpicUrl(undefined)).toBe('assets/default-avatar.svg');
    expect(service.proxyUserpicUrl('https://userpic.redgifs.com/avatar.jpg')).toBe('/userpic/avatar.jpg');
  });

  it('should generate HLS URL', () => {
    initService();
    expect(service.hlsUrl('abc123', 'hd')).toBe('/api/v2/gifs/abc123/hd.m3u8');
    expect(service.hlsUrl('abc123', 'sd')).toBe('/api/v2/gifs/abc123/sd.m3u8');
  });

  it('should generate share URL', () => {
    initService();
    expect(service.shareUrl({ id: 'abc123' } as any)).toBe('https://www.redgifs.com/watch/abc123');
  });

  it('should generate embed URL', () => {
    initService();
    expect(service.embedUrl({ id: 'abc123' } as any)).toBe('https://i.redgifs.com/i/abc123.jpg');
  });

  it('should provide download URL from hd first, then sd', () => {
    initService();
    expect(service.downloadUrl({ urls: { hd: 'https://media.redgifs.com/hd.mp4', sd: '' } } as any))
      .toBe('https://media.redgifs.com/hd.mp4');
    expect(service.downloadUrl({ urls: { sd: 'https://media.redgifs.com/sd.mp4' } } as any))
      .toBe('https://media.redgifs.com/sd.mp4');
  });

  it('should get/set token from memory', () => {
    initService();
    expect(service.getToken()).toBeNull();
    service.getTopThisWeek().subscribe();
    flushAuth('mem-token');
    httpCtrl.expectOne(TOP_WEEK_PATH).flush({ gifs: [] });
    expect(service.getToken()).toBe('mem-token');
  });

  it('should resolve ensureAuthToken promise', async () => {
    initService();
    const tokenPromise = service.ensureAuthToken();
    flushAuth('promise-token');
    await expect(tokenPromise).resolves.toBe('promise-token');
  });

  it('should reject ensureAuthToken when auth fails', async () => {
    initService();
    const tokenPromise = service.ensureAuthToken();
    httpCtrl.expectOne('/api/v2/auth/temporary')
      .flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    await expect(tokenPromise).rejects.toThrow('Auth failed');
  });

  // ── cachedMediaUrl ──────────────────────────────────────────────

  it('should return proxyUrl when caches is undefined', async () => {
    initService();
    const origCaches = (globalThis as any).caches;
    (globalThis as any).caches = undefined;
    const result = await service.cachedMediaUrl('https://media.redgifs.com/vid.mp4');
    expect(result).toBe('/cdn/vid.mp4');
    (globalThis as any).caches = origCaches;
  });

  describe('cachedMediaUrl', () => {
    const mockCache = {
      match: vi.fn(),
      put: vi.fn(),
    };

    beforeEach(() => {
      (globalThis as any).caches = { open: vi.fn().mockResolvedValue(mockCache) };
    });

    afterEach(() => {
      delete (globalThis as any).caches;
    });

    it('should return cached blob URL when cache hit', async () => {
      initService();
      const blobUrl = 'blob:http://cached';
      const blob = new Blob(['test']);
      mockCache.match.mockResolvedValue(new Response(blob));
      vi.spyOn(URL, 'createObjectURL').mockReturnValue(blobUrl);

      const result = await service.cachedMediaUrl('https://media.redgifs.com/vid.mp4');
      expect(result).toBe(blobUrl);
      expect(mockCache.match).toHaveBeenCalledWith('/cdn/vid.mp4');
    });

    it('should fetch and cache on cache miss', async () => {
      initService();
      const blobUrl = 'blob:http://fetched';
      const blob = new Blob(['new-data']);
      mockCache.match.mockResolvedValue(undefined);
      vi.spyOn(URL, 'createObjectURL').mockReturnValue(blobUrl);
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(blob, { status: 200 }));

      const result = await service.cachedMediaUrl('https://media.redgifs.com/vid.mp4');
      expect(result).toBe(blobUrl);
      expect(fetchSpy).toHaveBeenCalledWith('/cdn/vid.mp4');
      expect(mockCache.put).toHaveBeenCalledWith('/cdn/vid.mp4', expect.any(Response));
    });

    it('should return proxyUrl on fetch failure', async () => {
      initService();
      mockCache.match.mockResolvedValue(undefined);
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));

      const result = await service.cachedMediaUrl('https://media.redgifs.com/vid.mp4');
      expect(result).toBe('/cdn/vid.mp4');
    });

    it('should return proxyUrl on cache error', async () => {
      initService();
      (globalThis as any).caches = { open: vi.fn().mockRejectedValue(new Error('cache unavailable')) };

      const result = await service.cachedMediaUrl('https://media.redgifs.com/vid.mp4');
      expect(result).toBe('/cdn/vid.mp4');
    });
  });

  // ── getCachedTrendingCreators ───────────────────────────────────

  it('should return cached trending creators from localStorage', () => {
    initService();
    localStorage.setItem('redgifs_trending_creators', JSON.stringify([{ name: 'StoredCreator' }]));
    const result = service.getCachedTrendingCreators();
    expect(result).toEqual([{ name: 'StoredCreator' }]);
  });

  it('should return empty array when no cached creators', () => {
    initService();
    localStorage.removeItem('redgifs_trending_creators');
    expect(service.getCachedTrendingCreators()).toEqual([]);
  });

  it('should return empty array on corrupt JSON', () => {
    initService();
    localStorage.setItem('redgifs_trending_creators', 'not-json');
    expect(service.getCachedTrendingCreators()).toEqual([]);
  });

  // ── Other uncovered methods ─────────────────────────────────────

  it('should getCachedTrendingTags', () => {
    initService();
    localStorage.setItem('redgifs_trending_tags', JSON.stringify([{ text: 'funny' }]));
    expect(service.getCachedTrendingTags()).toEqual([{ text: 'funny' }]);
  });

  it('should getCachedTrendingTags return empty on missing', () => {
    initService();
    localStorage.removeItem('redgifs_trending_tags');
    expect(service.getCachedTrendingTags()).toEqual([]);
  });

  it('should getCachedTrendingNiches', () => {
    initService();
    localStorage.setItem('redgifs_trending_niches', JSON.stringify([{ name: 'funny' }]));
    expect(service.getCachedTrendingNiches()).toEqual([{ name: 'funny' }]);
  });

  it('should getCachedTrendingNiches return empty on missing', () => {
    initService();
    localStorage.removeItem('redgifs_trending_niches');
    expect(service.getCachedTrendingNiches()).toEqual([]);
  });
});