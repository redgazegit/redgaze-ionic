# Android HTTP Plan

## Problem

Relative URLs (`/api/...`, `/cdn/...`, `/userpic/...`) rely on server-side proxying
(Angular dev server / Vercel edge). On Android there's no proxy — requests hit `localhost` and fail.

## Design

Use Angular DI to inject platform-specific behavior — `RedgifsApiService` has zero branching.
Two DI tokens, provided in `main.ts`, swapped by platform.

```
main.ts (providers)
  ├─ ProxyUrlService          ← providedIn: 'root', auto-detects platform
  └─ HTTP_HANDLER (token)     ← factory: CapacitorHttp (native) | AngularHttp (web)

RedgifsApiService
  ├─ inject(HTTP_HANDLER)     ← no branching, no isNative check
  ├─ inject(ProxyUrlService)  ← URL transformation
  ├─ inject(HttpClient)       ← REMOVED — replaced by HTTP_HANDLER
  └─ get()/post() use this.http.get() → this.handler.get()
```

## What changes

### 1. `ProxyUrlService` — new (platform-aware URLs)

```typescript
@Injectable({ providedIn: 'root' })
export class ProxyUrlService {
  readonly isNative = !!(globalThis as any).Capacitor?.isNativePlatform();

  toApi(path: string): string {
    return this.isNative ? `https://api.redgifs.com${path}` : `/api${path}`;
  }

  toCdn(url: string): string {
    return this.isNative ? url : url?.replace('https://media.redgifs.com', '/cdn');
  }

  toUserpic(url: string | null | undefined): string {
    if (!url) return 'assets/default-avatar.svg';
    return this.isNative ? url : url.replace('https://userpic.redgifs.com', '/userpic');
  }

  nativeHeaders(): Record<string, string> {
    return this.isNative ? { Referer: 'https://www.redgifs.com/' } : {};
  }
}
```

### 2. `HTTP_HANDLER` injection token — new (platform-aware HTTP)

```typescript
// src/app/shared/http/http-handler.ts
import { InjectionToken } from '@angular/core';

export interface HttpHandler {
  get<T>(url: string, opts: { headers: HttpHeaders; observe: 'response' }): Observable<HttpResponse<T>>;
  post<T>(url: string, body: unknown, opts: { headers: HttpHeaders; observe: 'response' }): Observable<HttpResponse<T>>;
}

export const HTTP_HANDLER = new InjectionToken<HttpHandler>('HTTP_HANDLER');
```

### 3. `AngularHttp` — web implementation

```typescript
@Injectable()
export class AngularHttp implements HttpHandler {
  private http = inject(HttpClient);

  get<T>(url: string, opts: { headers: HttpHeaders; observe: 'response' }): Observable<HttpResponse<T>> {
    return this.http.get<T>(url, opts);
  }

  post<T>(url: string, body: unknown, opts: { headers: HttpHeaders; observe: 'response' }): Observable<HttpResponse<T>> {
    return this.http.post<T>(url, body, opts);
  }
}
```

### 4. `CapacitorHttpHandler` — native implementation

```typescript
@Injectable()
export class CapacitorHttpHandler implements HttpHandler {
  private proxyUrl = inject(ProxyUrlService);

  get<T>(url: string, opts: { headers: HttpHeaders; observe: 'response' }): Observable<HttpResponse<T>> {
    return from(
      Http.get({
        url,
        headers: this.mergeHeaders(opts.headers),
      }).then(res => new HttpResponse({ body: res.data as T, status: res.status }))
    );
  }

  post<T>(url: string, body: unknown, opts: { headers: HttpHeaders; observe: 'response' }): Observable<HttpResponse<T>> {
    return from(
      Http.post({
        url,
        headers: this.mergeHeaders(opts.headers),
        data: body,
      }).then(res => new HttpResponse({ body: res.data as T, status: res.status }))
    );
  }

  private mergeHeaders(h: HttpHeaders): Record<string, string> {
    const headers: Record<string, string> = {};
    h.keys().forEach(k => headers[k] = h.get(k)!);
    return { ...headers, ...this.proxyUrl.nativeHeaders() };
  }
}
```

### 5. Provider in `main.ts`

```typescript
import { HTTP_HANDLER, AngularHttp, CapacitorHttpHandler } from './app/shared/http';

// In bootstrapApplication providers array:
{
  provide: HTTP_HANDLER,
  useFactory: () => {
    if ((globalThis as any).Capacitor?.isNativePlatform()) {
      return new CapacitorHttpHandler();
    }
    return new AngularHttp();
  },
},
```

`AngularHttp` and `CapacitorHttpHandler` use `inject()` so they must be created inside Angular's DI context.
Use `inject()` at the factory level or make them `@Injectable()` and let DI create them.

### 6. Changes to `RedgifsApiService`

**Before:**
```typescript
private http = inject(HttpClient);
private settings = inject(SettingsService);
```

**After:**
```typescript
private handler = inject(HTTP_HANDLER);
private proxyUrl = inject(ProxyUrlService);
private settings = inject(SettingsService);
```

`get()` and `post()`:
```typescript
// this.http.get<T>(url, opts) → this.handler.get<T>(url, opts)
// this.http.post<T>(url, body, opts) → this.handler.post<T>(url, body, opts)
```

URL methods:
```typescript
proxyUrl(url)          → this.proxyUrl.toCdn(url)
proxyUserpicUrl(url)   → this.proxyUrl.toUserpic(url)
hlsUrl(id, q)          → this.proxyUrl.toApi(`/v2/gifs/${id}/${q}.m3u8`)
cachedMediaUrl(url)    → uses this.proxyUrl.toCdn() + this.proxyUrl.nativeHeaders()
```

No platform branching, no `if (isNative)` anywhere in the service.

### 7. Tests

Test module provides `AngularHttp` (which uses real `HttpClient`):
```typescript
TestBed.configureTestingModule({
  providers: [
    provideHttpClient(),
    provideHttpClientTesting(),
    { provide: HTTP_HANDLER, useClass: AngularHttp },
    RedgifsApiService,
    SettingsService,
    ProxyUrlService,
  ],
});
```

`HttpTestingController` intercepts `HttpClient` requests made by `AngularHttp` — works unchanged.
All existing test assertions (`httpCtrl.expectOne('/api/v2/...')`) pass as-is.

## File structure

```
src/app/shared/
  proxy-url.service.ts          # Platform-aware URL transformations
  proxy-url.service.spec.ts     # Unit tests
  http/
    http-handler.ts              # HTTP_HANDLER token + interface
    angular-http.ts              # Web: wraps HttpClient
    capacitor-http.ts            # Native: wraps @capacitor/http

src/app/services/
  redgifs-api.service.ts        # ~15 lines changed (inject, delegate, swap http→handler)
  redgifs-api.service.spec.ts   # Add HTTP_HANDLER provider in test module

src/main.ts                     # Add HTTP_HANDLER factory provider
```

## Implementation order

1. Create `HTTP_HANDLER` token + `AngularHttp`
2. Create `ProxyUrlService` + tests
3. Refactor `RedgifsApiService` — inject both, replace `HttpClient` usage
4. Update tests — provide `AngularHttp` under `HTTP_HANDLER`
5. `npm install @capacitor/http && npx cap sync android`
6. Create `CapacitorHttpHandler`
7. Build APK and test on device

## Files NOT changed

All page components, `capacitor.config.ts`, `vercel.json`, `api/proxy/[...path].ts`,
`settings.service.ts`, all models.
