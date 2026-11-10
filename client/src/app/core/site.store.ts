import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { SiteSettings } from './models';

// falls die API nicht erreichbar ist
const FALLBACK: SiteSettings = {
  name: 'Daniel Shapiro',
  tagline: '',
  githubUrl: null,
  avatarVersion: null,
};

// Name, Untertitel, GitHub und Profilbild
// wird beim Start geladen (app.config.ts)
@Injectable({ providedIn: 'root' })
export class SiteStore {
  private readonly api = inject(ApiService);

  readonly settings = signal<SiteSettings>(FALLBACK);

  // hochgeladenes Bild oder Standardbild
  readonly avatarUrl = computed(() => {
    const version = this.settings().avatarVersion;
    return version ? `/api/avatar?v=${encodeURIComponent(version)}` : 'avatar.jpg';
  });

  async load(): Promise<void> {
    try {
      this.settings.set(await firstValueFrom(this.api.getSite()));
    } catch {
      // egal, Seite trotzdem anzeigen
    }
  }
}
