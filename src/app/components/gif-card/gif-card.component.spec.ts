import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GifCardComponent } from './gif-card.component';
import { FavoritesService } from '../../services/favorites.service';
import { RedgifsApiService } from '../../services/redgifs-api.service';
import { MockFavoritesService, MockRedgifsApiService } from '../../testing/service-mocks';
import { fakeGif } from '../../testing/test-utils';

describe('GifCardComponent', () => {
  let mockFav: MockFavoritesService;

  beforeEach(async () => {
    mockFav = new MockFavoritesService();

    await TestBed.configureTestingModule({
      imports: [GifCardComponent],
      providers: [
        { provide: FavoritesService, useValue: mockFav },
        { provide: RedgifsApiService, useValue: new MockRedgifsApiService() },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  function createComponent(gif = fakeGif()) {
    const fixture = TestBed.createComponent(GifCardComponent);
    fixture.componentRef.setInput('gif', gif);
    fixture.detectChanges();
    return fixture;
  }

  it('should create', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should set posterSrc from thumbnail on init', async () => {
    const gif = fakeGif({ urls: { ...fakeGif({}).urls, thumbnail: 'https://media.redgifs.com/test.jpg' } });
    const fixture = createComponent(gif);
    await fixture.whenStable();
    expect(fixture.componentInstance.posterSrc()).toBe('/cdn/test.jpg');
  });

  it('should set posterSrc to empty when no thumbnail', () => {
    const gif = fakeGif({ urls: { ...fakeGif({}).urls, thumbnail: '' } });
    const fixture = createComponent(gif);
    expect(fixture.componentInstance.posterSrc()).toBe('');
  });

  it('should emit cardClick on card click', () => {
    const gif = fakeGif({ id: 'test-card-id' });
    const fixture = createComponent(gif);
    const spy = vi.fn();
    fixture.componentInstance.cardClick.subscribe(spy);
    fixture.componentInstance.onCardClick(new MouseEvent('click'));
    expect(spy).toHaveBeenCalledWith('test-card-id');
  });

  it('should emit creatorClick on goToCreator', () => {
    const gif = fakeGif({ userName: 'testuser', id: 'creator-test' });
    const fixture = createComponent(gif);
    const spy = vi.fn();
    fixture.componentInstance.creatorClick.subscribe(spy);
    fixture.componentInstance.goToCreator(new MouseEvent('click'));
    expect(spy).toHaveBeenCalledWith('testuser');
  });

  it('should call toggle on favService when toggling fav', () => {
    const gif = fakeGif({ id: 'toggle-test' });
    vi.spyOn(mockFav, 'toggle');
    const fixture = createComponent(gif);
    fixture.componentInstance.toggleFav(new MouseEvent('click'));
    expect(mockFav.toggle).toHaveBeenCalledWith(gif);
  });

  it('should reflect isFav from favorites service', () => {
    const gif = fakeGif({ id: 'fav-check' });
    vi.spyOn(mockFav, 'isFavorite').mockReturnValue(true);
    const fixture = createComponent(gif);
    expect(fixture.componentInstance.isFav()).toBe(true);
  });
});