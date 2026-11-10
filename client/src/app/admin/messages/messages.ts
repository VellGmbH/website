import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ApiService, errorMessage } from '../../core/api.service';
import { Message } from '../../core/models';

// Nachrichten lesen, als gelesen markieren, löschen
@Component({
  selector: 'app-messages',
  imports: [DatePipe],
  template: `
    <p>
      {{ messages().length }} Nachricht(en), {{ unreadCount() }} ungelesen.
      <label class="inline">
        <input type="checkbox" [checked]="onlyUnread()" (change)="onlyUnread.set(!onlyUnread())" />
        nur ungelesene
      </label>
    </p>

    @if (error()) {
      <p class="error">{{ error() }}</p>
    }

    @if (loading()) {
      <p class="muted">Lade …</p>
    } @else {
      <table>
        <thead>
          <tr>
            <th>Datum</th>
            <th>Von</th>
            <th>Betreff</th>
          </tr>
        </thead>
        <tbody>
          @for (m of visible(); track m.id) {
            <tr [class.unread]="!m.isRead">
              <td class="nowrap">{{ m.createdAt | date: 'dd.MM.yy HH:mm' }}</td>
              <td>{{ m.name }}</td>
              <td>
                <button type="button" class="link" (click)="toggle(m)" [attr.aria-expanded]="openId() === m.id">
                  {{ m.subject }}
                </button>
              </td>
            </tr>
            @if (openId() === m.id) {
              <tr class="details">
                <td colspan="3">
                  <p class="muted">{{ m.name }} &lt;{{ m.email }}&gt;</p>
                  <p class="text">{{ m.message }}</p>
                  <p>
                    <a class="button" [href]="mailto(m)">Antworten</a>
                    <button type="button" (click)="setRead(m, !m.isRead)">
                      {{ m.isRead ? 'Als ungelesen markieren' : 'Als gelesen markieren' }}
                    </button>
                    <button type="button" class="danger" (click)="remove(m)">Löschen</button>
                  </p>
                </td>
              </tr>
            }
          } @empty {
            <tr><td colspan="3" class="muted">Keine Nachrichten.</td></tr>
          }
        </tbody>
      </table>
    }
  `,
  styles: `
    .inline {
      display: inline-flex;
      gap: 0.3rem;
      margin-left: 1rem;
    }
    .unread td {
      font-weight: 700;
    }
    .unread .link {
      font-weight: 700;
    }
    .nowrap {
      white-space: nowrap;
    }
    .link {
      text-align: left;
    }
    .details td {
      background: var(--code-bg);
      padding: 0.75rem;
    }
    .text {
      white-space: pre-wrap;
      word-break: break-word;
    }
    .details button,
    .details .button {
      margin-right: 0.4rem;
    }
  `,
})
export class Messages {
  private readonly api = inject(ApiService);

  protected readonly messages = signal<Message[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly onlyUnread = signal(false);
  protected readonly openId = signal<number | null>(null);

  protected readonly unreadCount = computed(() => this.messages().filter((m) => !m.isRead).length);
  protected readonly visible = computed(() =>
    this.onlyUnread() ? this.messages().filter((m) => !m.isRead) : this.messages(),
  );

  constructor() {
    this.api.getMessages().subscribe({
      next: (messages) => {
        this.messages.set(messages);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected mailto(m: Message): string {
    return `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent('Re: ' + m.subject)}`;
  }

  // Nachricht auf/zu klappen, beim Aufklappen als gelesen markieren
  protected toggle(m: Message): void {
    if (this.openId() === m.id) {
      this.openId.set(null);
      return;
    }
    this.openId.set(m.id);
    if (!m.isRead) this.setRead(m, true);
  }

  protected setRead(m: Message, isRead: boolean): void {
    this.api.setMessageRead(m.id, isRead).subscribe({
      next: (updated) => this.messages.update((list) => list.map((x) => (x.id === updated.id ? updated : x))),
      error: (err) => this.error.set(errorMessage(err)),
    });
  }

  protected remove(m: Message): void {
    if (!confirm(`Nachricht "${m.subject}" von ${m.name} wirklich löschen?`)) return;
    this.api.deleteMessage(m.id).subscribe({
      next: () => this.messages.update((list) => list.filter((x) => x.id !== m.id)),
      error: (err) => this.error.set(errorMessage(err)),
    });
  }
}
