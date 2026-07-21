# Back Button & Navigation History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix inconsistent back button behavior and missing navigation fallbacks across detail pages.

**Architecture:** App uses Ionic standalone tabs (`app.component.html` with `ion-tabs`) + Angular router. Home/search/favorites/settings are tab roots. Creator-detail, niche-browse, watch, stories are child pages navigated from tabs. Fix: add `defaultHref` fallbacks on child pages, add 404 wildcard route, add native hardware back handler, add scroll restoration.

**Tech Stack:** Ionic 8 (standalone components), Angular 19, Capacitor, Vitest

---

### Task 1: Add `defaultHref="/home"` to creator-detail back button

**Files:**
- Modify: `src/app/pages/creator-detail/creator-detail.page.html:4`

- [ ] **Change `<ion-back-button>` to include `defaultHref="/home"`**

From:
```html
<ion-back-button></ion-back-button>
```
To:
```html
<ion-back-button defaultHref="/home"></ion-back-button>
```

- [ ] **Verify the template compiles**

Run: `cd ionic-app && npx tsc --noEmit --strict --project tsconfig.app.json 2>&1 | Select-String "error"`  
Expected: no errors related to creator-detail.page.html or IonBackButton

---

### Task 2: Add `defaultHref="/home"` to niche-browse back button

**Files:**
- Modify: `src/app/pages/niche-browse/niche-browse.page.html:4`

- [ ] **Change `<ion-back-button>` to include `defaultHref="/home"`**

From:
```html
<ion-back-button></ion-back-button>
```
To:
```html
<ion-back-button defaultHref="/home"></ion-back-button>
```

- [ ] **Verify the template compiles**

Run: `cd ionic-app && npx tsc --noEmit --strict --project tsconfig.app.json 2>&1 | Select-String "error"`  
Expected: no errors

---

### Task 3: Add wildcard 404 route 

**Files:**
- Modify: `src/app/app.routes.ts:21`

- [ ] **Add catch-all route at end of routes array**

Before the closing `];`, add:
```typescript
  { path: '**', redirectTo: 'home' },
```

Full final routes array:
```typescript
export const routes: Routes = [
  { path: 'home', component: HomePage },
  { path: 'search', component: SearchPage },
  { path: 'search/:query', component: SearchPage },
  { path: 'favorites', component: FavoritesPage },
  { path: 'creator/:username', component: CreatorDetailPage },
  { path: 'niche/:nicheId', component: NicheBrowsePage },
  { path: 'watch/:id', component: WatchPage },
  { path: 'stories/:id', component: StoriesPage },
  { path: 'settings', component: SettingsPage },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: '**', redirectTo: 'home' },
];
```

- [ ] **Write failing test for 404 route**

Test: `src/app/app.routes.spec.ts` (create)
```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { routes } from './app.routes';

describe('App Routes', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
    router = TestBed.inject(Router);
  });

  it('should redirect unknown paths to /home', async () => {
    await router.navigateByUrl('/some/garbage/path');
    expect(router.url).toBe('/home');
  });
});
```

- [ ] **Run test to verify it fails initially**

Run: `cd ionic-app && npx vitest run src/app/app.routes.spec.ts`  
Expected: FAIL — route does not exist yet, navigation may not redirect

- [ ] **Add the wildcard route and rerun test**

Run: `cd ionic-app && npx vitest run src/app/app.routes.spec.ts`  
Expected: PASS

- [ ] **Commit**

```bash
git add src/app/app.routes.ts src/app/app.routes.spec.ts
git commit -m "fix: add wildcard 404 route with redirect to home"
```

---

### Task 4: Add native hardware back-button handler in AppComponent

**Files:**
- Modify: `src/app/app.component.ts`

- [ ] **Add import for Platform**

Add to imports at top of `app.component.ts`:
```typescript
import { Platform } from '@ionic/angular/standalone';
```

- [ ] **Inject Platform and add backButton handler in ngOnInit**

Update `AppComponent`:
```typescript
export class AppComponent implements OnInit {
  private api = inject(RedgifsApiService);
  private theme = inject(ThemeService);
  private settings = inject(SettingsService);
  private platform = inject(Platform);

  ngOnInit() {
    this.api.getAllTags().subscribe();
    this.setupBackButton();
  }

  private setupBackButton() {
    this.platform.backButton.subscribeWithPriority(10, () => {
      // On Android, prevent app close — let Ionic history handle it
      // Ionic's ion-back-button already manages history; this prevents
      // the OS from killing the app when history stack is non-empty.
      // navigator is a standard API available in Capacitor WebView.
      if (window.location.pathname !== '/home') {
        window.history.back();
      }
    });
  }
}
```

Also add `Platform` to the component's `imports` array or mark it as provided via DI (it's a service, not a component — it doesn't go in imports). Remove if not needed in `imports`.

- [ ] **Write test for back-button behavior**

Add to test file or create `src/app/app.component.spec.ts`:
```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { Platform } from '@ionic/angular/standalone';
import { RedgifsApiService } from './services/redgifs-api.service';
import { ThemeService } from './services/theme.service';
import { SettingsService } from './services/settings.service';
import { MockRedgifsApiService } from './testing/service-mocks';
import { of } from 'rxjs';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: RedgifsApiService, useValue: { getAllTags: () => of([]) } },
        { provide: ThemeService, useValue: {} },
        { provide: SettingsService, useValue: { loadSettings: () => ({}) } },
      ],
    });
    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
```

- [ ] **Run test**

Run: `cd ionic-app && npx vitest run src/app/app.component.spec.ts`  
Expected: PASS

- [ ] **Commit**

```bash
git add src/app/app.component.ts src/app/app.component.spec.ts
git commit -m "feat: add native hardware back-button handler"
```

---

### Task 5: Add scroll restoration for feed pages on back navigation

**Files:**
- Modify: `src/app/pages/home/home.page.ts`
- Modify: `src/app/pages/creator-detail/creator-detail.page.ts`

- [ ] **Add scroll position tracking to HomePage**

```typescript
import { IonContent } from '@ionic/angular/standalone';
import { viewChild } from '@angular/core';

// In HomePage class:
readonly content = viewChild(IonContent);

// Restore scroll on init
private scrollRestored = false;

ionViewDidEnter() {
  if (!this.scrollRestored) {
    const saved = sessionStorage.getItem('redgaze_home_scroll');
    if (saved) {
      this.content()?.scrollToPoint(0, parseInt(saved, 10), 200);
      sessionStorage.removeItem('redgaze_home_scroll');
    }
    this.scrollRestored = true;
  }
}

// Before navigating away, save scroll
goToCreator(username: string) {
  this.content()?.getScrollElement().then(el => {
    sessionStorage.setItem('redgaze_home_scroll', String(el.scrollTop));
  });
  this.router.navigate(['/creator', username]);
}
```

- [ ] **Test scroll restoration works**

Manual test: scroll down feed → tap creator → press back → verify scroll position restored.

- [ ] **Commit**

```bash
git add src/app/pages/home/home.page.ts
git commit -m "feat: restore scroll position on back navigation"
```

---

## Self-Review Checklist

- [ ] Every template change has exact before/after shown
- [ ] Every test has complete code, not "write appropriate tests"
- [ ] `Platform` is a DI service, not an Ionic component — not added to `imports` array
- [ ] No placeholder text, TODOs, or vague instructions
- [ ] File paths match actual project structure
