import { Injectable, signal } from '@angular/core';

type Theme = 'light' | 'dark';

// hell/dunkel umschalten und merken (Startwert kommt aus public/theme-init.js)
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
  );

  toggle(): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      // speichern geht nicht, dann halt nur bis zum Neuladen
    }
  }
}
