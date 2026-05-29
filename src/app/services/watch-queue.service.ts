import { Injectable, signal, effect } from '@angular/core';
import { Gif } from '../models/gif.model';

export interface QueueEntry {
  gif: Gif;
  index: number;
}

@Injectable({ providedIn: 'root' })
export class WatchQueueService {
  private buffer: Gif[] = [];
  private cursor = 0;
  private gen: (() => AsyncGenerator<Gif[], void, void>) | null = null;
  private generator: AsyncGenerator<Gif[], void, void> | null = null;
  private prefetchPromise: Promise<IteratorResult<Gif[]>> | null = null;
  private exhausted = false;

  readonly current = signal<Gif | null>(null);
  readonly position = signal(1);
  readonly total = signal(0);
  readonly hasNext = signal(false);
  readonly hasPrev = signal(false);
  readonly loading = signal(false);

  constructor() {
    effect(() => {
      if (this.total() > 0) {
        sessionStorage.setItem('redview_watch_queue', JSON.stringify({
          buffer: this.buffer,
          cursor: this.cursor,
        }));
      }
    });
  }

  setQueue(
    initial: Gif[],
    startIdx: number,
    generator?: () => AsyncGenerator<Gif[], void, void>
  ): void {
    this.buffer = [...initial];
    this.cursor = startIdx;
    this.gen = generator || null;
    this.generator = generator ? generator() : null;
    this.prefetchPromise = null;
    this.exhausted = false;
    this.sync();
    this.ensureBuffer();
  }

  async next(): Promise<boolean> {
    if (this.cursor < this.buffer.length - 1) {
      this.cursor++;
      this.sync();
      this.ensureBuffer();
      return true;
    }
    if (this.exhausted || !this.generator) return false;
    this.loading.set(true);
    try {
      const r = await this.consumePrefetch();
      if (r) {
        this.cursor = this.buffer.length - 1;
        this.sync();
        this.ensureBuffer();
        return true;
      }
      this.exhausted = true;
      this.sync();
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  prev(): boolean {
    if (this.cursor <= 0) return false;
    this.cursor--;
    this.sync();
    return true;
  }

  restoreFromSession(): boolean {
    try {
      const raw = sessionStorage.getItem('redview_watch_queue');
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data.buffer?.length) return false;
      this.buffer = data.buffer;
      this.cursor = data.cursor;
      this.gen = null;
      this.generator = null;
      this.prefetchPromise = null;
      this.exhausted = true; // no generator on refresh
      this.sync();
      return true;
    } catch {
      return false;
    }
  }

  persistToSession(): void {
    try {
      sessionStorage.setItem('redview_watch_queue', JSON.stringify({
        buffer: this.buffer,
        cursor: this.cursor,
      }));
    } catch {}
  }

  clear(): void {
    this.buffer = [];
    this.cursor = 0;
    this.gen = null;
    this.generator = null;
    this.prefetchPromise = null;
    this.exhausted = false;
    this.current.set(null);
    this.position.set(0);
    this.total.set(0);
    this.hasNext.set(false);
    this.hasPrev.set(false);
    this.loading.set(false);
    sessionStorage.removeItem('redview_watch_queue');
  }

  private ensureBuffer(): void {
    if (this.prefetchPromise || this.exhausted || !this.generator) return;
    const remaining = this.buffer.length - this.cursor;
    if (remaining > 5) return;
    this.prefetchPromise = this.generator.next().then(r => {
      this.prefetchPromise = null;
      if (r.done) {
        this.exhausted = true;
      } else {
        this.buffer.push(...r.value);
      }
      return r;
    });
  }

  private async consumePrefetch(): Promise<boolean> {
    if (this.prefetchPromise) await this.prefetchPromise;
    if (this.exhausted || this.cursor >= this.buffer.length - 1) return false;
    this.cursor++;
    return true;
  }

  private sync(): void {
    this.current.set(this.buffer[this.cursor] ?? null);
    this.position.set(this.cursor + 1);
    this.total.set(this.buffer.length);
    this.hasNext.set(this.cursor < this.buffer.length - 1 || (!this.exhausted && !!this.generator));
    this.hasPrev.set(this.cursor > 0);
  }
}
