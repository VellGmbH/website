import { Injectable, inject, signal } from '@angular/core';
import { ApiService, errorMessage } from './api.service';
import { Project } from './models';

// Projektliste, damit Seitenleiste und Projektseite nicht beide extra laden
@Injectable({ providedIn: 'root' })
export class ProjectsStore {
  private readonly api = inject(ApiService);

  readonly projects = signal<Project[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  private loaded = false;

  // nur laden wenn noch nicht geladen
  ensureLoaded(): void {
    if (!this.loaded) this.reload();
  }

  reload(): void {
    this.loaded = true;
    this.loading.set(true);
    this.api.getProjects().subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
        this.loaded = false;
      },
    });
  }
}
