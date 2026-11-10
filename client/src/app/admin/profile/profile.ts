import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService, errorMessage } from '../../core/api.service';
import { SiteSettings } from '../../core/models';
import { SiteStore } from '../../core/site.store';
import { FieldError } from '../../shared/field-error';

const URL_PATTERN = /^https?:\/\/\S+$/;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

// Name, Untertitel, GitHub und Profilbild ändern
@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, FieldError],
  template: `
    <h2>Angaben in der Seitenleiste</h2>

    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <p>
        <label for="name">Name</label>
        <input id="name" type="text" formControlName="name" />
        <span class="hint">Erscheint in der Seitenleiste, im Footer und im Browser-Tab.</span>
        <app-field-error [control]="form.controls.name" />
      </p>
      <p>
        <label for="tagline">Untertitel</label>
        <input id="tagline" type="text" formControlName="tagline" placeholder="z. B. Informatik-Student · htw saar" />
        <app-field-error [control]="form.controls.tagline" />
      </p>
      <p>
        <label for="githubUrl">GitHub-Profil</label>
        <input id="githubUrl" type="url" formControlName="githubUrl" placeholder="https://github.com/..." />
        <span class="hint">Leer lassen, um den GitHub-Link auszublenden.</span>
        <app-field-error [control]="form.controls.githubUrl" />
      </p>

      <h3>Suchmaschinen</h3>
      <p>
        <label for="description">Beschreibung der Website</label>
        <textarea id="description" formControlName="description" rows="3" maxlength="200"></textarea>
        <span class="hint">{{ form.controls.description.value.length }} / 200 Zeichen. Wird genommen, wenn eine Seite keine eigene Beschreibung hat.</span>
        <app-field-error [control]="form.controls.description" />
      </p>
      <p>
        <label for="keywords">Keywords (mit Komma getrennt)</label>
        <textarea id="keywords" formControlName="keywords" rows="3" maxlength="500"></textarea>
        <span class="hint">{{ form.controls.keywords.value.length }} / 500 Zeichen. Am besten 10 bis 15 Begriffe, unter denen man dich finden soll.</span>
        <app-field-error [control]="form.controls.keywords" />
      </p>

      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      @if (saved()) {
        <p class="success" role="status">Gespeichert.</p>
      }
      <button type="submit" [disabled]="saving()">{{ saving() ? 'Speichern …' : 'Speichern' }}</button>
    </form>

    <h2>Profilbild</h2>
    <div class="avatar">
      <img [src]="site.avatarUrl()" alt="Aktuelles Profilbild" width="120" height="120" />
      <div>
        <p>
          <label for="avatar">Neues Bild hochladen</label>
          <input id="avatar" type="file" accept="image/png,image/jpeg,image/webp" (change)="upload($event)" [disabled]="uploading()" />
          <span class="hint">PNG, JPEG oder WebP, höchstens 2 MB. Am besten quadratisch.</span>
        </p>
        @if (uploading()) {
          <p class="muted">Wird hochgeladen …</p>
        }
        @if (avatarError()) {
          <p class="error" role="alert">{{ avatarError() }}</p>
        }
        @if (site.settings().avatarVersion) {
          <p><button type="button" class="link" (click)="resetAvatar()">Standardbild wiederherstellen</button></p>
        }
      </div>
    </div>
  `,
  styles: `
    h2:first-child {
      margin-top: 0;
    }
    .hint {
      display: block;
      font-size: 0.85rem;
      color: var(--muted);
    }
    .avatar {
      display: flex;
      gap: 1.25rem;
      align-items: flex-start;
      flex-wrap: wrap;
    }
    .avatar img {
      width: 120px;
      height: 120px;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid var(--border);
    }
    .avatar p:first-child {
      margin-top: 0;
    }
  `,
})
export class Profile {
  private readonly api = inject(ApiService);
  protected readonly site = inject(SiteStore);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly form = this.fb.group({
    name: [this.site.settings().name, [Validators.required, Validators.maxLength(80)]],
    tagline: [this.site.settings().tagline, Validators.maxLength(150)],
    githubUrl: [this.site.settings().githubUrl ?? '', Validators.pattern(URL_PATTERN)],
    description: [this.site.settings().description, Validators.maxLength(200)],
    keywords: [this.site.settings().keywords, Validators.maxLength(500)],
  });

  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly uploading = signal(false);
  protected readonly avatarError = signal<string | null>(null);

  protected save(): void {
    this.saved.set(false);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);

    this.api.updateSettings(this.form.getRawValue()).subscribe({
      next: (settings) => {
        this.apply(settings);
        this.saving.set(false);
        this.saved.set(true);
        this.form.markAsPristine();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  protected upload(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = ''; // damit man die gleiche Datei nochmal wählen kann
    if (!file) return;

    // schon hier prüfen, der Server prüft aber nochmal
    if (!ALLOWED_TYPES.includes(file.type)) {
      this.avatarError.set('Bitte ein Bild im Format PNG, JPEG oder WebP wählen.');
      return;
    }
    if (file.size > MAX_BYTES) {
      this.avatarError.set('Das Bild ist größer als 2 MB.');
      return;
    }

    this.avatarError.set(null);
    this.uploading.set(true);
    this.api.uploadAvatar(file).subscribe({
      next: (settings) => {
        this.apply(settings);
        this.uploading.set(false);
      },
      error: (err) => {
        this.uploading.set(false);
        this.avatarError.set(errorMessage(err));
      },
    });
  }

  protected resetAvatar(): void {
    if (!confirm('Hochgeladenes Profilbild löschen und das Standardbild verwenden?')) return;
    this.api.resetAvatar().subscribe({
      next: (settings) => this.apply(settings),
      error: (err) => this.avatarError.set(errorMessage(err)),
    });
  }

  // Seitenleiste gleich aktualisieren
  private apply(settings: SiteSettings): void {
    this.site.settings.set(settings);
  }
}
