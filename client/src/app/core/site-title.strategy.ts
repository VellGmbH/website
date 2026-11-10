import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { SiteStore } from './site.store';

// Titel im Browser-Tab: "Seite – Name"
@Injectable({ providedIn: 'root' })
export class SiteTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly site = inject(SiteStore);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.setPageTitle(this.buildTitle(snapshot));
  }

  // für Seiten die den Titel erst später kennen (z.B. Projekt)
  setPageTitle(pageTitle: string | undefined): void {
    const name = this.site.settings().name;
    this.title.setTitle(pageTitle ? `${pageTitle} – ${name}` : name);
  }
}
