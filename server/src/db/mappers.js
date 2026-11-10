// macht aus den DB-Zeilen (snake_case) die Objekte für die API (camelCase)
import { decrypt } from '../security/crypto.js';

// SQLite Datum in ISO Format umwandeln
const toIso = (sqliteDate) => (sqliteDate ? sqliteDate.replace(' ', 'T') + 'Z' : null);

export function toProject(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    technologies: JSON.parse(row.technologies || '[]'),
    githubUrl: row.github_url,
    demoUrl: row.demo_url,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function toPage(row) {
  return {
    slug: row.slug,
    title: row.title,
    content: row.content,
    description: row.description ?? '',
    updatedAt: toIso(row.updated_at),
  };
}

// settings-Tabelle in ein Objekt umwandeln
// avatarVersion = wann das Profilbild geändert wurde, null = Standardbild
export function toSiteSettings(rows, avatarRow) {
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    name: map.name ?? '',
    tagline: map.tagline ?? '',
    githubUrl: map.githubUrl || null,
    description: map.description ?? '',
    keywords: map.keywords ?? '',
    avatarVersion: avatarRow ? toIso(avatarRow.updated_at) : null,
  };
}

// Nachricht entschlüsseln
export function toMessage(row) {
  return {
    id: row.id,
    name: decrypt(row.name),
    email: decrypt(row.email),
    subject: decrypt(row.subject),
    message: decrypt(row.message),
    isRead: row.is_read === 1,
    createdAt: toIso(row.created_at),
  };
}
