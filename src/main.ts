
import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { Capacitor } from '@capacitor/core';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { provideApiConfig } from './app/services/api-config';
import { nativeHttpInterceptor } from './app/services/native-http.interceptor';
import './app/icons';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 15,
      gcTime: 1000 * 60 * 60 * 24,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      refetchOnWindowFocus: false,
    },
  },
});

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideIonicAngular({}),
    provideRouter(routes),
    provideHttpClient(withInterceptors([nativeHttpInterceptor])),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideTanStackQuery(queryClient),
    provideApiConfig(Capacitor.isNativePlatform()),
  ],
}).catch(err => console.error(err));
