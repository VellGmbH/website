import { Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

// zeigt den Fehler unter einem Formularfeld an
@Component({
  selector: 'app-field-error',
  template: `
    @if (message(); as msg) {
      <span class="field-error">{{ msg }}</span>
    }
  `,
})
export class FieldError {
  readonly control = input.required<AbstractControl>();

  // Methode weil Formulare keine Signals sind
  protected message(): string | null {
    const c = this.control();
    if (!c.errors || !c.touched) return null;

    const e = c.errors;
    if (e['required']) return typeof c.value === 'boolean' ? 'Bitte zustimmen.' : 'Bitte ausfüllen.';
    if (e['email']) return 'Das sieht nicht nach einer E-Mail-Adresse aus.';
    if (e['minlength']) return `Mindestens ${e['minlength'].requiredLength} Zeichen.`;
    if (e['maxlength']) return `Höchstens ${e['maxlength'].requiredLength} Zeichen.`;
    if (e['pattern']) return 'Ungültiges Format.';
    if (e['server']) return e['server'];
    return 'Ungültige Eingabe.';
  }
}
