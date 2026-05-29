import { TestBed } from '@angular/core/testing';
import { VideoStateService } from './video-state.service';

describe('VideoStateService', () => {
  let service: VideoStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VideoStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with activeGifId = null', () => {
    expect(service.activeGifId()).toBeNull();
  });

  it('should allow play when no active video', () => {
    const result = service.requestPlay('gif-1');
    expect(result).toBe(true);
    expect(service.activeGifId()).toBe('gif-1');
  });

  it('should allow play when same gif is already active', () => {
    service.requestPlay('gif-1');
    const result = service.requestPlay('gif-1');
    expect(result).toBe(true);
    expect(service.activeGifId()).toBe('gif-1');
  });

  it('should deny play when different gif is active', () => {
    service.requestPlay('gif-1');
    const result = service.requestPlay('gif-2');
    expect(result).toBe(false);
    expect(service.activeGifId()).toBe('gif-1');
  });

  it('should clear active onPause when matching gifId', () => {
    service.requestPlay('gif-1');
    service.onPause('gif-1');
    expect(service.activeGifId()).toBeNull();
  });

  it('should NOT clear active onPause when different gifId', () => {
    service.requestPlay('gif-1');
    service.onPause('gif-2');
    expect(service.activeGifId()).toBe('gif-1');
  });

  it('should allow play after previous video is paused', () => {
    service.requestPlay('gif-1');
    service.onPause('gif-1');
    const result = service.requestPlay('gif-2');
    expect(result).toBe(true);
    expect(service.activeGifId()).toBe('gif-2');
  });
});