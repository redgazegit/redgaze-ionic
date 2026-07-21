import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { FavoritesService } from '../../services/favorites.service';
import { Gif } from '../../models/gif.model';
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';

import { RouterLink } from '@angular/router';
import { GifCardComponent } from '../../components/gif-card/gif-card.component';
import { VideoPlayerComponent } from '../../components/video-player/video-player.component';

@Component({
    selector: 'app-favorites',
    templateUrl: './favorites.page.html',
    styleUrls: ['./favorites.page.scss'],
    imports: [
    IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar,
    RouterLink,
    GifCardComponent,
    VideoPlayerComponent
],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavoritesPage implements OnInit {
  private favService = inject(FavoritesService);

  favorites: Gif[] = [];
  viewMode: 'grid' | 'list' = 'grid';

  ngOnInit(): void {
    this.favService.favorites$.subscribe(f => this.favorites = f);
  }
}
