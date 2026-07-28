import { Component, OnInit, inject, viewChild, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { injectQuery, injectMutation } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { RedgifsApiService } from '../../services/redgifs-api.service';
import { FavoritesService } from '../../services/favorites.service';
import { SettingsService } from '../../services/settings.service';
import { VideoPlayerComponent } from '../../components/video-player/video-player.component';
import { DatePipe } from '@angular/common';
import { IonBackButton, IonBadge, IonButton, IonButtons, IonChip, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonNote, IonSpinner, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
    selector: 'app-watch',
    templateUrl: './watch.page.html',
    styleUrls: ['./watch.page.scss'],
    imports: [
    VideoPlayerComponent,
    IonBackButton, IonBadge, IonButton, IonButtons, IonChip, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonNote, IonSpinner, IonTitle, IonToolbar,
    DatePipe,
    RouterLink
],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WatchPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(RedgifsApiService);
  protected settings = inject(SettingsService);
  favService = inject(FavoritesService);

  readonly playerRef = viewChild(VideoPlayerComponent);

  private readonly id = signal('');

  readonly gifQuery = injectQuery(() => ({
    queryKey: ['gif', this.id()],
    queryFn: () => firstValueFrom(this.api.getGif(this.id())),
    enabled: this.id() !== '',
    staleTime: 1000 * 60 * 5,
  }));

  readonly trackViewMutation = injectMutation(() => ({
    mutationFn: (gifId: string) => firstValueFrom(this.api.trackContentViewed(gifId)),
  }));

  readonly trackDurationMutation = injectMutation(() => ({
    mutationFn: ({ gifId, duration }: { gifId: string; duration: number }) =>
      firstValueFrom(this.api.trackViewedDuration(gifId, duration)),
  }));

  readonly gif = computed(() => this.gifQuery.data());
  readonly loading = computed(() => this.gifQuery.isLoading());
  readonly error = computed(() => this.gifQuery.isError());

  ngOnInit(): void {
    this.id.set(this.route.snapshot.paramMap.get('id') || '');
    if (this.id()) {
      this.trackViewMutation.mutate(this.id());
    }
  }

  onDuration(event: {gifId: string; duration: number}): void {
    this.trackDurationMutation.mutate(event);
  }

  goToCreator(): void {
    const g = this.gif();
    if (g?.userName) {
      this.router.navigate(['/creator', g.userName]);
    }
  }
}
