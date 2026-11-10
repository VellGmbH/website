import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

// bei 401 im Admin Bereich ausloggen und zum Login schicken
// (Cookie schickt der Browser selbst mit, den CSRF Header macht Angular)
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isAdminCall = req.url.startsWith('/api/admin') || req.url === '/api/auth/password';

  return next(req).pipe(
    catchError((err: unknown) => {
      if (isAdminCall && err instanceof HttpErrorResponse && err.status === 401) {
        auth.clear();
        router.navigate(['/admin/login'], { queryParams: { expired: 1 } });
      }
      return throwError(() => err);
    }),
  );
};
