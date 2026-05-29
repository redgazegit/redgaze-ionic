import { TestBed } from '@angular/core/testing';
import { SettingsService, AppSettings } from './settings.service';
import { testStorage } from '../../test-setup';

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(() => {
    testStorage.clearAll();
    TestBed.configureTestingModule({});
    service = TestBed.inject(SettingsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with default settings', () => {
    const s = service.get();
    expect(s.playbackMode).toBe('mp4');
    expect(s.quality).toBe('hd');
    expect(s.rateLimitEnabled).toBe(true);
    expect(s.storiesNavigation).toBe(true);
    expect(s.gridAutoplay).toBe(true);
  });

  it('should update single property', () => {
    service.update({ playbackMode: 'hls', quality: 'sd' });
    const s = service.get();
    expect(s.playbackMode).toBe('hls');
    expect(s.quality).toBe('sd');
  });

  it('should persist to localStorage on update', () => {
    service.update({ playbackMode: 'hls' });
    const raw = window.localStorage.getItem('redview-settings');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.playbackMode).toBe('hls');
    expect(parsed.quality).toBe('hd');
  });

  it('should restore settings from localStorage', () => {
    window.localStorage.setItem('redview-settings', JSON.stringify({
      playbackMode: 'hls', quality: 'sd', rateLimitEnabled: false,
      storiesNavigation: false, gridAutoplay: false
    }));
    const s2 = new SettingsService();
    expect(s2.get().playbackMode).toBe('hls');
    expect(s2.get().quality).toBe('sd');
    expect(s2.get().rateLimitEnabled).toBe(false);
  });

  it('should fall back to defaults when localStorage is corrupted', () => {
    window.localStorage.setItem('redview-settings', 'not-json');
    const s2 = new SettingsService();
    const s = s2.get();
    expect(s.playbackMode).toBe('mp4');
    expect(s.quality).toBe('hd');
  });

  it('should emit on settings$ when updated', () => {
    return new Promise<void>(resolve => {
      service.settings$.subscribe(s => {
        if (s.playbackMode === 'hls') {
          expect(s.quality).toBe('sd');
          resolve();
        }
      });
      service.update({ playbackMode: 'hls', quality: 'sd' });
    });
  });
});