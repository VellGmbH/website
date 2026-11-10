import {
  ApplicationConfig,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { TitleStrategy, provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { AuthService } from './core/auth.service';
import { SiteStore } from './core/site.store';
import { SiteTitleStrategy } from './core/site-title.strategy';

registerLocaleData(localeDe);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(), // z.B. :id direkt als input()
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor]),
      // CSRF: das Cookie XSRF-TOKEN als Header mitschicken
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
    ),
    // beim Start schauen ob man noch eingeloggt ist
    provideAppInitializer(() => inject(AuthService).restoreSession()),
    // Name usw. vorher laden damit die Seitenleiste nicht leer ist
    provideAppInitializer(() => inject(SiteStore).load()),
    { provide: TitleStrategy, useExisting: SiteTitleStrategy },
    { provide: LOCALE_ID, useValue: 'de-DE' },
  ],
};
