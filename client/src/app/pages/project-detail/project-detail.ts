import { Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { SiteTitleStrategy } from '../../core/site-title.strategy';
import { RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { Project } from '../../core/models';

// ein Projekt im Detail
@Component({
  selector: 'app-project-detail',
  imports: [RouterLink, DatePipe],
  template: `
    @if (error()) {
      <p class="error">{{ error() }}</p>
      <p><a routerLink="/projekte">Zurück zu den Projekten</a></p>
    } @else if (project(); as p) {
      <article>
        <h1>{{ p.title }}</h1>
        <p class="date">
          {{ p.createdAt | date: 'd. MMMM yyyy' }}
          @if (p.updatedAt !== p.createdAt) {
            · aktualisiert {{ p.updatedAt | date: 'd. MMMM yyyy' }}
          }
        </p>

        @if (p.imageUrl) {
          <img [src]="p.imageUrl" [alt]="'Screenshot von ' + p.title" class="image" />
        }

        <p class="description">{{ p.description }}</p>

        <h2>Technologien</h2>
        <ul>
          @for (tech of p.technologies; track tech) {
            <li>{{ tech }}</li>
          }
        </ul>

        @if (p.githubUrl || p.demoUrl) {
          <h2>Links</h2>
          <ul>
            @if (p.githubUrl; as url) {
              <li>Quellcode: <a [href]="url" target="_blank" rel="noopener noreferrer">{{ url }}</a></li>
            }
            @if (p.demoUrl; as url) {
              <li>Demo: <a [href]="url" target="_blank" rel="noopener noreferrer">{{ url }}</a></li>
            }
          </ul>
        }
      </article>
      <hr />
      <p><a routerLink="/projekte">← Alle Projekte</a></p>
    } @else {
      <p class="muted">Lade …</p>
    }
  `,
  styles: `
    h1 {
      margin-bottom: 0.2rem;
    }
    .description {
      white-space: pre-line;
      margin-top: 1rem;
    }
    .image {
      max-width: 100%;
      border: 1px solid var(--border);
      margin: 1rem 0;
    }
    li a {
      word-break: break-all;
    }
  `,
})
export class ProjectDetail {
  private readonly api = inject(ApiService);
  private readonly titles = inject(SiteTitleStrategy);

  // :id aus der URL
  readonly id = input.required<string>();

  protected readonly project = signal<Project | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect((onCleanup) => {
      const id = Number(this.id());
      this.project.set(null);
      this.error.set(null);
      const sub = this.api.getProject(id).subscribe({
        next: (p) => {
          this.project.set(p);
          this.titles.setPageTitle(p.title);
        },
        error: (err) => this.error.set(errorMessage(err)),
      });
      // alte Anfrage abbrechen wenn man das Projekt wechselt
      onCleanup(() => sub.unsubscribe());
    });
  }
}
