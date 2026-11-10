// Typen für die Daten von der API

export interface Project {
  id: number;
  title: string;
  description: string;
  technologies: string[];
  githubUrl: string | null;
  demoUrl: string | null;
  imageUrl: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// das wird beim Speichern von einem Projekt geschickt
export type ProjectInput = Pick<Project, 'title' | 'description' | 'technologies' | 'sortOrder'> & {
  githubUrl: string;
  demoUrl: string;
  imageUrl: string;
};

export interface ContactRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
  // Häkchen Datenschutz
  consent: boolean;
  // Honeypot gegen Bots, bleibt normal leer
  website?: string;
}

export interface Message {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// Name usw. für Seitenleiste, Titel und Footer
export interface SiteSettings {
  name: string;
  tagline: string;
  githubUrl: string | null;
  // für Suchmaschinen
  description: string;
  keywords: string;
  // null = Standardbild
  avatarVersion: string | null;
}

export type SiteSettingsInput = Pick<SiteSettings, 'name' | 'tagline' | 'description' | 'keywords'> & { githubUrl: string };

// Seite mit Text (Markdown)
export interface Page {
  slug: string;
  title: string;
  content: string;
  // meta description, max 200 Zeichen
  description: string;
  updatedAt: string;
}

// Seite im Admin Bereich, mit Namen
export interface AdminPage extends Page {
  label: string;
}

export interface LoginResponse {
  username: string;
  expiresAt: string;
}

// so sehen Fehler von der API aus
export interface ApiError {
  error: string;
  details?: Record<string, string>;
}
