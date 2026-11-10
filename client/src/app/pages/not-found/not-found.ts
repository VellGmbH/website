import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <h1>404</h1>
    <p>Diese Seite gibt es nicht (mehr).</p>
    <p><a routerLink="/">Zur Startseite</a></p>
  `,
})
export class NotFound {}
