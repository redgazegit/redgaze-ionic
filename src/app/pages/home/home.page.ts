import { Component, signal, inject, effect, ChangeDetectionStrategy } from '@angular/core';
import { injectQuery, injectInfiniteQuery } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { RedgifsApiService } from '../../services/redgifs-api.service';
import { SettingsService } from '../../services/settings.service';
import { WatchQueueService } from '../../services/watch-queue.service';
import { homeFeedGenerator } from '../../services/feed-generators';
import { Gif, Creator, TagSuggestion, Niche, SearchResult } from '../../models/gif.model';
import { IonAvatar, IonBadge, IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonChip, IonContent, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonRefresher, IonRefresherContent, IonSegment, IonSegmentButton, IonSpinner, IonTitle, IonToolbar } from '@ionic/angular/standalone';

import { GifCardComponent } from '../../components/gif-card/gif-card.component';
import { VideoPlayerComponent } from '../../components/video-player/video-player.component';
import { SkeletonCardComponent } from '../../components/skeleton-card/skeleton-card.component';
import { Router, RouterLink } from '@angular/router';

@Component({
    selector: 'app-home',
    templateUrl: './home.page.html',
    styleUrls: ['./home.page.scss'],
    imports: [
    IonAvatar, IonBadge, IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonChip, IonContent, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonRefresher, IonRefresherContent, IonSegment, IonSegmentButton, IonTitle, IonToolbar,
    GifCardComponent,
    VideoPlayerComponent,
    SkeletonCardComponent,
    RouterLink
],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  api = inject(RedgifsApiService);
  private router = inject(Router);
  ss = inject(SettingsService);
  private watchQueue = inject(WatchQueueService);

  readonly selectedSection = signal(localStorage.getItem('redgaze_home_section') || 'trending');
  readonly viewMode = signal<'grid' | 'list'>((localStorage.getItem('redgaze_home_view') as 'grid' | 'list') || 'grid');

  readonly sections = [
    { id: 'trending', label: 'Trending' },
    { id: 'popular', label: 'Popular' },
    { id: 'top-week', label: 'Top Week' },
    { id: 'top28', label: 'Top 28d' },
    { id: 'top', label: 'Top All' },
    { id: 'score', label: 'Best' },
    { id: 'latest', label: 'Latest' },
  ];

  readonly trendingGifsQuery = injectQuery(() => ({
    queryKey: ['home-trending-gifs'],
    queryFn: () => firstValueFrom(this.api.getPopularFeed('trending', 40, 1).pipe(map(r => r.gifs))),
    staleTime: 1000 * 60 * 2,
  }));

  readonly sidebarTagsReady = signal(false);
  readonly sidebarCreatorsReady = signal(false);
  readonly sidebarNichesReady = signal(false);

  readonly trendingTagsQuery = injectQuery(() => ({
    queryKey: ['home-trending-tags'],
    queryFn: () => firstValueFrom(this.api.getTrendingTags()),
    staleTime: 1000 * 60 * 30,
    enabled: this.sidebarTagsReady(),
  }));

  readonly trendingCreatorsQuery = injectQuery(() => ({
    queryKey: ['home-trending-creators'],
    queryFn: () => firstValueFrom(this.api.getTrendingCreators()),
    staleTime: 1000 * 60 * 30,
    enabled: this.sidebarCreatorsReady(),
  }));

  readonly trendingNichesQuery = injectQuery(() => ({
    queryKey: ['home-trending-niches'],
    queryFn: () => firstValueFrom(this.api.getNicheTrending()),
    staleTime: 1000 * 60 * 30,
    enabled: this.sidebarNichesReady(),
  }));

  private feedFn(section: string, page: number): Promise<SearchResult> {
    switch (section) {
      case 'popular':
        return firstValueFrom(this.api.getPopularFeed('trending', 40, page));
      case 'top-week':
        return firstValueFrom(this.api.getTopThisWeek(30, page));
      case 'top28':
        return firstValueFrom(this.api.searchGifs('', 'top28', 40, page));
      case 'top':
        return firstValueFrom(this.api.searchGifs('', 'top', 40, page));
      case 'score':
        return firstValueFrom(this.api.searchGifs('', 'score', 40, page));
      case 'latest':
        return firstValueFrom(this.api.searchGifs('', 'latest', 40, page));
      default:
        return firstValueFrom(this.api.searchGifs('', 'trending', 40, page));
    }
  }

  readonly feedQuery = injectInfiniteQuery(() => ({
    queryKey: ['home-feed', this.selectedSection()],
    queryFn: ({ pageParam }) => this.feedFn(this.selectedSection(), pageParam as number),
    initialPageParam: 1,
    getNextPageParam: lastPage => lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
    staleTime: 1000 * 60 * 2,
    enabled: this.selectedSection() !== 'trending',
  }));

  constructor() {
    effect(() => {
      localStorage.setItem('redgaze_home_section', this.selectedSection());
    });
    effect(() => {
      localStorage.setItem('redgaze_home_view', this.viewMode());
    });
    effect(() => {
      if (this.trendingGifsQuery.isSuccess()) {
        setTimeout(() => this.sidebarTagsReady.set(true), 2000);
      }
    });
    effect(() => {
      if (this.sidebarTagsReady()) {
        setTimeout(() => this.sidebarCreatorsReady.set(true), 2000);
      }
    });
    effect(() => {
      if (this.sidebarCreatorsReady()) {
        setTimeout(() => this.sidebarNichesReady.set(true), 2000);
      }
    });
  }

  get trendingGifs(): Gif[] { return this.trendingGifsQuery.data()?.slice(0, 20) ?? []; }
  get trendingTags(): TagSuggestion[] { return this.trendingTagsQuery.data()?.slice(0, 10) ?? []; }
  get trendingCreators(): Creator[] { return this.trendingCreatorsQuery.data()?.slice(0, 10) ?? []; }
  get trendingNiches(): Niche[] { return this.trendingNichesQuery.data()?.slice(0, 10) ?? []; }

  get gifs(): Gif[] {
    if (this.selectedSection() === 'trending') {
      return this.trendingGifsQuery.data() ?? [];
    }
    return this.feedQuery.data()?.pages.reduce((acc: Gif[], p) => [...acc, ...p.gifs], [] as Gif[]) ?? [];
  }

  get loading(): boolean {
    if (this.selectedSection() === 'trending') {
      return this.trendingGifsQuery.isLoading();
    }
    return this.feedQuery.isLoading();
  }

  get hasMore(): boolean {
    if (this.selectedSection() === 'trending') return false;
    return this.feedQuery.hasNextPage();
  }

  switchSection(section: string): void {
    this.selectedSection.set(section);
  }

  async loadMore(event?: any): Promise<void> {
    if (this.hasMore && !this.feedQuery.isFetching()) {
      await this.feedQuery.fetchNextPage();
    }
    event?.target.complete();
  }

  async doRefresh(event: any): Promise<void> {
    localStorage.removeItem('redgifs_trending_tags');
    localStorage.removeItem('redgifs_trending_creators');
    localStorage.removeItem('redgifs_trending_niches');
    await Promise.all([
      this.trendingGifsQuery.refetch(),
      this.trendingTagsQuery.refetch(),
      this.trendingCreatorsQuery.refetch(),
      this.trendingNichesQuery.refetch(),
      this.feedQuery.refetch(),
    ]);
    event.target.complete();
  }

  onCardClick(gifId: string, index: number): void {
    const section = this.selectedSection();
    if (this.ss.get().storiesNavigation && section !== 'trending') {
      this.watchQueue.setQueue(this.gifs, index, homeFeedGenerator(this.api, section));
      this.router.navigate(['/stories', gifId]);
    } else if (this.ss.get().storiesNavigation) {
      this.watchQueue.setQueue(this.gifs, index);
      this.router.navigate(['/stories', gifId]);
    } else {
      this.router.navigate(['/watch', gifId]);
    }
  }

  onCreatorClick(username: string): void {
    this.router.navigate(['/creator', username]);
  }
}
