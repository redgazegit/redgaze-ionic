import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RedgifsApiService } from '../../services/redgifs-api.service';
import { FavoritesService } from '../../services/favorites.service';
import { WatchQueueService } from '../../services/watch-queue.service';
import { Gif } from '../../models/gif.model';
import { IonicModule } from '@ionic/angular';
import { DatePipe } from '@angular/common';
import { VideoPlayerComponent } from '../../components/video-player/video-player.component';

@Component({
    selector: 'app-stories',
    templateUrl: './stories.page.html',
    styleUrls: ['./stories.page.scss'],
    imports: [IonicModule, DatePipe, RouterLink, VideoPlayerComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoriesPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  api = inject(RedgifsApiService);
  private favService = inject(FavoritesService);
  private watchQueue = inject(WatchQueueService);

  readonly current = this.watchQueue.current;
  readonly position = this.watchQueue.position;
  readonly total = this.watchQueue.total;
  readonly loading = this.watchQueue.loading;

  private touchStartY = 0;
  private touchStartX = 0;

  ngOnInit(): void {
    if (!this.total()) {
      const restored = this.watchQueue.restoreFromSession();
      if (!restored) {
        this.router.navigate(['/home']);
        return;
      }
    }
  }

  ngOnDestroy(): void {
    this.watchQueue.persistToSession();
  }

  get isFav(): boolean {
    return this.current() ? this.favService.isFavorite(this.current()!.id) : false;
  }

  toggleFav(): void {
    const gif = this.current();
    if (gif) this.favService.toggle(gif);
  }

  goToCreator(): void {
    const gif = this.current();
    if (gif?.userName) {
      this.router.navigate(['/creator', gif.userName]);
    }
  }

  download(): void {
    const gif = this.current();
    if (!gif) return;
    const prefHd = true;
    const url = prefHd ? (gif.urls.hd || gif.urls.sd || '') : (gif.urls.sd || gif.urls.hd || '');
    const a = document.createElement('a');
    a.href = this.api.proxyUrl(url);
    a.download = `${gif.id}.mp4`;
    a.click();
  }

  async goNext(): Promise<void> {
    if (!this.watchQueue.hasNext()) return;
    const moved = await this.watchQueue.next();
    if (moved) {
      this.router.navigateByUrl('/stories/' + this.current()!.id, { replaceUrl: true });
    }
  }

  goPrev(): void {
    if (!this.watchQueue.hasPrev()) return;
    this.watchQueue.prev();
    this.router.navigateByUrl('/stories/' + this.current()!.id, { replaceUrl: true });
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartY = event.touches[0].clientY;
    this.touchStartX = event.touches[0].clientX;
  }

  onTouchEnd(event: TouchEvent): void {
    const deltaY = event.changedTouches[0].clientY - this.touchStartY;
    const deltaX = event.changedTouches[0].clientX - this.touchStartX;
    if (Math.abs(deltaY) < Math.abs(deltaX)) return;
    if (deltaY < -50) {
      this.goNext();
    } else if (deltaY > 50) {
      this.goPrev();
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.goNext();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.goPrev();
    }
  }
}
