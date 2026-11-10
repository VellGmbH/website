import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('erstellt die Anwendung', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('zeigt Navigation und Login-Link an', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('nav')?.textContent).toContain('Projekte');
    expect(el.querySelector('nav')?.textContent).toContain('Kontakt');
    expect(el.querySelector('.footnote')?.textContent).toContain('Login');
  });

  it('schaltet zwischen hell und dunkel um', async () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.theme-toggle')!;
    button.click();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
