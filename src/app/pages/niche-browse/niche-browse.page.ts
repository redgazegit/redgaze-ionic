import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { injectInfiniteQuery } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { RedgifsApiService } from '../../services/redgifs-api.service';
import { SettingsService } from '../../services/settings.service';
import { WatchQueueService } from '../../services/watch-queue.service';
import { nicheFeedGenerator } from '../../services/feed-generators';
import { Gif, Niche } from '../../models/gif.model';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonSpinner, IonTitle, IonToolbar } from '@ionic/angular/standalone';

import { GifCardComponent } from '../../components/gif-card/gif-card.component';

@Component({
    selector: 'app-niche-browse',
    templateUrl: './niche-browse.page.html',
    styleUrls: ['./niche-browse.page.scss'],
    imports: [
    IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonSpinner, IonTitle, IonToolbar,
    GifCardComponent
],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NicheBrowsePage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(RedgifsApiService);
  private ss = inject(SettingsService);
  private watchQueue = inject(WatchQueueService);

  readonly nicheId = signal('');
  niche?: Niche;

  readonly gifsQuery = injectInfiniteQuery(() => ({
    queryKey: ['nicheGifs', this.nicheId()],
    queryFn: ({ pageParam }) => firstValueFrom(
      this.api.getNicheGifs(this.nicheId(), '', 40, pageParam as number)
    ),
    initialPageParam: 1,
    getNextPageParam: lastPage => lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
    enabled: this.nicheId() !== '',
    staleTime: 1000 * 60 * 2,
  }));

  readonly gifs = computed(() => this.gifsQuery.data()?.pages.reduce((acc: Gif[], p) => [...acc, ...p.gifs], [] as Gif[]) ?? []);
  readonly loading = computed(() => this.gifsQuery.isLoading());
  readonly error = computed(() => this.gifsQuery.isError());
  readonly empty = computed(() => !this.loading() && !this.error() && this.gifs().length === 0);
  readonly hasMore = computed(() => this.gifsQuery.hasNextPage());

  ngOnInit(): void {
    this.nicheId.set(this.route.snapshot.paramMap.get('nicheId') || '');
  }

  loadMore(): void {
    if (this.hasMore() && !this.gifsQuery.isFetching()) {
      this.gifsQuery.fetchNextPage();
    }
  }

  onCardClick(gifId: string, index: number): void {
    if (this.ss.get().storiesNavigation) {
      this.watchQueue.setQueue(this.gifs(), index, nicheFeedGenerator(this.api, this.nicheId()));
      this.router.navigate(['/stories', gifId]);
    } else {
      this.router.navigate(['/watch', gifId]);
    }
  }

  onCreatorClick(username: string): void {
    this.router.navigate(['/creator', username]);
  }
}
