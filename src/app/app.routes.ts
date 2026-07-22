import { Routes } from '@angular/router';
import { HomePage } from './pages/home/home.page';
import { SearchPage } from './pages/search/search.page';
import { FavoritesPage } from './pages/favorites/favorites.page';
import { CreatorDetailPage } from './pages/creator-detail/creator-detail.page';
import { NicheBrowsePage } from './pages/niche-browse/niche-browse.page';
import { WatchPage } from './pages/watch/watch.page';
import { StoriesPage } from './pages/stories/stories.page';
import { SettingsPage } from './pages/settings/settings.page';

export const routes: Routes = [
  { path: 'home', component: HomePage },
  { path: 'search', component: SearchPage },
  { path: 'search/:query', component: SearchPage },
  { path: 'favorites', component: FavoritesPage },
  { path: 'creator/:username', component: CreatorDetailPage },
  { path: 'niche/:nicheId', component: NicheBrowsePage },
  { path: 'watch/:id', component: WatchPage },
  { path: 'stories/:id', component: StoriesPage },
  { path: 'settings', component: SettingsPage },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: '**', redirectTo: 'home' },
];
