import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { RedgifsApiService } from './services/redgifs-api.service';
import { ThemeService } from './services/theme.service';
import { SettingsService } from './services/settings.service';
import { MockRedgifsApiService, MockThemeService, MockSettingsService } from './testing/service-mocks';
import { testStorage } from '../test-setup';

describe('AppComponent', () => {
  let mockTheme: MockThemeService;
  let mockSettings: MockSettingsService;

  beforeEach(async () => {
    testStorage.clearAll();
    mockTheme = new MockThemeService();
    mockSettings = new MockSettingsService();

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: RedgifsApiService, useValue: new MockRedgifsApiService() },
        { provide: ThemeService, useValue: mockTheme },
        { provide: SettingsService, useValue: mockSettings },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});