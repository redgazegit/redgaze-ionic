import { Component, inject, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { Gif } from '../../models/gif.model';
import { FavoritesService } from '../../services/favorites.service';

import { IonicModule } from '@ionic/angular';

@Component({
    selector: 'app-gif-card',
    templateUrl: './gif-card.component.html',
    styleUrls: ['./gif-card.component.scss'],
    imports: [IonicModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GifCardComponent {
  private favService = inject(FavoritesService);

  readonly gif = input.required<Gif>();
  readonly posterSrc = signal('');

  cardClick = output<string>();
  creatorClick = output<string>();

  ngOnInit(): void {
    const thumb = this.gif().urls.thumbnail;
    this.posterSrc.set(thumb?.replace('https://media.redgifs.com', '/cdn') || '');
  }

  get isFav(): boolean {
    return this.favService.isFavorite(this.gif().id);
  }

  toggleFav(event: Event): void {
    event.stopPropagation();
    this.favService.toggle(this.gif());
  }

  goToCreator(event: Event): void {
    event.stopPropagation();
    const gif = this.gif();
    if (gif.userName) {
      this.creatorClick.emit(gif.userName);
    }
  }

  onCardClick(event: Event): void {
    event.stopPropagation();
    this.cardClick.emit(this.gif().id);
  }
}
