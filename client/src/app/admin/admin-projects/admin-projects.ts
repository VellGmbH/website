import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService, errorMessage } from '../../core/api.service';
import { Project, ProjectInput } from '../../core/models';
import { ProjectsStore } from '../../core/projects.store';
import { FieldError } from '../../shared/field-error';

const URL_PATTERN = /^https?:\/\/\S+$/;

// Projekte anlegen, bearbeiten, löschen
@Component({
  selector: 'app-admin-projects',
  imports: [ReactiveFormsModule, FieldError],
  template: `
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }

    @if (editing() !== undefined) {
      <h2>{{ editing() ? 'Projekt bearbeiten' : 'Neues Projekt' }}</h2>

      <form [formGroup]="form" (ngSubmit)="save()" novalidate>
        <p>
          <label for="title">Titel</label>
          <input id="title" type="text" formControlName="title" />
          <app-field-error [control]="form.controls.title" />
        </p>
        <p>
          <label for="description">Beschreibung</label>
          <textarea id="description" formControlName="description" rows="6"></textarea>
          <app-field-error [control]="form.controls.description" />
        </p>
        <p>
          <label for="technologies">Technologien (mit Komma getrennt)</label>
          <input id="technologies" type="text" formControlName="technologies" placeholder="Angular, Node.js, SQLite" />
          <app-field-error [control]="form.controls.technologies" />
        </p>
        <p>
          <label for="githubUrl">Link zum Code</label>
          <input id="githubUrl" type="url" formControlName="githubUrl" placeholder="https://github.com/..." />
          <app-field-error [control]="form.controls.githubUrl" />
        </p>
        <p>
          <label for="demoUrl">Link zur Demo</label>
          <input id="demoUrl" type="url" formControlName="demoUrl" placeholder="https://..." />
          <app-field-error [control]="form.controls.demoUrl" />
        </p>
        <p>
          <label for="imageUrl">Bild-URL (optional)</label>
          <input id="imageUrl" type="url" formControlName="imageUrl" placeholder="https://..." />
          <app-field-error [control]="form.controls.imageUrl" />
        </p>
        <p>
          <label for="sortOrder">Reihenfolge (kleiner = weiter oben)</label>
          <input id="sortOrder" type="number" formControlName="sortOrder" step="1" class="short" />
        </p>

        <button type="submit" [disabled]="saving()">{{ saving() ? 'Speichern …' : 'Speichern' }}</button>
        <button type="button" class="link cancel" (click)="cancel()">Abbrechen</button>
      </form>
    } @else {
      <p><button type="button" (click)="startCreate()">Neues Projekt</button></p>

      @if (loading()) {
        <p class="muted">Lade …</p>
      } @else {
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Titel</th>
              <th>Technologien</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (p of projects(); track p.id) {
              <tr>
                <td class="muted">{{ p.sortOrder }}</td>
                <td>{{ p.title }}</td>
                <td class="muted">{{ p.technologies.join(', ') }}</td>
                <td class="actions">
                  <button type="button" class="link" (click)="startEdit(p)">bearbeiten</button> ·
                  <button type="button" class="link danger" (click)="remove(p)">löschen</button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="4" class="muted">Noch keine Projekte.</td></tr>
            }
          </tbody>
        </table>
      }
    }
  `,
  styles: `
    h2 {
      margin-top: 0;
    }
    .short {
      max-width: 6rem !important;
    }
    .cancel {
      margin-left: 1rem;
    }
    .actions {
      white-space: nowrap;
      text-align: right;
    }
  `,
})
export class AdminProjects {
  private readonly api = inject(ApiService);
  private readonly store = inject(ProjectsStore);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly projects = signal<Project[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  // undefined = Liste, null = neues Projekt, sonst wird das Projekt bearbeitet
  protected readonly editing = signal<Project | null | undefined>(undefined);

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(5000)]],
    technologies: ['', Validators.required],
    githubUrl: ['', Validators.pattern(URL_PATTERN)],
    demoUrl: ['', Validators.pattern(URL_PATTERN)],
    imageUrl: ['', Validators.pattern(URL_PATTERN)],
    sortOrder: [0],
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.getProjects().subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  // auch die Seitenleiste neu laden
  private refresh(): void {
    this.load();
    this.store.reload();
  }

  protected startCreate(): void {
    this.form.reset();
    this.error.set(null);
    this.editing.set(null);
  }

  protected startEdit(p: Project): void {
    this.form.reset({
      title: p.title,
      description: p.description,
      technologies: p.technologies.join(', '),
      githubUrl: p.githubUrl ?? '',
      demoUrl: p.demoUrl ?? '',
      imageUrl: p.imageUrl ?? '',
      sortOrder: p.sortOrder,
    });
    this.error.set(null);
    this.editing.set(p);
  }

  protected cancel(): void {
    this.editing.set(undefined);
    this.error.set(null);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const data: ProjectInput = {
      ...v,
      technologies: v.technologies
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      sortOrder: Math.trunc(Number(v.sortOrder) || 0),
    };

    const current = this.editing();
    const request = current ? this.api.updateProject(current.id, data) : this.api.createProject(data);

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(undefined);
        this.refresh();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  protected remove(p: Project): void {
    if (!confirm(`Projekt "${p.title}" wirklich löschen?`)) return;
    this.api.deleteProject(p.id).subscribe({
      next: () => this.refresh(),
      error: (err) => this.error.set(errorMessage(err)),
    });
  }
}
