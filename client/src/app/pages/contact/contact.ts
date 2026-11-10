import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { FieldError } from '../../shared/field-error';
import { PageText } from '../../shared/page-text';

// Kontaktformular, gleiche Regeln wie im Server (contact.js)
@Component({
  selector: 'app-contact',
  imports: [ReactiveFormsModule, RouterLink, FieldError, PageText],
  template: `
    <!-- Text kommt aus Admin -> Seiten -->
    <app-page-text slug="kontakt" />

    @if (sent()) {
      <p class="success" role="status">Danke, deine Nachricht ist angekommen. Ich melde mich.</p>
      <p><button type="button" class="link" (click)="sent.set(false)">Noch eine Nachricht schreiben</button></p>
    } @else {

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <p>
          <label for="name">Name</label>
          <input id="name" type="text" formControlName="name" autocomplete="name" />
          <app-field-error [control]="form.controls.name" />
        </p>

        <p>
          <label for="email">E-Mail</label>
          <input id="email" type="email" formControlName="email" autocomplete="email" />
          <app-field-error [control]="form.controls.email" />
        </p>

        <p>
          <label for="subject">Betreff</label>
          <input id="subject" type="text" formControlName="subject" />
          <app-field-error [control]="form.controls.subject" />
        </p>

        <p>
          <label for="message">Nachricht</label>
          <textarea id="message" formControlName="message" rows="8"></textarea>
          <app-field-error [control]="form.controls.message" />
        </p>

        <!-- Honeypot gegen Bots, unsichtbar -->
        <div class="sr-only" aria-hidden="true">
          <label for="website">Website (bitte leer lassen)</label>
          <input id="website" type="text" formControlName="website" tabindex="-1" autocomplete="off" />
        </div>

        <p>
          <label class="checkbox">
            <input type="checkbox" formControlName="consent" />
            <span>
              Ich bin einverstanden, dass meine Angaben zur Beantwortung meiner Anfrage gespeichert werden.
              Mehr dazu in der <a routerLink="/datenschutz">Datenschutzerklärung</a>.
            </span>
          </label>
          <app-field-error [control]="form.controls.consent" />
        </p>

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }

        <button type="submit" [disabled]="sending()">{{ sending() ? 'Wird gesendet …' : 'Absenden' }}</button>
      </form>
    }
  `,
})
export class Contact {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    subject: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(5000)]],
    consent: [false, Validators.requiredTrue],
    website: [''],
  });

  protected readonly sending = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.sending.set(true);
    this.error.set(null);

    this.api.sendContact(this.form.getRawValue()).subscribe({
      next: () => {
        this.sending.set(false);
        this.sent.set(true);
        this.form.reset();
      },
      error: (err) => {
        this.sending.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
