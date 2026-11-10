import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { SiteStore } from './site.store';

// Titel im Browser-Tab ("Seite – Name") und die Meta-Tags für Suchmaschinen
// - description: von der Seite, sonst die allgemeine aus Admin -> Profil
// - keywords: aus Admin -> Profil
// - Admin Bereich bekommt noindex,nofollow damit er nicht bei Google landet
@Injectable({ providedIn: 'root' })
export class SiteTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly site = inject(SiteStore);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.setPageTitle(this.buildTitle(snapshot));

    const isAdmin = snapshot.url.startsWith('/admin');
    this.meta.updateTag({ name: 'robots', content: isAdmin ? 'noindex,nofollow' : 'index,follow' });
  }

  // für Seiten die den Titel erst später kennen (z.B. Projekt)
  setPageTitle(pageTitle: string | undefined, description?: string): void {
    const settings = this.site.settings();
    this.title.setTitle(pageTitle ? `${pageTitle} – ${settings.name}` : settings.name);
    this.meta.updateTag({ name: 'description', content: description || settings.description });
    this.meta.updateTag({ name: 'keywords', content: settings.keywords });
  }
}
