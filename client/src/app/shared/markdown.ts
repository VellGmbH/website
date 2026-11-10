import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { Marked } from 'marked';

const escapeAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Markdown Einstellungen: Enter = neue Zeile, Links nach außen in neuem Tab
const markdown = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const external = /^https?:\/\//i.test(href);
      return (
        `<a href="${escapeAttr(href)}"` +
        (title ? ` title="${escapeAttr(title)}"` : '') +
        (external ? ' target="_blank" rel="noopener noreferrer"' : '') +
        `>${text}</a>`
      );
    },
  },
});

// zeigt Markdown als HTML an
// innerHTML wird von Angular gesäubert (kein <script>, onclick oder javascript: Links)
// Links wie /kontakt gehen über den Router damit die Seite nicht neu lädt
@Component({
  selector: 'app-markdown',
  template: `<div class="markdown" [innerHTML]="html()" (click)="onClick($event)"></div>`,
})
export class MarkdownView {
  private readonly router = inject(Router);

  readonly content = input<string>('');

  protected readonly html = computed(() => markdown.parse(this.content() ?? '', { async: false }));

  protected onClick(event: MouseEvent): void {
    // Strg-Klick oder Mausrad-Klick normal lassen (neuer Tab)
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    const link = (event.target as HTMLElement).closest('a');
    const href = link?.getAttribute('href');
    if (!link || !href || link.target) return;

    // nur Links auf der eigenen Seite
    if (href.startsWith('/') && !href.startsWith('//')) {
      event.preventDefault();
      this.router.navigateByUrl(href);
    }
  }
}
