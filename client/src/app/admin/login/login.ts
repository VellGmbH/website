import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/api.service';

// Login Seite
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  template: `
    <h1>Login</h1>

    @if (expired()) {
      <p class="error">Deine Sitzung ist abgelaufen. Bitte neu anmelden.</p>
    }

    <form [formGroup]="form" (ngSubmit)="submit()">
      <p>
        <label for="username">Benutzername</label>
        <input id="username" type="text" formControlName="username" autocomplete="username" />
      </p>
      <p>
        <label for="password">Passwort</label>
        <input id="password" type="password" formControlName="password" autocomplete="current-password" />
      </p>

      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }

      <button type="submit" [disabled]="form.invalid || loading()">
        {{ loading() ? 'Anmelden …' : 'Anmelden' }}
      </button>
    </form>
  `,
  styles: `
    input {
      max-width: 20rem !important;
    }
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;

  // kommen aus der URL
  readonly returnUrl = input<string>();
  readonly expired = input<string>();

  protected readonly form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    if (this.auth.isLoggedIn()) {
      this.router.navigateByUrl('/admin');
    }
  }

  protected submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    const { username, password } = this.form.getRawValue();
    this.auth.login(username, password).subscribe({
      next: () => {
        const target = this.returnUrl();
        // nur auf Admin Seiten weiterleiten, nicht auf fremde Seiten
        this.router.navigateByUrl(target?.startsWith('/admin/') ? target : '/admin');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(errorMessage(err));
        this.form.controls.password.reset();
      },
    });
  }
}
