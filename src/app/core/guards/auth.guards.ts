import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login'], { queryParams: { next: state.url } });
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? inject(Router).parseUrl(auth.homeUrl()) : true;
};

export const managerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isManager() ? true : inject(Router).parseUrl('/my-tasks');
};

/** '' → the right home page for this person. */
export const homeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return inject(Router).parseUrl(auth.isLoggedIn() ? auth.homeUrl() : '/login');
};