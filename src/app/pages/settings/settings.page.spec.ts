import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SettingsPage } from './settings.page';
import { ThemeService } from '../../services/theme.service';
import { SettingsService } from '../../services/settings.service';
import { MockThemeService, MockSettingsService } from '../../testing/service-mocks';

describe('SettingsPage', () => {
  let mockTheme: MockThemeService;
  let mockSettings: MockSettingsService;

  beforeEach(async () => {
    mockTheme = new MockThemeService();
    mockSettings = new MockSettingsService();

    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        { provide: ThemeService, useValue: mockTheme },
        { provide: SettingsService, useValue: mockSettings },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(SettingsPage);
    const page = fixture.componentInstance;
    expect(page).toBeTruthy();
  });

  it('should have default theme mode from service', () => {
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    expect(page.currentMode()).toBe('system');
  });

  it('should toggle dark mode', () => {
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    vi.spyOn(mockTheme, 'setMode');
    page.toggleDarkMode();
    expect(page.currentMode()).toBe('dark');
    expect(mockTheme.setMode).toHaveBeenCalledWith('dark');
  });

  it('should toggle quality', () => {
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    vi.spyOn(mockSettings, 'update');
    page.toggleQuality();
    expect(mockSettings.update).toHaveBeenCalledWith({ quality: 'sd' });
  });

  it('should toggle HLS playback mode', () => {
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    vi.spyOn(mockSettings, 'update');
    page.toggleHls();
    expect(mockSettings.update).toHaveBeenCalledWith({ playbackMode: 'hls' });
  });
});