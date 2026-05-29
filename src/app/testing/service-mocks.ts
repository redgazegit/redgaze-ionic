// Mock service implementations for testing
import { signal } from '@angular/core';
import { Gif } from '../models/gif.model';
import { of } from 'rxjs';

export class MockFavoritesService {
  private _favorites: Gif[] = [];

  readonly favorites$ = of(this._favorites);

  toggle = (gif: Gif): void => {
    const exists = this._favorites.some(f => f.id === gif.id);
    if (exists) {
      this._favorites = this._favorites.filter(f => f.id !== gif.id);
    } else {
      this._favorites = [...this._favorites, gif];
    }
    // Track calls for assertion
    this._toggleCalls.push(gif);
  };

  isFavorite = (id: string): boolean =>
    this._favorites.some(f => f.id === id);

  getAll = (): Gif[] => this._favorites;

  // Test tracking
  _toggleCalls: Gif[] = [];
  _isFavoriteCalls: string[] = [];

  reset() {
    this._favorites = [];
    this._toggleCalls = [];
    this._isFavoriteCalls = [];
  }
}

export class MockSettingsService {
  private _settings = {
    playbackMode: 'mp4' as const,
    quality: 'hd' as const,
    rateLimitEnabled: true,
    storiesNavigation: true,
    gridAutoplay: true,
  };

  readonly settings$ = of(this._settings);

  get = () => this._settings;

  update = (partial: Partial<typeof this._settings>): void => {
    this._settings = { ...this._settings, ...partial };
  };

  setSettings(settings: typeof this._settings) {
    this._settings = { ...settings };
  }
}

export class MockThemeService {
  private _mode: 'system' | 'light' | 'dark' = 'system';
  readonly mode$ = of(this._mode);

  setMode = (mode: 'system' | 'light' | 'dark'): void => {
    this._mode = mode;
  };

  getMode = () => this._mode;

  setModeDirect(mode: 'system' | 'light' | 'dark') {
    this._mode = mode;
  }
}

export class MockVideoStateService {
  readonly activeGifId = signal<string | null>(null);

  requestPlay = (gifId: string): boolean => {
    const current = this.activeGifId();
    if (current === null || current === gifId) {
      this.activeGifId.set(gifId);
      return true;
    }
    return false;
  };

  onPause = (gifId: string): void => {
    if (this.activeGifId() === gifId) {
      this.activeGifId.set(null);
    }
  };
}

export class MockWatchQueueService {
  private _buffer: any[] = [];
  private _cursor = 0;
  private _current: any = null;

  readonly current = signal<any | null>(null);
  readonly position = signal(1);
  readonly total = signal(0);
  readonly hasNext = signal(false);
  readonly hasPrev = signal(false);
  readonly loading = signal(false);

  private _syncSignals(): void {
    (this.current as any).set(this._current);
    (this.position as any).set(this._cursor + 1);
    (this.total as any).set(this._buffer.length);
    (this.hasNext as any).set(this._cursor < this._buffer.length - 1);
    (this.hasPrev as any).set(this._cursor > 0);
  }

  setQueue = (initial: any[], startIdx = 0, generator?: any): void => {
    this._buffer = [...initial];
    this._cursor = startIdx;
    this._current = this._buffer[this._cursor] || null;
    this._syncSignals();
  };

  next = async (): Promise<boolean> => {
    if (this._cursor < this._buffer.length - 1) {
      this._cursor++;
      this._current = this._buffer[this._cursor] || null;
      this._syncSignals();
      return true;
    }
    return false;
  };

  prev = (): boolean => {
    if (this._cursor > 0) {
      this._cursor--;
      this._current = this._buffer[this._cursor] || null;
      this._syncSignals();
      return true;
    }
    return false;
  };

  restoreFromSession = (): boolean => {
    const saved = sessionStorage.getItem('watch-queue');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this._buffer = data.buffer || [];
        this._cursor = data.cursor || 0;
        this._current = this._buffer[this._cursor] || null;
        this._syncSignals();
        return true;
      } catch { return false; }
    }
    return false;
  };

  persistToSession = (): void => {
    sessionStorage.setItem('watch-queue', JSON.stringify({
      buffer: this._buffer,
      cursor: this._cursor
    }));
  };

  clear = (): void => {
    this._buffer = [];
    this._cursor = 0;
    this._current = null;
    sessionStorage.removeItem('watch-queue');
  };

  setBuffer(buffer: any[]) {
    this._buffer = buffer;
    this._current = this._buffer[this._cursor] || null;
  }
}

export class MockRedgifsApiService {
  private _token = 'fake-jwt-token';

  getAllTags = () => of([
    { name: 'funny', count: 100 },
    { name: 'test', count: 50 }
  ]);

  getCachedTags = () => [
    { name: 'funny', count: 100 },
    { name: 'test', count: 50 }
  ];

  getTrendingGifs = () => of([
    this._makeGif('trending-1'),
    this._makeGif('trending-2')
  ]);

  getTrendingImages = () => of([
    this._makeGif('trending-img-1', { type: 'image' }),
    this._makeGif('trending-img-2', { type: 'image' })
  ]);

  getTrendingTags = () => of([
    { text: 'funny', type: 'tag', gifs: [] },
    { text: 'test', type: 'tag', gifs: [] }
  ]);

  getTagSuggestions = (query = 'funny') => of([
    { text: `${query} cats`, type: 'tag', gifs: [] }
  ]);

  getGif = (id: string) => of(this._makeGif(id));

  getPopularFeed = () => of({
    gifs: [this._makeGif('pop-1'), this._makeGif('pop-2')],
    page: 1,
    pages: 10,
    total: 100,
  });

  proxyUrl = (url: string): string =>
    url.replace('https://media.redgifs.com', '/cdn');

  proxyUserpicUrl = (url: string): string =>
    url.replace('https://userpic.redgifs.com', '/userpic') || 'assets/default-avatar.svg';

  cachedMediaUrl = async (url: string): Promise<string> =>
    this.proxyUrl(url);

  hlsUrl = (gifId: string, quality: 'hd' | 'sd'): string =>
    `/api/v2/gifs/${gifId}/${quality}.m3u8`;

  getToken = () => this._token;

  ensureAuthToken = async (): Promise<string> => this._token;

  private _makeGif(id: string, overrides: any = {}): any {
    return {
      id,
      userName: 'testuser',
      description: 'Test GIF',
      urls: {
        sd: 'https://media.redgifs.com/sd.mp4',
        hd: 'https://media.redgifs.com/hd.mp4',
        thumbnail: 'https://media.redgifs.com/thumb.jpg',
        poster: 'https://media.redgifs.com/poster.jpg',
      },
      type: 'gif',
      width: 400,
      height: 300,
      hasAudio: false,
      createDate: Date.now() / 1000,
      tags: ['test'],
      likes: 10,
      views: 100,
      verified: 'n',
      duration: 5,
      ...overrides
    };
  }
}
