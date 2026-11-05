# Deferred Video Source Attachment Implementation Plan

> **For agentic workers:** Use subagent-driven-development or executing-plans to implement plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Reduce concurrent video decodes from 41+ to ~5 by deferring `<video>` source attachment until element enters viewport preload zone.

**Architecture:** Modify `VideoPlayerComponent` to not set `videoSrc` on init. Instead, the existing IntersectionObserver gets `rootMargin: "400px 0px"` + `threshold: [0, 0.3]`. Elements within 400px of viewport get source attached (preload). Elements >=30% visible get promoted to play. Elements outside 400px get source released. Stories mode unchanged (immediate source + play).

**Tech Stack:** Angular 19, IntersectionObserver, Plyr, Vitest, happy-dom

---

## File Overview

| File | Status | Responsibility |
|------|--------|----------------|
| `src/app/components/video-player/video-player.component.ts` | Modify | Deferred source via zone-based IntersectionObserver |
| `src/app/components/video-player/video-player.component.html` | Modify | Dynamic `preload` attribute |
| `src/app/components/video-player/video-player.component.spec.ts` | Modify | Update mocks + tests for deferred behavior |

---

### Task 1: Update MockObserver + write failing tests for deferred source

**Files:**
- Modify: `src/app/components/video-player/video-player.component.spec.ts`

- [ ] **Step 1: Update MockObserver to accept IntersectionObserverInit**

Replace the existing `MockObserver` class to accept options:

```typescript
class MockObserver {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = cb;
    this.options = options;
    observerCallback = cb;
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
    this.takeRecords = vi.fn(() => []);
  }
}
```

- [ ] **Step 2: Update existing test entries to include `intersectionRatio`**

Replace all `observerCallback!([{ isIntersecting: false } as IntersectionObserverEntry], ...)`
→ `observerCallback!([{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry], ...)`

Replace all `observerCallback!([{ isIntersecting: true } as IntersectionObserverEntry], ...)`
→ `observerCallback!([{ isIntersecting: true, intersectionRatio: 0.5 } as IntersectionObserverEntry], ...)`

This affects lines 279, 288, 298 of the current spec.

- [ ] **Step 3: Write failing test — source NOT set on init**

After `describe('IntersectionObserver', ...)` block, add a new describe block:

```typescript
describe('deferred source attachment', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should NOT set videoSrc or posterSrc on init', () => {
    const fixture = createComponent();
    fixture.detectChanges();
    expect(fixture.componentInstance.videoSrc()).toBe('');
    expect(fixture.componentInstance.posterSrc()).toBe('');
  });
});
```

- [ ] **Step 4: Write failing test — source attaches on preload zone entry**

```typescript
it('should set videoSrc and posterSrc when entering preload zone', () => {
  const gif = fakeGif({
    urls: {
      ...fakeGif({}).urls,
      thumbnail: 'https://media.redgifs.com/thumb.jpg',
      sd: 'https://media.redgifs.com/test.mp4',
      hd: 'https://media.redgifs.com/test-hd.mp4',
    }
  });
  mockSettings.setSettings({ playbackMode: 'mp4', quality: 'hd', rateLimitEnabled: true, storiesNavigation: true, gridAutoplay: true });
  const fixture = createComponent(gif);
  fixture.detectChanges();

  expect(fixture.componentInstance.videoSrc()).toBe('');

  observerCallback!([{ isIntersecting: true, intersectionRatio: 0 } as IntersectionObserverEntry], null! as any);

  expect(fixture.componentInstance.videoSrc()).toBe('/cdn/test-hd.mp4');
  expect(fixture.componentInstance.posterSrc()).toBe('/cdn/thumb.jpg');
});
```

- [ ] **Step 5: Write failing test — source releases on zone exit**

```typescript
it('should clear videoSrc and posterSrc when exiting viewport zone', () => {
  const fixture = createComponent();
  fixture.detectChanges();

  observerCallback!([{ isIntersecting: true, intersectionRatio: 0 } as IntersectionObserverEntry], null! as any);
  expect(fixture.componentInstance.videoSrc()).toBeTruthy();

  observerCallback!([{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry], null! as any);

  expect(fixture.componentInstance.videoSrc()).toBe('');
  expect(fixture.componentInstance.posterSrc()).toBe('');
});
```

- [ ] **Step 6: Write failing test — play only in active zone (ratio >= 0.3)**

```typescript
it('should play video when in active zone (intersectionRatio >= 0.3)', () => {
  const fixture = createComponent();
  fixture.detectChanges();
  vi.spyOn(mockVideoState, 'requestPlay').mockReturnValue(true);

  observerCallback!([{ isIntersecting: true, intersectionRatio: 0.5 } as IntersectionObserverEntry], null! as any);
  vi.advanceTimersByTime(400);

  expect(mockVideoState.requestPlay).toHaveBeenCalled();
  expect(getPlayer(fixture).play).toHaveBeenCalled();
});

it('should NOT play video in preload zone (intersectionRatio between 0 and 0.3)', () => {
  const fixture = createComponent();
  fixture.detectChanges();
  const playSpy = vi.spyOn(mockVideoState, 'requestPlay');

  observerCallback!([{ isIntersecting: true, intersectionRatio: 0 } as IntersectionObserverEntry], null! as any);
  vi.advanceTimersByTime(400);

  expect(playSpy).not.toHaveBeenCalled();
});
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `npm test -- --run src/app/components/video-player/video-player.component.spec.ts`
Expected: Tests fail because source is still attached in constructor.

---

### Task 2: Add `ensureSource()`, `releaseSource()`, update observer logic

**Files:**
- Modify: `src/app/components/video-player/video-player.component.ts`

- [ ] **Step 1: Add new class properties**

```typescript
private sourceGeneration = 0;
readonly preloadStrategy = signal<'none' | 'metadata' | 'auto'>('none');
```

Add `preloadStrategy` and `sourceAttached` — add after line 37 (`private blobUrls: string[] = [];`).

Remove `readonly preloadStrategy` from the existing signal area. Wait, looking at the existing code: there is no existing `preloadStrategy`. I'm adding it fresh.

- [ ] **Step 2: Add `ensureSource()` method after `setMediaSources`**

```typescript
private ensureSource(): void {
  if (this.sourceAttached) return;
  this.sourceAttached = true;
  this.preloadStrategy.set('metadata');
  const gif = this.gif();
  if (!gif) { this.sourceAttached = false; return; }
  const prefHd = this.settings.get().quality === 'hd';
  const rawUrl = prefHd ? (gif.urls.hd || gif.urls.sd || '') : (gif.urls.sd || gif.urls.hd || '');
  const thumb = gif.urls.thumbnail || '';
  this.setMediaSources(rawUrl, thumb);
}
```

- [ ] **Step 3: Add `releaseSource()` method after `ensureSource`**

```typescript
private releaseSource(): void {
  if (!this.sourceAttached) return;
  this.sourceAttached = false;
  this.preloadStrategy.set('none');
  this.videoSrc.set('');
  this.posterSrc.set('');
  const urls = this.blobUrls;
  this.blobUrls = [];
  urls.forEach(url => this.mediaProxy.abortProgressiveStream(url));
}
```

- [ ] **Step 4: Add `sourceAttached` flag**

```typescript
private sourceAttached = false;
```

Add after line 34 (`private playTimer?: ReturnType<typeof setTimeout>;`).

- [ ] **Step 5: Update `setMediaSources` to guard against late async callbacks**

```typescript
private setMediaSources(rawUrl: string, thumb: string): void {
  if (Capacitor.isNativePlatform()) {
    this.mediaProxy.proxyImage(thumb).then(url => {
      if (this.sourceAttached) this.posterSrc.set(url);
    });
    this.mediaProxy.proxyVideoProgressive(rawUrl).then(url => {
      if (this.sourceAttached) {
        this.videoSrc.set(url);
        this.blobUrls.push(url);
      }
    });
  } else {
    this.posterSrc.set(this.api.proxyUrl(thumb));
    this.videoSrc.set(this.api.proxyUrl(rawUrl));
  }
}
```

- [ ] **Step 6: Remove source attachment from constructor effect**

In the constructor effect, remove these lines:
```typescript
const prefHd = this.settings.get().quality === 'hd';
const rawUrl = prefHd ? (gif.urls.hd || gif.urls.sd || '') : (gif.urls.sd || gif.urls.hd || '');
const thumb = gif.urls.thumbnail || '';

setTimeout(() => this.setMediaSources(rawUrl, thumb));
```

The effect body for non-stories becomes:
```typescript
if (this.player) return;
```

- [ ] **Step 7: Update IntersectionObserver with rootMargin + threshold**

Replace the existing observer (lines 81-97) with:

```typescript
this.observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!this.player || document.fullscreenElement) return;
    clearTimeout(this.playTimer);
    if (entry.intersectionRatio >= 0.3) {
      this.ensureSource();
      this.playTimer = setTimeout(() => {
        if (this.player && this.videoState.requestPlay(this.gif().id)) {
          this.player.play().catch(() => {});
        }
      }, 400);
    } else if (entry.isIntersecting) {
      this.ensureSource();
      this.videoState.onPause(this.gif().id);
      this.player.pause();
    } else {
      this.videoState.onPause(this.gif().id);
      this.player.pause();
      this.releaseSource();
    }
  });
}, { rootMargin: '400px 0px', threshold: [0, 0.3] });
```

- [ ] **Step 8: Update `plyr:ready` handler with `sourceAttached` guard**

```typescript
this.player.on('ready', () => {
  if (this.sourceAttached && videoEl && this.isElementVisible(videoEl)) {
    if (this.videoState.requestPlay(this.gif().id)) {
      this.player?.play().catch(() => {});
    }
  }
});
```

- [ ] **Step 9: Update `ngOnDestroy` to call `releaseSource`**

Replace manual blob URL cleanup:

```typescript
ngOnDestroy(): void {
  clearTimeout(this.playTimer);
  this.observer?.disconnect();
  this.player?.destroy();
  this.videoState.onPause(this.gif()?.id || '');
  this.releaseSource();
}
```

- [ ] **Step 10: Run tests**

Run: `npm test -- --run src/app/components/video-player/video-player.component.spec.ts`

Expected: All tests pass (from Task 1 + existing tests).

---

### Task 3: Update template for dynamic preload

**Files:**
- Modify: `src/app/components/video-player/video-player.component.html`

- [ ] **Step 1: Change `preload="metadata"` to `[attr.preload]="preloadStrategy()"`**

```html
<video
  #videoPlayer
  [src]="videoSrc()"
  attr.poster="{{posterSrc()}}"
  playsinline
  muted
  [attr.preload]="preloadStrategy()"
  [class.plyr]="!storiesMode()"
></video>
```

- [ ] **Step 2: Run tests**

Run: `npm test -- --run src/app/components/video-player/video-player.component.spec.ts`
Expected: All tests pass.

---

### Task 4: Update `ngOnDestroy` test for `releaseSource` cleanup

**Files:**
- Modify: `src/app/components/video-player/video-player.component.spec.ts`

- [ ] **Step 1: Update the `ngOnDestroy` cleanup test**

Replace the existing `ngOnDestroy` test that spies on `URL.revokeObjectURL`. The new `releaseSource` delegates to `mediaProxy.abortProgressiveStream`. Since the real `MediaProxyService` is injected, create a spy on it:

```typescript
it('should clean up player, observer, timer, and release source', () => {
  const fixture = createComponent();
  fixture.detectChanges();
  const page = fixture.componentInstance as any;
  const timer = setTimeout(() => {}, 10000);
  page.playTimer = timer;
  page.blobUrls = ['blob:http://test1', 'blob:http://test2'];

  vi.spyOn(globalThis, 'clearTimeout');
  const abortSpy = vi.spyOn(page.mediaProxy, 'abortProgressiveStream');
  vi.spyOn(mockVideoState, 'onPause');

  fixture.destroy();

  expect(globalThis.clearTimeout).toHaveBeenCalledWith(timer);
  expect(page.player.destroy).toHaveBeenCalled();
  expect(mockVideoState.onPause).toHaveBeenCalled();
  expect(abortSpy).toHaveBeenCalledTimes(2);
  expect(abortSpy).toHaveBeenCalledWith('blob:http://test1');
  expect(abortSpy).toHaveBeenCalledWith('blob:http://test2');
});
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass.

---

## Self-Review

**1. Spec coverage:**
- Deferred source on init → Task 1 (failing test) + Task 2 (implement `ensureSource`/`releaseSource`, remove constructor source)
- Preload zone (400px rootMargin) → Task 2 (observer config + `ensureSource` call)
- Active zone (threshold 0.3) play → Task 1 (test) + Task 2 (observer logic + `requestPlay`)
- Zone exit release → Task 1 (test) + Task 2 (`releaseSource`)
- Stories mode unchanged → existing tests pass (stories mode tests never call observer, use immediate source)
- Race condition guard → Task 2 (`sourceAttached` check in `setMediaSources` async callbacks)
- Dynamic preload attribute → Task 3
- Cleanup → Task 4

**2. Placeholder scan:** No TBDs, TODOs, or "add error handling" found. Every code block is complete.

**3. Type consistency:** `preloadStrategy` signal type `'none' | 'metadata' | 'auto'` matches template `[attr.preload]` binding. `sourceAttached` boolean consistent across `ensureSource`, `releaseSource`, `setMediaSources`, and `plyr:ready`. `intersectionRatio` used consistently in tests and component code.

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-07-23-deferred-video-source.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
