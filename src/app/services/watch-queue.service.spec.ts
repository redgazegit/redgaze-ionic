import { TestBed } from '@angular/core/testing';
import { WatchQueueService } from './watch-queue.service';
import { fakeGif } from '../testing/test-utils';
import { testStorage } from '../../test-setup';

describe('WatchQueueService', () => {
  let service: WatchQueueService;

  beforeEach(() => {
    testStorage.clearAll();
    TestBed.configureTestingModule({});
    service = TestBed.inject(WatchQueueService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize signals to default values', () => {
    expect(service.current()).toBeNull();
    expect(service.position()).toBe(1);
    expect(service.total()).toBe(0);
    expect(service.hasNext()).toBe(false);
    expect(service.hasPrev()).toBe(false);
    expect(service.loading()).toBe(false);
  });

  it('should set queue and update signals', () => {
    const gifs = [fakeGif({ id: 'a' }), fakeGif({ id: 'b' }), fakeGif({ id: 'c' })];
    service.setQueue(gifs, 1);
    expect(service.current()?.id).toBe('b');
    expect(service.position()).toBe(2);
    expect(service.total()).toBe(3);
    expect(service.hasNext()).toBe(true);
    expect(service.hasPrev()).toBe(true);
  });

  it('should set queue at index 0', () => {
    const gifs = [fakeGif({ id: 'a' }), fakeGif({ id: 'b' })];
    service.setQueue(gifs, 0);
    expect(service.current()?.id).toBe('a');
    expect(service.position()).toBe(1);
    expect(service.hasPrev()).toBe(false);
  });

  it('should navigate next() and update cursor', async () => {
    const gifs = [fakeGif({ id: 'a' }), fakeGif({ id: 'b' }), fakeGif({ id: 'c' })];
    service.setQueue(gifs, 0);
    const moved = await service.next();
    expect(moved).toBe(true);
    expect(service.current()?.id).toBe('b');
    expect(service.position()).toBe(2);
  });

  it('should navigate prev() and update cursor', () => {
    const gifs = [fakeGif({ id: 'a' }), fakeGif({ id: 'b' })];
    service.setQueue(gifs, 1);
    const moved = service.prev();
    expect(moved).toBe(true);
    expect(service.current()?.id).toBe('a');
    expect(service.position()).toBe(1);
  });

  it('should return false from prev() at start', () => {
    const gifs = [fakeGif({ id: 'a' }), fakeGif({ id: 'b' })];
    service.setQueue(gifs, 0);
    expect(service.prev()).toBe(false);
    expect(service.current()?.id).toBe('a');
  });

  it('should persist and restore from sessionStorage', () => {
    const gifs = [fakeGif({ id: 'a' }), fakeGif({ id: 'b' })];
    service.setQueue(gifs, 1);
    service.persistToSession();
    const raw = window.sessionStorage.getItem('redview_watch_queue');
    expect(raw).toBeTruthy();
    const data = JSON.parse(raw!);
    expect(data.buffer).toHaveLength(2);
    expect(data.cursor).toBe(1);
  });

  it('should restore from sessionStorage', () => {
    window.sessionStorage.setItem('redview_watch_queue', JSON.stringify({
      buffer: [fakeGif({ id: 'x' }), fakeGif({ id: 'y' })],
      cursor: 1
    }));
    const restored = service.restoreFromSession();
    expect(restored).toBe(true);
    expect(service.current()?.id).toBe('y');
    expect(service.position()).toBe(2);
  });

  it('should clear and reset everything', () => {
    const gifs = [fakeGif({ id: 'a' }), fakeGif({ id: 'b' })];
    service.setQueue(gifs, 0);
    service.clear();
    expect(service.current()).toBeNull();
    expect(service.position()).toBe(0);
    expect(service.total()).toBe(0);
    expect(service.hasNext()).toBe(false);
    expect(service.hasPrev()).toBe(false);
    expect(service.loading()).toBe(false);
  });
});