import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { AdminPage } from '../../core/models';
import { FieldError } from '../../shared/field-error';
import { MarkdownView } from '../../shared/markdown';

// wo die Seiten auf der Website sind
const PUBLIC_PATHS: Record<string, string> = {
  about: '/',
  projekte: '/projekte',
  kontakt: '/kontakt',
  impressum: '/impressum',
  datenschutz: '/datenschutz',
};

// Texte bearbeiten (Über mich, Impressum, Datenschutz usw.)
// welche Seite gerade offen ist steht in der URL (?seite=impressum)
//
// Formatierung (Markdown):
//   **fett**
//   *kursiv*
//   ## Überschrift
//   [Text](/kontakt)            Link auf der Seite
//   [Text](https://github.com)  Link nach außen (neuer Tab)
//   - Punkt                     Liste
//   leere Zeile = neuer Absatz, Enter = neue Zeile
@Component({
  selector: 'app-admin-pages',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, FieldError, MarkdownView],
  template: `
    @if (loadError()) {
      <p class="error">{{ loadError() }}</p>
    }

    <p class="page-list">
      @for (p of pages(); track p.slug; let last = $last) {
        <button type="button" class="link" [class.active]="p.slug === selected()?.slug" (click)="select(p.slug)">
          {{ p.label }}
        </button>
        @if (!last) {
          ·
        }
      }
    </p>

    @if (selected(); as page) {
      <form [formGroup]="form" (ngSubmit)="save()" novalidate>
        <p>
          <label for="title">Überschrift</label>
          <input id="title" type="text" formControlName="title" />
          <app-field-error [control]="form.controls.title" />
        </p>

        <p class="tabs">
          <button type="button" class="link" [class.active]="!preview()" (click)="preview.set(false)">Bearbeiten</button>
          |
          <button type="button" class="link" [class.active]="preview()" (click)="preview.set(true)">Vorschau</button>
        </p>

        @if (preview()) {
          <div class="preview">
            <h1>{{ form.controls.title.value }}</h1>
            <app-markdown [content]="content()" />
          </div>
        } @else {
          <p>
            <label for="content" class="sr-only">Inhalt</label>
            <textarea id="content" formControlName="content" rows="18" spellcheck="true"></textarea>
            <app-field-error [control]="form.controls.content" />
          </p>
        }

        <p>
          <label for="description">Beschreibung für Suchmaschinen</label>
          <input id="description" type="text" formControlName="description" maxlength="200" />
          <span class="muted small">{{ form.controls.description.value.length }} / 200 Zeichen – erscheint bei Google unter dem Titel</span>
          <app-field-error [control]="form.controls.description" />
        </p>

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        @if (saved()) {
          <p class="success" role="status">Gespeichert.</p>
        }

        <p>
          <button type="submit" [disabled]="saving()">{{ saving() ? 'Speichern …' : 'Speichern' }}</button>
          @if (form.dirty) {
            <button type="button" class="link spaced" (click)="discard()">Änderungen verwerfen</button>
          }
          <a class="spaced" [routerLink]="publicPath(page.slug)">Seite ansehen →</a>
        </p>
        <p class="muted small">Zuletzt geändert: {{ page.updatedAt | date: 'd. MMMM yyyy, HH:mm' }} Uhr</p>
      </form>
    } @else if (!loadError()) {
      <p class="muted">Lade …</p>
    }
  `,
  styles: `
    .page-list .active,
    .tabs .active {
      font-weight: 700;
      color: var(--text);
    }
    textarea {
      font-family: ui-monospace, Consolas, monospace;
      font-size: 0.9rem;
    }
    .preview {
      border: 1px dashed var(--border);
      padding: 0 1rem 0.5rem;
      margin-bottom: 1rem;
    }
    .spaced {
      margin-left: 1rem;
    }
    .small {
      font-size: 0.85rem;
    }
  `,
})
export class AdminPages {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;

  // ?seite=... aus der URL
  readonly seite = input<string>();

  protected readonly pages = signal<AdminPage[]>([]);
  protected readonly selected = computed(() => {
    const pages = this.pages();
    return pages.find((p) => p.slug === this.seite()) ?? pages[0];
  });
  private readonly selectedSlug = computed(() => this.selected()?.slug);

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(80)]],
    content: ['', Validators.maxLength(50_000)],
    description: ['', Validators.maxLength(200)],
  });
  protected readonly content = toSignal(this.form.controls.content.valueChanges, { initialValue: '' });

  protected readonly preview = signal(false);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);

  constructor() {
    this.api.getAdminPages().subscribe({
      next: (pages) => this.pages.set(pages),
      error: (err) => this.loadError.set(errorMessage(err)),
    });

    // Formular nur neu füllen wenn man die Seite wechselt, nicht nach dem Speichern
    effect(() => {
      this.selectedSlug();
      untracked(() => {
        const page = this.selected();
        if (page) this.fillForm(page);
      });
    });
  }

  protected publicPath(slug: string): string {
    return PUBLIC_PATHS[slug] ?? '/';
  }

  // fragt nach wenn man ungespeichert weg will
  canLeave(): boolean {
    return !this.form.dirty || confirm('Es gibt ungespeicherte Änderungen. Trotzdem verlassen?');
  }

  protected select(slug: string): void {
    if (slug === this.selected()?.slug || !this.canLeave()) return;
    this.form.markAsPristine(); // sonst wird zweimal gefragt
    this.router.navigate([], { queryParams: { seite: slug } });
  }

  protected discard(): void {
    const page = this.selected();
    if (page) this.fillForm(page);
  }

  private fillForm(page: AdminPage): void {
    this.form.reset({ title: page.title, content: page.content, description: page.description });
    this.preview.set(false);
    this.saved.set(false);
    this.error.set(null);
  }

  protected save(): void {
    const page = this.selected();
    if (!page) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.saved.set(false);
    this.error.set(null);

    this.api.updatePage(page.slug, this.form.getRawValue()).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.pages.update((list) => list.map((p) => (p.slug === updated.slug ? { ...p, ...updated } : p)));
        // Formular mit dem gespeicherten Stand füllen
        this.form.reset({ title: updated.title, content: updated.content, description: updated.description });
        this.saved.set(true);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
