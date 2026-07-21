import { Component, OnInit, signal, effect, inject, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { injectQuery, injectInfiniteQuery } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { RedgifsApiService } from '../../services/redgifs-api.service';
import { SettingsService } from '../../services/settings.service';
import { WatchQueueService } from '../../services/watch-queue.service';
import { creatorFeedGenerator } from '../../services/feed-generators';
import { Gif, User } from '../../models/gif.model';
import { IonAvatar, IonBackButton, IonBadge, IonButton, IonButtons, IonChip, IonContent, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonNote, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { DecimalPipe, DatePipe } from '@angular/common';
import { GifCardComponent } from '../../components/gif-card/gif-card.component';
import { VideoPlayerComponent } from '../../components/video-player/video-player.component';
import { SkeletonCardComponent } from '../../components/skeleton-card/skeleton-card.component';

@Component({
    selector: 'app-creator-detail',
    templateUrl: './creator-detail.page.html',
    styleUrls: ['./creator-detail.page.scss'],
    imports: [
    IonAvatar, IonBackButton, IonBadge, IonButton, IonButtons, IonChip, IonContent, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonNote, IonTitle, IonToolbar,
    GifCardComponent,
    VideoPlayerComponent,
    SkeletonCardComponent,
    DecimalPipe,
    DatePipe
],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatorDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  api = inject(RedgifsApiService);
  ss = inject(SettingsService);
  private watchQueue = inject(WatchQueueService);

  readonly username = signal('');
  readonly sortOrder = signal(localStorage.getItem('redgaze_creator_sort') || 'recent');
  viewMode: 'grid' | 'list' = (localStorage.getItem('redgaze_creator_view') as 'grid' | 'list') || 'grid';

  readonly sortOptions = [
    { value: 'recent', label: 'Recent' },
    { value: 'trending', label: 'Trending' },
    { value: 'top', label: 'Top' },
    { value: 'best', label: 'Best' },
    { value: 'oldest', label: 'Oldest' },
  ];

  readonly userQuery = injectQuery(() => ({
    queryKey: ['user', this.username()],
    queryFn: () => firstValueFrom(this.api.getUser(this.username())),
    enabled: this.username() !== '',
    staleTime: 1000 * 60 * 5,
  }));

  readonly gifsQuery = injectInfiniteQuery(() => ({
    queryKey: ['creator-gifs', this.username(), this.sortOrder()],
    queryFn: ({ pageParam }) => firstValueFrom(
      this.api.searchCreator(this.username(), pageParam as number, 80, this.sortOrder())
    ),
    initialPageParam: 1,
    getNextPageParam: lastPage => lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
    enabled: this.username() !== '',
    staleTime: 1000 * 60 * 2,
  }));

  get user(): User | undefined { return this.userQuery.data(); }
  get gifs(): Gif[] { return this.gifsQuery.data()?.pages.reduce((acc: Gif[], p) => [...acc, ...p.gifs], [] as Gif[]) ?? []; }
  get loading(): boolean { return this.gifsQuery.isFetching() && this.gifsQuery.data()?.pages.length === 0; }
  get hasMore(): boolean { return this.gifsQuery.hasNextPage(); }
  get socialLinks(): { domain: string; url: string }[] {
    const links = this.user?.links || [];
    const seen = new Set<string>();
    return links.filter(l => {
      const key = `${l.domain}|${l.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  constructor() {
    effect(() => {
      localStorage.setItem('redgaze_creator_sort', this.sortOrder());
    });
  }

  ngOnInit(): void {
    this.username.set(this.route.snapshot.paramMap.get('username') || '');
  }

  setSort(order: string): void {
    this.sortOrder.set(order);
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
    localStorage.setItem('redgaze_creator_view', this.viewMode);
  }

  loadMore(): void {
    if (this.hasMore && !this.gifsQuery.isFetching()) {
      this.gifsQuery.fetchNextPage();
    }
  }

  onCardClick(gifId: string, index: number): void {
    if (this.ss.get().storiesNavigation) {
      this.watchQueue.setQueue(this.gifs, index, creatorFeedGenerator(this.api, this.username(), this.sortOrder()));
      this.router.navigate(['/stories', gifId]);
    } else {
      this.router.navigate(['/watch', gifId]);
    }
  }

  onCreatorClick(username: string): void {
    this.router.navigate(['/creator', username]);
  }
}
