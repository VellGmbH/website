import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MarkdownView } from './markdown';

describe('MarkdownView', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MarkdownView], providers: [provideRouter([])] });
  });

  function render(content: string): HTMLElement {
    const fixture = TestBed.createComponent(MarkdownView);
    fixture.componentRef.setInput('content', content);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('wandelt Markdown in HTML um, einfacher Zeilenumbruch wird <br>', () => {
    const el = render('## Kontakt\n\n**Max**\nMusterstraße 1');
    expect(el.querySelector('h2')?.textContent).toBe('Kontakt');
    expect(el.querySelector('strong')?.textContent).toBe('Max');
    expect(el.querySelector('br')).toBeTruthy();
  });

  it('öffnet externe Links in neuem Tab, interne über den Router', () => {
    const el = render('[GitHub](https://github.com) [Kontakt](/kontakt)');
    const [external, internal] = Array.from(el.querySelectorAll('a'));
    expect(external.getAttribute('target')).toBe('_blank');
    expect(external.getAttribute('rel')).toContain('noopener');
    expect(internal.hasAttribute('target')).toBe(false);

    const router = TestBed.inject(Router);
    const spy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    internal.click();
    expect(spy).toHaveBeenCalledWith('/kontakt');
  });

  it('entfernt Skripte und gefährliche Links (XSS-Schutz)', () => {
    const el = render('<script>alert(1)</script><img src=x onerror="alert(1)"> [x](javascript:alert(1))');
    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('img')?.getAttribute('onerror')).toBeNull();
    const link = render('[klick](javascript:alert(1))').querySelector('a');
    // Angular macht daraus unsafe:javascript:..., das wird nicht ausgeführt
    expect(link?.getAttribute('href') ?? '').not.toMatch(/^javascript:/);
  });
});
