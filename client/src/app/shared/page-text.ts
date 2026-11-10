import { Component, effect, inject, input } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { Page } from '../core/models';
import { SiteTitleStrategy } from '../core/site-title.strategy';
import { MarkdownView } from './markdown';

// Überschrift und Text von einer Seite aus der Datenbank
// wenn man eingeloggt ist gibts einen Bearbeiten Link
@Component({
  selector: 'app-page-text',
  imports: [MarkdownView, RouterLink],
  template: `
    @if (page.hasValue()) {
      <h1>{{ page.value().title }}</h1>
      <app-markdown [content]="page.value().content" />
    } @else if (page.error()) {
      <p class="error">Der Inhalt konnte nicht geladen werden.</p>
    } @else {
      <p class="muted">Lade …</p>
    }

    @if (auth.isLoggedIn()) {
      <p class="edit-link">
        <a routerLink="/admin/seiten" [queryParams]="{ seite: slug() }">✎ Text bearbeiten</a>
      </p>
    }
  `,
  styles: `
    .edit-link {
      font-size: 0.85rem;
    }
  `,
})
export class PageText {
  protected readonly auth = inject(AuthService);
  private readonly titles = inject(SiteTitleStrategy);

  readonly slug = input.required<string>();
  // Titel im Tab setzen (auf der Startseite nicht)
  readonly setTitle = input(true);

  protected readonly page = httpResource<Page>(() => `/api/pages/${encodeURIComponent(this.slug())}`);

  constructor() {
    effect(() => {
      if (this.page.hasValue()) {
        const page = this.page.value();
        // auf der Startseite steht im Tab nur der Name, die Beschreibung wird trotzdem gesetzt
        this.titles.setPageTitle(this.setTitle() ? page.title : undefined, page.description);
      }
    });
  }
}

// Textseite, welche steht in app.routes.ts
@Component({
  selector: 'app-content-page',
  imports: [PageText],
  template: `<app-page-text [slug]="slug()" [setTitle]="slug() !== 'about'" />`,
})
export class ContentPage {
  readonly slug = input.required<string>();
}
