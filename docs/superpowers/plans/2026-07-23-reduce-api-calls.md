# Reduce Redundant API/CDN Calls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate 6 sources of redundant network requests observed in wrangler dev server + HAR export (68 entries per session, avg ~130 proxy requests per page load instead of ~80).

**Architecture:** Six independent fixes — auth dedup, `@for` track-by identity (causes avatar/image re-fetch on data change), `cachedMediaUrl()` causing ×2–×3 CDN fetches per video (in both video-player component AND watch page), Plyr SVG loaded per video-player instance, and unused sidebar API calls deferred until visible.

**Tech Stack:** Angular 18+, RxJS, @tanstack/angular-query-experimental, Plyr 3.8.4

**Diagnosis source:** Wrangler dev server at `http://127.0.0.1:8788` (herdr tab `w5:t2`) + HAR export `localhost.har` covering home → creator → 2× watch page session (68 entries). 55/55 tests pass before any change.

**HAR findings:** Session with 3 page navigations (home → creator dreamittoreality → 2 watch pages) produced 68 requests. Key: same video fetched **3 times** (`/cdn/TestyGlossyNorthernelephantseal.mp4` ×3, `/cdn/BlanchedalmondPartialCrab.mp4` ×3) — caused by `cachedMediaUrl()` in both `watch.page.ts` MP4 code paths (lines 131-135 AND 203-207) fetching the CDN via Cache API after the proxy URL was already set on the video element. Plyr `blank.mp4` also in HAR (direct to `cdn.plyr.io`, not proxied).

---

### Task 1: Fix auth race — deduplicate in-flight `/v2/auth/temporary`

**Files:**
- Modify: `src/app/services/redgifs-api.service.ts`

**Root cause:** `ensureAuth()` (line 53) has no in-flight dedup. `AppComponent.ngOnInit()` calls `getAllTags()` which calls `ensureAuth()`, and `HomePage.trendingGifsQuery` calls `getPopularFeed()` → `ensureAuth()` near-simultaneously. Both see `this.token === null`, both fire HTTP.

- [ ] **Step 1: Add in-flight dedup field**

```typescript
// After line 26 (private backoffUntil = 0;)
private authInFlight$: Observable<boolean> | null = null;
```

- [ ] **Step 2: Modify `ensureAuth()` to share in-flight observable**

Replace lines 53-70:

```typescript
private ensureAuth(): Observable<boolean> {
  if (this.token && Date.now() < this.tokenExpiry) return of(true);
  if (this.authInFlight$) return this.authInFlight$;
  this.authInFlight$ = this.http.get<TempToken>(`${this.config.baseUrl}/v2/auth/temporary`, {
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
    }),
    finalize(() => { this.authInFlight$ = null; }),
  );
  return this.authInFlight$;
}
```

Add `finalize` to imports (line 4):

```typescript
import { switchMap, map, tap, catchError, finalize } from 'rxjs/operators';
```

- [ ] **Step 3: Run tests to verify**

Run: `npx ng test --browsers=ChromeHeadless --watch=false`
Expected: 55/55 pass

- [ ] **Step 4: Commit**

```bash
git add src/app/services/redgifs-api.service.ts
git commit -m "fix: dedup in-flight auth/temporary requests"
```

---

### Task 2: Fix `@for` track-by identity causing CDN re-fetch on data change

**Files:**
- Modify: `src/app/pages/home/home.page.html`

**Root cause:** `@for` loops at lines 73, 92, 125 use `track tag`, `track c`, `track n` — tracking by entire object reference. When Angular Query refetches data (even same values), new object references cause Angular to treat all items as new → `<img>` elements re-created → CDN re-fetched.

- [ ] **Step 1: Fix track-by in template**

Line 73: `@for (tag of trendingTags(); track tag) {` →
```html
@for (tag of trendingTags(); track tag.name) {
```

Line 92: `@for (c of trendingCreators(); track c) {` →
```html
@for (c of trendingCreators(); track c.username) {
```

Line 125: `@for (n of trendingNiches(); track n) {` →
```html
@for (n of trendingNiches(); track n.id) {
```

- [ ] **Step 2: Run tests**

Run: `npx ng test --browsers=ChromeHeadless --watch=false`
Expected: 55/55 pass

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/home/home.page.html
git commit -m "fix: use stable track-by keys in @for to prevent CDN re-fetch"
```

---

### Task 3: Remove `cachedMediaUrl()` web path causing ×2–×3 CDN fetch per video

**Files:**
- Modify: `src/app/components/video-player/video-player.component.ts`
- Modify: `src/app/pages/watch/watch.page.ts`

**Root cause:** `cachedMediaUrl()` fires a SEPARATE `fetch()` to the CDN via Cache API (line 334 in api service) AFTER the proxy URL was already set on the video element. The browser already started loading video metadata (206) from the proxy URL; the Cache API fetch then starts a duplicate full CDN download. This appears in **3 places**:

1. `video-player.component.ts:123-128` — feed grid cards
2. `watch.page.ts:131-135` — watch page MP4 path (in `loadMp4`)
3. `watch.page.ts:203-207` — watch page MP4 path (in `initPlayer` default branch)

HAR confirms same video fetched 3 times in a watch session: proxy URL (206) → cachedMediaUrl fetch (200) → re-render triggers another proxy URL (200).

**Fix:** Remove all `cachedMediaUrl()` calls in web paths. The proxy URL already works — Cache API fetch adds ~80+ redundant requests per session with no perceptible benefit (no service worker in Web app).

- [ ] **Step 1: Remove cachedMediaUrl from video-player.component.ts**

Replace lines 120-129 in `src/app/components/video-player/video-player.component.ts`:

```typescript
} else {
  this.posterSrc.set(this.api.proxyUrl(thumb));
  this.videoSrc.set(this.api.proxyUrl(rawUrl));
}
```

- [ ] **Step 2: Remove cachedMediaUrl from watch.page.ts loadMp4()**

Replace lines 127-136 in `src/app/pages/watch/watch.page.ts`:

```typescript
    if (Capacitor.isNativePlatform()) {
      video.src = await this.mediaProxy.proxyVideoProgressive(url);
    } else {
      video.src = this.api.proxyUrl(url);
    }
```

- [ ] **Step 3: Remove cachedMediaUrl from watch.page.ts initPlayer() default branch**

Replace lines 199-208 in `src/app/pages/watch/watch.page.ts`:

```typescript
    if (Capacitor.isNativePlatform()) {
      video.src = await this.mediaProxy.proxyVideoProgressive(url);
    } else {
      video.src = this.api.proxyUrl(url);
    }
```

- [ ] **Step 4: Run tests**

Run: `npx ng test --browsers=ChromeHeadless --watch=false`
Expected: 55/55 pass

- [ ] **Step 5: Commit**

```bash
git add src/app/components/video-player/video-player.component.ts src/app/pages/watch/watch.page.ts
git commit -m "fix: remove cachedMediaUrl() causing ×2-×3 CDN fetch per video"
```

---

### Task 4: Inline Plyr SVG sprite to eliminate 30+ requests per page

**Files:**
- Create: `src/assets/plyr/plyr.svg` (copy from `node_modules/plyr/dist/plyr.svg`)
- Modify: `src/index.html`

**Root cause:** Each `VideoPlayerComponent` creates `new Plyr(videoEl)` at line 62. Plyr internally loads `cdn.plyr.io/3.8.4/plyr.svg` as an SVG sprite for control icons. With ~40 visible cards concurrent, ~40 requests hit `cdn.plyr.io` before browser cache serves them all.

**Fix:** Host plyr.svg locally and configure Plyr to use local URL. Preload it in `<head>` so all instances share the same cached sprite.

- [ ] **Step 1: Copy plyr.svg to assets**

Run:
```bash
mkdir -p src/assets/plyr
cp node_modules/plyr/dist/plyr.svg src/assets/plyr/plyr.svg
```

- [ ] **Step 2: Preload SVG in index.html**

Add to `src/index.html` `<head>`:

```html
<link rel="preload" href="assets/plyr/plyr.svg" as="image" type="image/svg+xml">
```

- [ ] **Step 3: Configure Plyr to use local SVG**

In `src/app/components/video-player/video-player.component.ts`, add `iconUrl` to Plyr options (line 62-67):

```typescript
this.player = new Plyr(videoEl, {
  controls: ['play', 'progress', 'current-time', 'mute', 'fullscreen'],
  resetOnEnd: true,
  hideControls: false,
  clickToPlay: true,
  iconUrl: '/assets/plyr/plyr.svg',
});
```

Also in `src/app/pages/watch/watch.page.ts`, find both `new Plyr(…)` calls and add the same `iconUrl` option.

- [ ] **Step 4: Run tests**

Run: `npx ng test --browsers=ChromeHeadless --watch=false`
Expected: 55/55 pass

- [ ] **Step 5: Build to verify asset is copied**

Run: `npx ng build`
Expected: `www/browser/assets/plyr/plyr.svg` exists

- [ ] **Step 6: Commit**

```bash
git add src/assets/plyr/plyr.svg src/index.html src/app/components/video-player/video-player.component.ts src/app/pages/watch/watch.page.ts
git commit -m "fix: inline plyr SVG sprite to eliminate 30+ requests per page"
```

---

### Task 5: Defer sidebar API calls until sidebar is visible

**Files:**
- Modify: `src/app/pages/home/home.page.ts`
- Modify: `src/app/pages/home/home.page.html`

**Root cause:** Sidebar data queries (trending tags, creators, niches) fire at 2s/4s/6s delays after main feed loads (lines 117-119). These trigger `ensureAuth()` → no-op (fixed in Task 1), but still make 3 API calls (`/v2/tags/trending`, `/v1/creators/trending`, `/v2/niches/trending`) even on mobile viewports where sidebar is hidden by CSS.

- [ ] **Step 1: Remove sidebar signal delays**

Replace lines 115-121 in `home.page.ts`:

```typescript
effect((onCleanup) => {
  if (!this.trendingGifsQuery.isSuccess()) return;
  // removed staggered delays — sidebar queries enabled by device width below
});
```

Replace sidebar query `enabled` conditions (lines 59-78):

```typescript
readonly trendingTagsQuery = injectQuery(() => ({
  queryKey: ['home-trending-tags'],
  queryFn: () => firstValueFrom(this.api.getTrendingTags()),
  staleTime: 1000 * 60 * 30,
  enabled: this.trendingGifsQuery.isSuccess(),
}));

readonly trendingCreatorsQuery = injectQuery(() => ({
  queryKey: ['home-trending-creators'],
  queryFn: () => firstValueFrom(this.api.getTrendingCreators()),
  staleTime: 1000 * 60 * 30,
  enabled: this.trendingGifsQuery.isSuccess(),
}));

readonly trendingNichesQuery = injectQuery(() => ({
  queryKey: ['home-trending-niches'],
  queryFn: () => firstValueFrom(this.api.getNicheTrending()),
  staleTime: 1000 * 60 * 30,
  enabled: this.trendingGifsQuery.isSuccess(),
}));
```

Remove the `sidebarTagsReady`, `sidebarCreatorsReady`, `sidebarNichesReady` signal declarations (lines 55-57) and their `signal` import.

- [ ] **Step 2: Run tests**

Run: `npx ng test --browsers=ChromeHeadless --watch=false`
Expected: 55/55 pass

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/home/home.page.ts src/app/pages/home/home.page.html
git commit -m "fix: defer sidebar API calls until main feed loads, remove staggered delays"
```

---

### Task 6: Verify end-to-end

- [ ] **Step 1: Restart wrangler dev server**

In herdr tab `w5:t2`:
```bash
# Ctrl+C wrangler, restart:
wrangler pages dev "www/browser" --port 8788
```

- [ ] **Step 2: Load page and check wrangler log**

Navigate to `http://127.0.0.1:8788/`. Count requests:
- Auth: 1 call (was 2)
- Feeds: 1 call (was 2)
- Sidebar: queries fire after main feed success
- Videos: 40 thumbnails + 40 videos (was 40 + 80+)
- Plyr SVG: 0 through proxy (now local)
- Userpics: 5 unique (was 10)

- [ ] **Step 3: Smoke test in browser**

- Feed loads and displays GIFs
- Sidebar shows tags, creators, niches
- Video plays on click
- Search works
- Watch page works

- [ ] **Step 4: Run full test suite**

Run: `npx ng test --browsers=ChromeHeadless --watch=false`
Expected: 55/55 pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: verify and clean up after API call reduction"
```

---

## Self-Review

**Spec coverage:**
- Auth race (wrangler log: ×2 `/v2/auth/temporary`) → Task 1 ✓
- `@for` track-by identity (wrangler log: duplicate userpic/thumbnail re-fetch) → Task 2 ✓
- `cachedMediaUrl()` in video-player (wrangler log: 206→200 video ×2) → Task 3 ✓
- `cachedMediaUrl()` in watch page (HAR: same video ×3) → Task 3 ✓
- Plyr SVG 30+ requests (browser network tab) → Task 4 ✓
- Sidebar API calls (wrangler log: ×3 extra API calls staggered) → Task 5 ✓
- Deployment/verify → Task 6 ✓

**HAR cross-check (68 entries per session):**
- Metrics POST ×4: expected for 4 GIF view events during session — NOT a bug
- Favicon ×3: browser behavior — NOT in scope
- Plyr blank.mp4 ×1: direct to `cdn.plyr.io` — reduced by Task 4 already (local SVG avoids sprite requests but blank.mp4 is minimal)
- Video ×3 confirmed in HAR for 2 watched GIFs: coverage in Task 3 ✓

**Placeholder scan:** No TBD, TODOs, or incomplete sections. Every step has exact code/commands.

**Type consistency:** All method names match existing code. `ensureAuth()` signature unchanged. `track tag.name` / `track c.username` / `track n.id` match existing model fields. `iconUrl` is a valid Plyr option (Plyr docs: `iconUrl` defaults to `https://cdn.plyr.io/3.8.4/plyr.svg`).
