import { Router } from '@angular/router';
import { Gif } from '../models/gif.model';
import { SettingsService } from './settings.service';
import { WatchQueueService } from './watch-queue.service';

export interface GifNavigationContext {
  router: Router;
  settings: SettingsService;
  queue: WatchQueueService;
}

export function navigateToGif(
  ctx: GifNavigationContext,
  gifId: string,
  index: number,
  gifs: Gif[],
  generator?: () => AsyncGenerator<Gif[], void, void>,
): void {
  if (ctx.settings.get().storiesNavigation) {
    ctx.queue.setQueue(gifs, index, generator);
    ctx.router.navigate(['/stories', gifId]);
  } else {
    ctx.router.navigate(['/watch', gifId]);
  }
}
