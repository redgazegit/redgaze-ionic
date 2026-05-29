import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Gif } from '../models/gif.model';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly STORAGE_KEY = 'redview-favorites';
  private favoritesSubject = new BehaviorSubject<Gif[]>([]);
  favorites$: Observable<Gif[]> = this.favoritesSubject.asObservable();

  constructor() {
    this.load();
  }

  private load(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try { this.favoritesSubject.next(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }

  private save(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.favoritesSubject.value));
  }

  toggle(gif: Gif): void {
    const current = this.favoritesSubject.value;
    const exists = current.find(g => g.id === gif.id);
    if (exists) {
      this.favoritesSubject.next(current.filter(g => g.id !== gif.id));
    } else {
      this.favoritesSubject.next([gif, ...current]);
    }
    this.save();
  }

  isFavorite(id: string): boolean {
    return !!this.favoritesSubject.value.find(g => g.id === id);
  }

  getAll(): Gif[] {
    return this.favoritesSubject.value;
  }
}
