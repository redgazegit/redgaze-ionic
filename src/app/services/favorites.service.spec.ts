import { TestBed } from '@angular/core/testing';
import { FavoritesService } from './favorites.service';
import { fakeGif } from '../testing/test-utils';
import { testStorage } from '../../test-setup';

describe('FavoritesService', () => {
  let service: FavoritesService;

  beforeEach(() => {
    // Clear storage BEFORE creating the service to ensure clean state
    testStorage.clearAll();
    TestBed.configureTestingModule({});
    service = TestBed.inject(FavoritesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have empty favorites initially', () => {
    const favorites = service.getAll();
    expect(favorites).toEqual([]);
    expect(favorites).toHaveLength(0);
  });

  it('should add favorite when toggling', () => {
    const gif = fakeGif({ id: 'test-1' });
    service.toggle(gif);
    const favorites = service.getAll();
    expect(favorites).toHaveLength(1);
    expect(favorites[0].id).toBe('test-1');
  });

  it('should remove favorite when toggling again', () => {
    const gif = fakeGif({ id: 'test-2' });
    service.toggle(gif); // Add first time
    service.toggle(gif); // Remove second time
    const favorites = service.getAll();
    expect(favorites).toHaveLength(0);
  });

  it('should return correct isFavorite status', () => {
    const gif = fakeGif({ id: 'test-3' });
    expect(service.isFavorite(gif.id)).toBe(false);
    service.toggle(gif);
    expect(service.isFavorite(gif.id)).toBe(true);
    service.toggle(gif);
    expect(service.isFavorite(gif.id)).toBe(false);
  });
});