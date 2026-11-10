// Datenbank (SQLite, ist bei Node schon dabei)
// beim Start: Tabellen anlegen, fehlende Spalten ergänzen, alte Nachrichten verschlüsseln,
// beim ersten Mal Admin und Beispieldaten anlegen
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config.js';
import { encrypt, isEncrypted, randomToken } from '../security/crypto.js';
import { hashPassword } from '../security/passwords.js';
import { seedProjects } from './seed.js';
import { defaultPages, defaultSettings } from './content-seed.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS projects (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT    NOT NULL,
    description   TEXT    NOT NULL,
    technologies  TEXT    NOT NULL DEFAULT '[]',  -- JSON-Array mit Strings
    github_url    TEXT,
    demo_url      TEXT,
    image_url     TEXT,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- name, email, subject und message sind verschlüsselt
  CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    email       TEXT    NOT NULL,
    subject     TEXT    NOT NULL,
    message     TEXT    NOT NULL,
    is_read     INTEGER NOT NULL DEFAULT 0,
    mail_sent   INTEGER NOT NULL DEFAULT 0,  -- 1 = Mail ist raus
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    username         TEXT    NOT NULL UNIQUE,
    password_hash    TEXT    NOT NULL,
    token_version    INTEGER NOT NULL DEFAULT 0,   -- hochzählen = alle ausloggen
    failed_attempts  INTEGER NOT NULL DEFAULT 0,
    locked_until     TEXT,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Name, Untertitel, GitHub usw.
  CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Seiten wie Über mich, Impressum, Datenschutz (Text ist Markdown)
  CREATE TABLE IF NOT EXISTS pages (
    slug        TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    content     TEXT NOT NULL DEFAULT '',
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- hochgeladene Dateien (Profilbild)
  CREATE TABLE IF NOT EXISTS assets (
    name        TEXT PRIMARY KEY,
    mime_type   TEXT NOT NULL,
    data        BLOB NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

// Spalten die ich später dazugemacht hab, für alte Datenbanken
const MIGRATIONS = [
  ['admin_users', 'token_version', 'INTEGER NOT NULL DEFAULT 0'],
  ['admin_users', 'failed_attempts', 'INTEGER NOT NULL DEFAULT 0'],
  ['admin_users', 'locked_until', 'TEXT'],
  ['messages', 'mail_sent', 'INTEGER NOT NULL DEFAULT 0'],
];

// Datenbank öffnen bzw. anlegen. Für die Tests geht auch ":memory:"
export function openDatabase(path = config.dbPath) {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA secure_delete = ON;');
  db.exec(SCHEMA);

  migrateColumns(db);
  encryptLegacyMessages(db);
  ensureAdminUser(db);
  ensureSeedData(db);
  ensureContent(db);

  return db;
}

// Standardtexte einfügen falls sie fehlen, schon geänderte Texte bleiben wie sie sind
function ensureContent(db) {
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaultSettings)) insertSetting.run(key, value);

  const insertPage = db.prepare('INSERT OR IGNORE INTO pages (slug, title, content) VALUES (?, ?, ?)');
  for (const p of defaultPages) insertPage.run(p.slug, p.title, p.content);
}

function migrateColumns(db) {
  for (const [table, column, definition] of MIGRATIONS) {
    const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
    if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// alte Nachrichten die noch unverschlüsselt sind nachträglich verschlüsseln
function encryptLegacyMessages(db) {
  const rows = db.prepare("SELECT * FROM messages WHERE message NOT LIKE 'enc:%'").all();
  if (rows.length === 0) return;

  const update = db.prepare('UPDATE messages SET name = ?, email = ?, subject = ?, message = ? WHERE id = ?');
  for (const r of rows) {
    const enc = (v) => (isEncrypted(v) ? v : encrypt(v));
    update.run(enc(r.name), enc(r.email), enc(r.subject), enc(r.message), r.id);
  }
  console.log(`[db] ${rows.length} unverschlüsselte Nachricht(en) verschlüsselt.`);
}

// beim ersten Start einen Admin anlegen, das zufällige Passwort wird nur einmal in der Konsole angezeigt
function ensureAdminUser(db) {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM admin_users').get();
  if (count > 0) return;

  const password = process.env.INITIAL_ADMIN_PASSWORD || randomToken(12);
  db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(
    config.adminUsername,
    hashPassword(password),
  );

  if (!process.env.INITIAL_ADMIN_PASSWORD) {
    console.log(
      '\n================ ADMIN-ZUGANG ================\n' +
        `  Benutzername: ${config.adminUsername}\n` +
        `  Passwort:     ${password}\n` +
        '  Bitte notieren und nach dem ersten Login im\n' +
        '  Admin-Bereich unter "Konto" ändern.\n' +
        '==============================================\n',
    );
  }
}

function ensureSeedData(db) {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM projects').get();
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO projects (title, description, technologies, github_url, demo_url, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  seedProjects.forEach((p, i) => {
    insert.run(p.title, p.description, JSON.stringify(p.technologies), p.githubUrl ?? null, p.demoUrl ?? null, i);
  });
}

// alte Nachrichten löschen
export function deleteExpiredMessages(db, days = config.messageRetentionDays) {
  if (!days || days <= 0) return 0;
  const result = db.prepare("DELETE FROM messages WHERE created_at < datetime('now', ?)").run(`-${days} days`);
  if (result.changes > 0) {
    console.log(`[db] ${result.changes} Nachricht(en) älter als ${days} Tage gelöscht.`);
  }
  return Number(result.changes);
}
