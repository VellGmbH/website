// Admin Routen für Texte, Profil und Profilbild (werden in admin.js eingebunden)
//
// GET    /api/admin/pages         alle Seiten
// PUT    /api/admin/pages/:slug   Seite speichern { title, content }
// PUT    /api/admin/settings      { name, tagline, githubUrl }
// PUT    /api/admin/avatar        Profilbild hochladen (max 2 MB)
// DELETE /api/admin/avatar         wieder Standardbild
import express from 'express';
import { HttpError } from '../middleware/errors.js';
import { validateBody, rules } from '../middleware/validate.js';
import { toPage, toSiteSettings } from '../db/mappers.js';
import { defaultPages } from '../db/content-seed.js';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const pageSchema = {
  title: rules.requiredString(1, 120),
  content: rules.optionalString(50_000),
};

const settingsSchema = {
  name: rules.requiredString(1, 80),
  tagline: rules.optionalString(150),
  githubUrl: rules.optionalUrl,
};

// Bildtyp an den ersten Bytes der Datei erkennen, dem Header kann man nicht trauen
// SVG geht absichtlich nicht weil da Skripte drin sein können
function detectImageType(buf) {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

export function registerContentRoutes(router, db) {
  // Seiten

  const getPage = db.prepare('SELECT * FROM pages WHERE slug = ?');
  const allPages = db.prepare('SELECT * FROM pages');
  const updatePage = db.prepare("UPDATE pages SET title = ?, content = ?, updated_at = datetime('now') WHERE slug = ?");

  router.get('/pages', (_req, res) => {
    const rows = new Map(allPages.all().map((r) => [r.slug, r]));
    // Reihenfolge und Namen kommen aus content-seed.js
    const pages = defaultPages
      .filter((d) => rows.has(d.slug))
      .map((d) => ({ ...toPage(rows.get(d.slug)), label: d.label }));
    res.json(pages);
  });

  router.put('/pages/:slug', validateBody(pageSchema), (req, res) => {
    const slug = String(req.params.slug);
    const result = updatePage.run(req.body.title.trim(), (req.body.content ?? '').trim(), slug);
    if (result.changes === 0) throw new HttpError(404, 'Seite nicht gefunden.');
    res.json(toPage(getPage.get(slug)));
  });

  // Name, Untertitel, GitHub

  const upsertSetting = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);
  const allSettings = db.prepare('SELECT key, value FROM settings');
  const getAvatarVersion = db.prepare("SELECT updated_at FROM assets WHERE name = 'avatar'");

  router.put('/settings', validateBody(settingsSchema), (req, res) => {
    const { name, tagline, githubUrl } = req.body;
    upsertSetting.run('name', name.trim());
    upsertSetting.run('tagline', (tagline ?? '').trim());
    upsertSetting.run('githubUrl', (githubUrl ?? '').trim());
    res.json(toSiteSettings(allSettings.all(), getAvatarVersion.get()));
  });

  // Profilbild

  // mit Millisekunden, sonst ändert sich die Version nicht wenn man 2x schnell hochlädt
  const upsertAvatar = db.prepare(`
    INSERT INTO assets (name, mime_type, data, updated_at)
    VALUES ('avatar', ?, ?, strftime('%Y-%m-%d %H:%M:%f', 'now'))
    ON CONFLICT(name) DO UPDATE SET mime_type = excluded.mime_type, data = excluded.data,
                                    updated_at = excluded.updated_at
  `);
  const deleteAvatar = db.prepare("DELETE FROM assets WHERE name = 'avatar'");

  router.put(
    '/avatar',
    express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: MAX_AVATAR_BYTES }),
    (req, res) => {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        throw new HttpError(415, 'Bitte ein Bild im Format PNG, JPEG oder WebP hochladen.');
      }
      const mime = detectImageType(req.body);
      if (!mime) throw new HttpError(415, 'Die Datei ist kein gültiges PNG-, JPEG- oder WebP-Bild.');

      upsertAvatar.run(mime, req.body);
      res.json(toSiteSettings(allSettings.all(), getAvatarVersion.get()));
    },
  );

  router.delete('/avatar', (_req, res) => {
    deleteAvatar.run();
    res.json(toSiteSettings(allSettings.all(), getAvatarVersion.get()));
  });
}
