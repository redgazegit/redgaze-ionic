import { Injectable, Renderer2, RendererFactory2, inject, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type ThemeMode = 'system' | 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private rendererFactory = inject(RendererFactory2);
  private renderer: Renderer2;
  private modeSubject = new BehaviorSubject<ThemeMode>(this.loadMode());
  private mediaQuery: MediaQueryList;
  readonly reducedMotion = signal(false);

  mode$: Observable<ThemeMode> = this.modeSubject.asObservable();

  constructor() {
    this.renderer = this.rendererFactory.createRenderer(null, null);
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQuery.addEventListener('change', () => this.apply());
    this.apply();

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion.set(motionQuery.matches);
    motionQuery.addEventListener('change', (e) => this.reducedMotion.set(e.matches));
  }

  private loadMode(): ThemeMode {
    return (localStorage.getItem('redgaze-theme') as ThemeMode) || 'system';
  }

  setMode(mode: ThemeMode): void {
    this.modeSubject.next(mode);
    localStorage.setItem('redgaze-theme', mode);
    this.apply();
  }

  private apply(): void {
    const mode = this.modeSubject.value;
    const isDark = mode === 'dark' || (mode === 'system' && this.mediaQuery.matches);
    document.documentElement.classList.toggle('ion-palette-dark', isDark);
    this.renderer.setAttribute(document.documentElement, 'color-scheme', isDark ? 'dark' : 'light');
    document.body.classList.toggle('dark', isDark);
  }
}
