import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeAr from '@angular/common/locales/ar';
import { routes } from './app.routes';
import { TranslationService } from './core/i18n/translation.service';
import { AuthService } from './core/services/auth.service';

registerLocaleData(localeAr, 'ar');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    // language (dir + Bootstrap RTL) first, then restore the session before the guards run
    provideAppInitializer(() => { inject(TranslationService); }),
    provideAppInitializer(() => inject(AuthService).init()),
    provideRouter(routes, withComponentInputBinding()),
  ],
};