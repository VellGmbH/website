import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AdminPage,
  ApiError,
  ContactRequest,
  Message,
  Page,
  Project,
  ProjectInput,
  SiteSettings,
  SiteSettingsInput,
} from './models';

// alle Aufrufe an die API
// beim Entwickeln leitet der Proxy /api an den Server weiter (proxy.conf.json)
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';

  // öffentlich

  getProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.base}/projects`);
  }

  getProject(id: number): Observable<Project> {
    return this.http.get<Project>(`${this.base}/projects/${id}`);
  }

  sendContact(data: ContactRequest): Observable<{ ok: boolean; id?: number }> {
    return this.http.post<{ ok: boolean; id?: number }>(`${this.base}/contact`, data);
  }

  // Admin

  getMessages(onlyUnread = false): Observable<Message[]> {
    const params = onlyUnread ? new HttpParams().set('unread', 'true') : undefined;
    return this.http.get<Message[]>(`${this.base}/admin/messages`, { params });
  }

  setMessageRead(id: number, isRead: boolean): Observable<Message> {
    return this.http.patch<Message>(`${this.base}/admin/messages/${id}`, { isRead });
  }

  deleteMessage(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/admin/messages/${id}`);
  }

  createProject(data: ProjectInput): Observable<Project> {
    return this.http.post<Project>(`${this.base}/admin/projects`, data);
  }

  updateProject(id: number, data: ProjectInput): Observable<Project> {
    return this.http.put<Project>(`${this.base}/admin/projects/${id}`, data);
  }

  deleteProject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/admin/projects/${id}`);
  }

  // Texte und Profil

  getSite(): Observable<SiteSettings> {
    return this.http.get<SiteSettings>(`${this.base}/site`);
  }

  getPage(slug: string): Observable<Page> {
    return this.http.get<Page>(`${this.base}/pages/${encodeURIComponent(slug)}`);
  }

  getAdminPages(): Observable<AdminPage[]> {
    return this.http.get<AdminPage[]>(`${this.base}/admin/pages`);
  }

  updatePage(slug: string, data: Pick<Page, 'title' | 'content'>): Observable<Page> {
    return this.http.put<Page>(`${this.base}/admin/pages/${encodeURIComponent(slug)}`, data);
  }

  updateSettings(data: SiteSettingsInput): Observable<SiteSettings> {
    return this.http.put<SiteSettings>(`${this.base}/admin/settings`, data);
  }

  // Bild direkt als Body schicken
  uploadAvatar(file: File): Observable<SiteSettings> {
    return this.http.put<SiteSettings>(`${this.base}/admin/avatar`, file, {
      headers: { 'Content-Type': file.type },
    });
  }

  resetAvatar(): Observable<SiteSettings> {
    return this.http.delete<SiteSettings>(`${this.base}/admin/avatar`);
  }
}

// Fehlermeldung aus der Antwort holen
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Server nicht erreichbar.';
    const body = err.error as ApiError | null;
    if (body?.details) {
      return `${body.error} ${Object.entries(body.details)
        .map(([field, msg]) => `${field}: ${msg}`)
        .join(' · ')}`;
    }
    if (body?.error) return body.error;
  }
  return 'Ein unerwarteter Fehler ist aufgetreten.';
}
