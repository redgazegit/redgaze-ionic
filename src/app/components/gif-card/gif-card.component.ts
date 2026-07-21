import { Component, inject, input, output, signal, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { Gif } from '../../models/gif.model';
import { FavoritesService } from '../../services/favorites.service';
import { RedgifsApiService } from '../../services/redgifs-api.service';
import { MediaProxyService } from '../../services/media-proxy.service';

import { IonIcon } from '@ionic/angular/standalone';

@Component({
    selector: 'app-gif-card',
    templateUrl: './gif-card.component.html',
    styleUrls: ['./gif-card.component.scss'],
    imports: [IonIcon],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GifCardComponent implements OnInit, OnDestroy {
  private favService = inject(FavoritesService);
  private api = inject(RedgifsApiService);
  private mediaProxy = inject(MediaProxyService);

  readonly gif = input.required<Gif>();
  readonly posterSrc = signal('');
  readonly loading = signal(true);

  cardClick = output<string>();
  creatorClick = output<string>();
  private blobUrl: string | null = null;

  async ngOnInit(): Promise<void> {
    const thumb = this.gif().urls.thumbnail;
    if (!thumb) return;
    const proxied = this.api.proxyUrl(thumb);
    const blob = await this.mediaProxy.proxyImage(proxied);
    if (blob !== proxied) this.blobUrl = blob;
    this.posterSrc.set(blob);
  }

  ngOnDestroy(): void {
    if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
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
