import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProjectsStore } from '../../core/projects.store';
import { PageText } from '../../shared/page-text';

// alle Projekte untereinander
@Component({
  selector: 'app-projects',
  imports: [RouterLink, DatePipe, PageText],
  template: `
    <!-- Text kommt aus Admin -> Seiten -->
    <app-page-text slug="projekte" />

    @if (store.error()) {
      <p class="error">Projekte konnten nicht geladen werden: {{ store.error() }}</p>
    } @else if (store.loading() && store.projects().length === 0) {
      <p class="muted">Lade …</p>
    }

    @for (p of store.projects(); track p.id; let last = $last) {
      <article>
        <h2><a [routerLink]="['/projekte', p.id]">{{ p.title }}</a></h2>
        <p class="date">{{ p.createdAt | date: 'MMMM yyyy' }}</p>
        <p>{{ p.description }}</p>
        <p class="muted">Technologien: {{ p.technologies.join(', ') }}</p>
        @if (p.githubUrl || p.demoUrl) {
          <p>
            @if (p.githubUrl; as url) {
              <a [href]="url" target="_blank" rel="noopener noreferrer">Code</a>
            }
            @if (p.githubUrl && p.demoUrl) {
              ·
            }
            @if (p.demoUrl; as url) {
              <a [href]="url" target="_blank" rel="noopener noreferrer">Demo</a>
            }
          </p>
        }
      </article>
      @if (!last) {
        <hr />
      }
    } @empty {
      @if (!store.loading() && !store.error()) {
        <p class="muted">Noch keine Projekte.</p>
      }
    }
  `,
  styles: `
    article h2 {
      margin-top: 0;
      margin-bottom: 0.1rem;
    }
    article p {
      margin-bottom: 0.6rem;
    }
  `,
})
export class Projects {
  protected readonly store = inject(ProjectsStore);
}
