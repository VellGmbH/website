import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';

// Admin Bereich mit Menü oben
@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <h1>Admin</h1>
    <p class="subnav">
      <a routerLink="nachrichten" routerLinkActive="active">Nachrichten</a> |
      <a routerLink="seiten" routerLinkActive="active">Seiten</a> |
      <a routerLink="projekte" routerLinkActive="active">Projekte</a> |
      <a routerLink="profil" routerLinkActive="active">Profil</a> |
      <a routerLink="konto" routerLinkActive="active">Konto</a> |
      <button type="button" class="link" (click)="auth.logout()">Abmelden</button>
      <span class="muted"> (angemeldet als {{ auth.username() }})</span>
    </p>
    <hr />
    <router-outlet />
  `,
  styles: `
    .subnav .active {
      font-weight: 700;
      color: var(--text);
    }
    hr {
      margin: 1rem 0 1.5rem;
    }
  `,
})
export class AdminShell {
  protected readonly auth = inject(AuthService);
}
