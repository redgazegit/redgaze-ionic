import { Component, OnInit, OnDestroy, signal, effect, inject, ChangeDetectionStrategy, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { Subject, Subscription, firstValueFrom, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { RedgifsApiService } from '../../services/redgifs-api.service';
import { SettingsService } from '../../services/settings.service';
import { WatchQueueService } from '../../services/watch-queue.service';
import { searchFeedGenerator } from '../../services/feed-generators';
import { Gif, TagSuggestion, User } from '../../models/gif.model';

import { IonAvatar, IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonChip, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonSearchbar, IonSegment, IonSegmentButton, IonSpinner, IonToolbar } from '@ionic/angular/standalone';

import { GifCardComponent } from '../../components/gif-card/gif-card.component';
import { SkeletonCardComponent } from '../../components/skeleton-card/skeleton-card.component';
import { JsonPipe } from '@angular/common';

@Component({
    selector: 'app-search',
    templateUrl: './search.page.html',
    styleUrls: ['./search.page.scss'],
    imports: [
    IonAvatar, IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonChip, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonSearchbar, IonSegment, IonSegmentButton, IonToolbar,
    GifCardComponent,
    SkeletonCardComponent,
    RouterLink,
    JsonPipe
],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchPage implements OnInit, OnDestroy {
  api = inject(RedgifsApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private ss = inject(SettingsService);
  private watchQueue = inject(WatchQueueService);

  readonly query = signal('');
  suggestions: TagSuggestion[] = [];
  // results: Gif[] = [];
  // relatedUsers: User[] = [];
  // relatedTags: string[] = [];
  readonly searchType = signal<'gifs' | 'images'>('gifs');
  hasSearched = false;
  private readonly searchQuery = signal('');
  private readonly searchTypeSig = signal<'gifs' | 'images'>('gifs');
  private suggestSubject = new Subject<string>();
  private suggestSub?: Subscription;
  private entered = false;

  readonly searchResultQuery = injectQuery(() => ({
    queryKey: ['search', this.searchTypeSig(), this.searchQuery()] as const,
    queryFn: (param) => {
      const [_, t, q] = param.queryKey
      const obs = t === 'gifs'
        ? this.api.searchGifs(q)
        : this.api.searchImages(q);
      return firstValueFrom(obs);
    },
    enabled: this.searchQuery() !== '',
    staleTime: 1000 * 60 * 2,
  }));

  
  readonly results = computed(() => this.searchResultQuery.data()?.gifs ?? []);
  readonly relatedUsers = computed(() => this.searchResultQuery.data()?.users ?? []);
  readonly relatedTags = computed(() => this.searchResultQuery.data()?.tags ?? []);
  readonly searchError = computed(() => this.searchResultQuery.isError());
  readonly loading = this.searchResultQuery.isFetching;

  constructor() {
    this.suggestSub = this.suggestSubject.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(q => q ? this.api.getTagSuggestions(q) : of([]))
    ).subscribe(s => this.suggestions = s);

    // effect(() => {
    //   const r = this.searchResultQuery.data();
    //   if (r) {
    //     this.results = r.gifs;
    //     this.relatedUsers = r.users || [];
    //     this.relatedTags = r.tags || [];
    //     this.loading = false;
    //   }
    // });
  }

  ngOnDestroy(): void {
    this.suggestSub?.unsubscribe();
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const q = params.get('query');
      if (q) {
        this.query.set(q);
        this.search();
      }
    });
  }

  onSearchInput(event: any): void {
    const q = (event.detail?.value ?? '').trim();
    this.query.set(q);
    if (q) {
      this.suggestSubject.next(q);
    } else {
      this.suggestions = [];
    }
  }

  search(value?: string): void {
    const q = (value ?? this.query()).trim();
    if (!q) return;
    this.hasSearched = true;
    // if (this.searchQuery() !== q) {
      // this.results = [];
      // this.relatedUsers = [];
      // this.relatedTags = [];
      // this.loading = true;
    // }
    this.suggestions = [];
    this.suggestSubject.next('');
    this.searchTypeSig.set(this.searchType());
    this.searchQuery.set(q);
    this.router.navigate(['/search', q], { replaceUrl: true });
  }

  onSearchTypeChange(event: Event): void {
    const value = (event as CustomEvent).detail.value;
    if (value === 'gifs' || value === 'images') {
      this.searchType.set(value);
      if (this.hasSearched) this.search();
    }
  }

  onClear(searchbar: any): void {
    // this.results = [];
    this.hasSearched = false;
    this.query.set('');
    this.searchQuery.set('');
    this.suggestions = [];
    searchbar.value = '';
  }

  selectSuggestion(tag: string): void {
    this.query.set(tag);
    this.search();
  }

  goToTag(tag: string): void {
    this.router.navigate(['/search', tag]);
  }

  onCardClick(gifId: string, index: number): void {
    if (this.ss.get().storiesNavigation) {
      this.watchQueue.setQueue(this.results(), index, searchFeedGenerator(this.api, this.query(), this.searchType()));
      this.router.navigate(['/stories', gifId]);
    } else {
      this.router.navigate(['/watch', gifId]);
    }
  }

  onCreatorClick(username: string): void {
    this.router.navigate(['/creator', username]);
  }
}
