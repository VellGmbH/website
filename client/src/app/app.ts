import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { ProjectsStore } from './core/projects.store';
import { SiteStore } from './core/site.store';
import { ThemeService } from './core/theme.service';

// Seitenleiste links, Inhalt rechts
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly store = inject(ProjectsStore);
  protected readonly site = inject(SiteStore);
  protected readonly year = new Date().getFullYear();

  constructor() {
    this.store.ensureLoaded();
  }
}
