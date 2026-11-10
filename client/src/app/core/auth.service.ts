import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, firstValueFrom, map, of, tap } from 'rxjs';
import { LoginResponse } from './models';

// Login Zustand im Client
// das Token ist im httpOnly Cookie, hier wird nur gemerkt wer eingeloggt ist
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly user = signal<string | null>(null);

  readonly username = this.user.asReadonly();
  readonly isLoggedIn = computed(() => this.user() !== null);

  // beim Start den Server fragen ob man noch eingeloggt ist
  restoreSession(): Promise<void> {
    return firstValueFrom(
      this.http.get<{ username: string }>('/api/auth/me').pipe(
        map((res) => this.user.set(res.username)),
        catchError(() => of(this.user.set(null))),
      ),
    );
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>('/api/auth/login', { username, password })
      .pipe(tap((res) => this.user.set(res.username)));
  }

  changePassword(currentPassword: string, newPassword: string): Observable<LoginResponse> {
    return this.http.put<LoginResponse>('/api/auth/password', { currentPassword, newPassword });
  }

  logout(): void {
    this.http.post('/api/auth/logout', null).subscribe({
      complete: () => this.afterLogout(),
      error: () => this.afterLogout(),
    });
  }

  // ausloggen ohne Server (z.B. bei 401)
  clear(): void {
    this.user.set(null);
  }

  private afterLogout(): void {
    this.clear();
    this.router.navigate(['/admin/login']);
  }
}
