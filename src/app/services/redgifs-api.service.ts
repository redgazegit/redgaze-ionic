import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, from, of, throwError, timer } from 'rxjs';
import { switchMap, map, tap, catchError } from 'rxjs/operators';
import { SettingsService } from './settings.service';
import { API_CONFIG } from './api-config';
import {
  Gif, Creator, User, Niche, TagSuggestion,
  SearchResult, CreatorResult, NicheResult, TempToken,
  ContentViewedEvent, ViewedDurationEvent, RefreshResult, NicheInfo, Tag
} from '../models/gif.model';

@Injectable({ providedIn: 'root' })
export class RedgifsApiService {
  private http = inject(HttpClient);
  private settings = inject(SettingsService);
  private config = inject(API_CONFIG);

  private readonly TOKEN_KEY = 'redgifs_token';
  private readonly EXPIRY_KEY = 'redgifs_token_expiry';
  private readonly TOKEN_TTL = 23 * 60 * 60 * 1000;
  private readonly MIN_GAP = 1000;
  private token: string | null = null;
  private tokenExpiry = 0;
  private lastRequest = 0;
  private backoffUntil = 0;

  constructor() {
    this.loadToken();
  }

  private loadToken(): void {
    try {
      const t = localStorage.getItem(this.TOKEN_KEY);
      const e = localStorage.getItem(this.EXPIRY_KEY);
      if (t && e && Date.now() < Number(e)) {
        this.token = t;
        this.tokenExpiry = Number(e);
      }
    } catch { /* ignore */ }
  }

  private headers(): HttpHeaders {
    let h = new HttpHeaders({
      'Accept': 'application/json'
    });
    if (this.token) {
      h = h.set('Authorization', `Bearer ${this.token}`);
    }
    return h;
  }

  private ensureAuth(): Observable<boolean> {
    if (this.token && Date.now() < this.tokenExpiry) return of(true);
    return this.http.get<TempToken>(`${this.config.baseUrl}/v2/auth/temporary`, {
      headers: new HttpHeaders({ 'Accept': 'application/json' })
    }).pipe(
      tap(t => {
        this.token = t.token;
        this.tokenExpiry = Date.now() + this.TOKEN_TTL;
        localStorage.setItem(this.TOKEN_KEY, this.token);
        localStorage.setItem(this.EXPIRY_KEY, String(this.tokenExpiry));
      }),
      map(() => true),
      catchError(err => {
        console.error('Auth error details:', err.status, err.statusText, err.url ?? err.message);
        return throwError(() => new Error('Auth failed'));
      })
    );
  }

  private waitForSlot(): Observable<void> {
    if (!this.settings.get().rateLimitEnabled) return of(undefined);
    const now = Date.now();
    const wait = Math.max(this.backoffUntil - now, this.lastRequest + this.MIN_GAP - now);
    this.lastRequest = Date.now();
    if (wait <= 0) return of(undefined);
    return timer(wait).pipe(map(() => undefined));
  }

  private get<T>(path: string): Observable<T> {
    return this.ensureAuth().pipe(
      switchMap(() => this.waitForSlot().pipe(
        switchMap(() => this.http.get<T>(`${this.config.baseUrl}${path}`, { headers: this.headers(), observe: 'response' }).pipe(
          map(r => { const b = r.body as any; if (b?.error) throw new HttpErrorResponse({ error: b.error, status: r.status, statusText: r.statusText, url: r.url ?? undefined }); return b as T; }),
          catchError(err => {
            if (err.status === 429 && this.settings.get().rateLimitEnabled) {
              const s = parseInt(err.headers?.get('Retry-After') || '5', 10);
              this.backoffUntil = Date.now() + s * 1000 + 1000;
              return this.get<T>(path);
            }
            if (err.status === 401 || err.status === 403) {
              this.token = null;
              this.tokenExpiry = 0;
              localStorage.removeItem(this.TOKEN_KEY);
              localStorage.removeItem(this.EXPIRY_KEY);
              return this.get<T>(path);
            }
            return throwError(() => err);
          })
        ))
      ))
    );
  }

  getAllTags(forceRefresh = false): Observable<Tag[]> {
    const cached = localStorage.getItem('redgifs_tags');
    if (!forceRefresh && cached) {
      try { return of(JSON.parse(cached)); } catch { /* fall through */ }
    }
    return this.get<{ tags: Tag[] }>('/v1/tags').pipe(
      map(r => r.tags),
      tap(tags => localStorage.setItem('redgifs_tags', JSON.stringify(tags)))
    );
  }

  getCachedTags(): Tag[] {
    try { return JSON.parse(localStorage.getItem('redgifs_tags') || '[]'); } catch { return []; }
  }

  searchCreators(
    page = 1, order = 'trending', verified?: boolean, tags?: string[]
  ): Observable<{ creators: Creator[]; page: number; pages: number; total: number }> {
    let path = `/v1/creators/search?page=${page}&order=${order}`;
    if (verified !== undefined) path += '&verified=' + (verified ? 'y' : 'n');
    if (tags?.length) path += '&tags=' + tags.join(',');
    return this.get<{ items: Creator[]; page: number; pages: number; total: number }>(path).pipe(
      map(r => ({ creators: r.items, page: r.page, pages: r.pages, total: r.total }))
    );
  }

  shareUrl(gif: Gif): string {
    return `${this.config.redgifsDomain}/watch/${gif.id}`;
  }

  embedUrl(gif: Gif): string {
    return `${this.config.embedDomain}/i/${gif.id}.jpg`;
  }

  getTrendingGifs(): Observable<Gif[]> {
    return this.get<{ gifs: Gif[] }>('/v2/explore/trending-gifs').pipe(map(r => r.gifs));
  }

  getTrendingImages(): Observable<Gif[]> {
    return this.get<{ gifs: Gif[] }>('/v2/explore/trending-images').pipe(map(r => r.gifs));
  }

  getTopThisWeek(count = 30, page = 1, type: 'g' | 'i' = 'g'): Observable<SearchResult> {
    return this.get<{ gifs: Gif[]; page: number; pages: number; total: number }>(
      `/v2/gifs/search?order=top7&count=${count}&page=${page}&type=${type}`
    );
  }

  searchGifs(query: string, order = 'trending', count = 40, page = 1): Observable<SearchResult> {
    return this.get<{ gifs: Gif[]; page: number; pages: number; total: number }>(
      `/v2/gifs/search?type=g&order=${order}&count=${count}&page=${page}&tags=${encodeURIComponent(query)}`
    );
  }

  searchImages(query: string, order = 'trending', count = 40, page = 1): Observable<SearchResult> {
    return this.get<{ gifs: Gif[]; page: number; pages: number; total: number }>(
      `/v2/gifs/search?type=i&order=${order}&count=${count}&page=${page}&tags=${encodeURIComponent(query)}`
    );
  }

  getGif(id: string, users?: string): Observable<Gif> {
    let path = `/v2/gifs/${id}`;
    if (users) path += `?users=${users}`;
    return this.get<{ gif: Gif }>(path).pipe(map(r => r.gif));
  }

  getPopularFeed(order = 'trending', count = 40, page = 1): Observable<SearchResult> {
    return this.get<{ gifs: Gif[]; page: number; pages: number; total: number }>(
      `/v2/feeds/trending/popular?order=${order}&count=${count}&page=${page}`
    );
  }

  getCreatorSuggestions(query: string, count = 10, order = 'trending'): Observable<Creator[]> {
    return this.get<{ items: Creator[] }>(
      `/v2/creators/suggest?query=${encodeURIComponent(query)}&count=${count}&order=${order}`
    ).pipe(map(r => r.items));
  }

  refreshGifs(ids: string[], users?: string[]): Observable<RefreshResult> {
    let path = `/v2/gifs?ids=${ids.join(',')}`;
    if (users?.length) path += `&users=${users.join(',')}`;
    return this.get<RefreshResult>(path);
  }

  private post<T>(path: string, body: unknown): Observable<T> {
    return this.ensureAuth().pipe(
      switchMap(() => this.waitForSlot().pipe(
        switchMap(() => this.http.post<T>(`${this.config.baseUrl}${path}`, body, { headers: this.headers(), observe: 'response' }).pipe(
          map(r => { const b = r.body as any; if (b?.error) throw new HttpErrorResponse({ error: b.error, status: r.status, statusText: r.statusText, url: r.url ?? undefined }); return b as T; }),
          catchError(err => {
            if (err.status === 429 && this.settings.get().rateLimitEnabled) {
              const s = parseInt(err.headers?.get('Retry-After') || '5', 10);
              this.backoffUntil = Date.now() + s * 1000 + 1000;
              return this.post<T>(path, body);
            }
            if (err.status === 401 || err.status === 403) {
              this.token = null;
              this.tokenExpiry = 0;
              localStorage.removeItem(this.TOKEN_KEY);
              localStorage.removeItem(this.EXPIRY_KEY);
              return this.post<T>(path, body);
            }
            return throwError(() => err);
          })
        ))
      ))
    );
  }

  trackContentViewed(gifId: string, client = 'redgaze-ionic/1.0'): Observable<unknown> {
    const event: ContentViewedEvent = { gif: gifId, event: 'viewed', client };
    return this.post('/v2/metrics/gifs', event);
  }

  trackViewedDuration(gifId: string, durationMs: number, client = 'redgaze-ionic/1.0'): Observable<unknown> {
    const event: ViewedDurationEvent = { gif: gifId, event: 'duration', duration: durationMs, client };
    return this.post('/v2/metrics/gifs', event);
  }

  getTrendingTags(forceRefresh = false): Observable<Tag[]> {
    const cached = localStorage.getItem('redgifs_trending_tags');
    if (!forceRefresh && cached) {
      try { return of(JSON.parse(cached)); } catch { /* fall through */ }
    }
    return this.get<{ tags: Tag[] }>('/v2/tags/trending').pipe(
      map(r => r.tags),
      tap(tags => localStorage.setItem('redgifs_trending_tags', JSON.stringify(tags)))
    );
  }

  getCachedTrendingTags(): TagSuggestion[] {
    try { return JSON.parse(localStorage.getItem('redgifs_trending_tags') || '[]'); } catch { return []; }
  }

  getTagSuggestions(query: string, count = 10): Observable<TagSuggestion[]> {
    return this.get<TagSuggestion[]>(
      `/v2/search/suggest?query=${encodeURIComponent(query)}&count=${count}`
    );
  }

  getTopThisWeekLegacy(): Observable<SearchResult> {
    return this.get<{ gifs: Gif[]; page: number; pages: number; total: number }>(
      '/v2/explore/top-this-week'
    );
  }

  getNicheInfo(nicheId: string): Observable<NicheInfo> {
    return this.get<NicheInfo>(`/v2/niches/${nicheId}`);
  }

  getNicheTrending(forceRefresh = false): Observable<Niche[]> {
    const cached = localStorage.getItem('redgifs_trending_niches');
    if (!forceRefresh && cached) {
      try { return of(JSON.parse(cached)); } catch { /* fall through */ }
    }
    return this.get<{ niches: Niche[] }>('/v2/niches/trending').pipe(
      map(r => r.niches),
      tap(n => localStorage.setItem('redgifs_trending_niches', JSON.stringify(n)))
    );
  }

  getCachedTrendingNiches(): Niche[] {
    try { return JSON.parse(localStorage.getItem('redgifs_trending_niches') || '[]'); } catch { return []; }
  }

  getNicheGifs(nicheId: string, order = 'trending', count = 40, page = 1): Observable<SearchResult> {
    return this.get<{ gifs: Gif[]; page: number; pages: number; total: number }>(
      `/v2/niches/${nicheId}/gifs?order=${order}&count=${count}&page=${page}`
    );
  }

  searchNiches(query: string, order = 'best_match', count = 40, page = 1): Observable<NicheResult> {
    return this.get<NicheResult>(
      `/v2/niches/search?query=${encodeURIComponent(query)}&order=${order}&count=${count}&page=${page}`
    );
  }

  getTrendingCreators(forceRefresh = false): Observable<Creator[]> {
    const cached = localStorage.getItem('redgifs_trending_creators');
    if (!forceRefresh && cached) {
      try { return of(JSON.parse(cached)); } catch { /* fall through */ }
    }
    return this.get<{ items: Creator[] }>('/v1/creators/trending').pipe(
      map(r => r.items || []),
      tap(c => localStorage.setItem('redgifs_trending_creators', JSON.stringify(c)))
    );
  }

  getCachedTrendingCreators(): Creator[] {
    try { return JSON.parse(localStorage.getItem('redgifs_trending_creators') || '[]'); } catch { return []; }
  }

  getVerifiedCreators(): Observable<Creator[]> {
    return this.get<{ creators: Creator[] }>('/v2/creators/verified').pipe(map(r => r.creators));
  }

  searchCreator(username: string, page = 1, count = 80, order = 'recent', type: 'g' | 'i' = 'g'): Observable<CreatorResult> {
    return this.get<{ gifs: Gif[]; user: User; page: number; pages: number }>(
      `/v2/users/${encodeURIComponent(username)}/search?page=${page}&count=${count}&order=${order}&type=${type}`
    );
  }

  getUser(username: string): Observable<User> {
    return this.get<User>(`/v1/users/${encodeURIComponent(username)}`);
  }

  downloadUrl(gif: Gif): string {
    return gif.urls.hd || gif.urls.sd;
  }

  proxyUrl(url: string): string {
    return url?.replace('https://media.redgifs.com', this.config.cdnDomain);
  }

  proxyUserpicUrl(url: string | undefined | null): string {
    return url?.replace('https://userpic.redgifs.com', this.config.userpicDomain) || 'assets/default-avatar.svg';
  }

  async cachedMediaUrl(url: string): Promise<string> {
    const proxyUrl = this.proxyUrl(url);
    if (typeof caches === 'undefined') return proxyUrl;
    try {
      const cache = await caches.open('redgaze-media-v1');
      const cached = await cache.match(proxyUrl);
      if (cached) {
        const blob = await cached.blob();
        return URL.createObjectURL(blob);
      }
      const response = await fetch(proxyUrl);
      if (!response.ok) return proxyUrl;
      await cache.put(proxyUrl, response.clone());
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch {
      return proxyUrl;
    }
  }

  hlsUrl(gifId: string, quality: 'hd' | 'sd' = 'hd'): string {
    return `${this.config.baseUrl}/v2/gifs/${gifId}/${quality}.m3u8`;
  }

  getToken(): string | null {
    return this.token;
  }

  ensureAuthToken(): Promise<string> {
    return new Promise(resolve => {
      this.ensureAuth().subscribe(() => resolve(this.token!));
    });
  }
}
