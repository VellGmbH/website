import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { ApiError } from '../../core/models';
import { errorMessage } from '../../core/api.service';
import { FieldError } from '../../shared/field-error';

// prüft ob beide Passwörter gleich sind
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const pw = group.get('newPassword')?.value;
  const repeat = group.get('repeat')?.value;
  return pw && repeat && pw !== repeat ? { mismatch: true } : null;
}

// Passwort ändern, danach sind andere Geräte ausgeloggt
@Component({
  selector: 'app-account',
  imports: [ReactiveFormsModule, FieldError],
  template: `
    <h2>Passwort ändern</h2>
    <p class="muted">Mindestens 12 Zeichen. Nach dem Ändern werden alle anderen Geräte abgemeldet.</p>

    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <p>
        <label for="current">Aktuelles Passwort</label>
        <input id="current" type="password" formControlName="currentPassword" autocomplete="current-password" />
        <app-field-error [control]="form.controls.currentPassword" />
      </p>
      <p>
        <label for="new">Neues Passwort</label>
        <input id="new" type="password" formControlName="newPassword" autocomplete="new-password" />
        <app-field-error [control]="form.controls.newPassword" />
      </p>
      <p>
        <label for="repeat">Neues Passwort wiederholen</label>
        <input id="repeat" type="password" formControlName="repeat" autocomplete="new-password" />
        @if (form.errors?.['mismatch'] && form.controls.repeat.touched) {
          <span class="field-error">Die Passwörter stimmen nicht überein.</span>
        }
      </p>

      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      @if (done()) {
        <p class="success" role="status">Passwort wurde geändert.</p>
      }

      <button type="submit" [disabled]="saving()">Passwort ändern</button>
    </form>
  `,
  styles: `
    h2 {
      margin-top: 0;
    }
    input {
      max-width: 20rem !important;
    }
  `,
})
export class Account {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly form = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(200)]],
      repeat: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  protected readonly saving = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    this.done.set(false);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    const { currentPassword, newPassword } = this.form.getRawValue();

    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.saving.set(false);
        this.done.set(true);
        this.form.reset();
      },
      error: (err) => {
        this.saving.set(false);
        // Fehler vom Server beim Feld anzeigen
        const details = err instanceof HttpErrorResponse ? (err.error as ApiError)?.details : undefined;
        if (details?.['currentPassword']) {
          this.form.controls.currentPassword.setErrors({ server: details['currentPassword'] });
        } else if (details?.['newPassword']) {
          this.form.controls.newPassword.setErrors({ server: details['newPassword'] });
        } else {
          this.error.set(errorMessage(err));
        }
      },
    });
  }
}
