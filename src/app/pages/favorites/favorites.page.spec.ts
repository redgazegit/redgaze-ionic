import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FavoritesPage } from './favorites.page';
import { FavoritesService } from '../../services/favorites.service';
import { MockFavoritesService } from '../../testing/service-mocks';
import { fakeGif } from '../../testing/test-utils';

describe('FavoritesPage', () => {
  let mockFav: MockFavoritesService;

  beforeEach(async () => {
    mockFav = new MockFavoritesService();
    vi.spyOn(mockFav, 'getAll').mockReturnValue([
      fakeGif({ id: 'fav-1', description: 'First fav' }),
      fakeGif({ id: 'fav-2', description: 'Second fav' }),
    ]);
    vi.spyOn(mockFav, 'isFavorite').mockReturnValue(true);
    vi.spyOn(mockFav, 'favorites$', 'get').mockReturnValue({
      subscribe: vi.fn((cb: any) => {
        cb([fakeGif({ id: 'fav-1' }), fakeGif({ id: 'fav-2' })]);
        return { unsubscribe: vi.fn() };
      })
    } as any);

    await TestBed.configureTestingModule({
      imports: [FavoritesPage],
      providers: [
        provideRouter([]),
        { provide: FavoritesService, useValue: mockFav },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(FavoritesPage);
    const page = fixture.componentInstance;
    expect(page).toBeTruthy();
  });

  it('should load favorites on init', () => {
    const fixture = TestBed.createComponent(FavoritesPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    expect(page.favorites.length).toBeGreaterThanOrEqual(2);
  });
});