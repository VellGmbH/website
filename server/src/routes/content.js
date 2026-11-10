// Texte und Profil für alle (nur lesen)
//
// GET /api/site         Name, Untertitel, GitHub, Profilbild-Version
// GET /api/pages/:slug  eine Seite
// GET /api/avatar       Profilbild (404 wenn keins hochgeladen)
import { Router } from 'express';
import { HttpError } from '../middleware/errors.js';
import { toPage, toSiteSettings } from '../db/mappers.js';

export function contentRouter(db) {
  const router = Router();

  const allSettings = db.prepare('SELECT key, value FROM settings');
  const getPage = db.prepare('SELECT * FROM pages WHERE slug = ?');
  const getAvatarVersion = db.prepare("SELECT updated_at FROM assets WHERE name = 'avatar'");
  const getAvatar = db.prepare("SELECT mime_type, data, updated_at FROM assets WHERE name = 'avatar'");

  router.get('/site', (_req, res) => {
    res.json(toSiteSettings(allSettings.all(), getAvatarVersion.get()));
  });

  router.get('/pages/:slug', (req, res) => {
    const row = getPage.get(String(req.params.slug));
    if (!row) throw new HttpError(404, 'Seite nicht gefunden.');
    res.json(toPage(row));
  });

  router.get('/avatar', (_req, res) => {
    const row = getAvatar.get();
    if (!row) throw new HttpError(404, 'Kein Profilbild hochgeladen.');
    // der Client hängt ?v=... an, deswegen darf der Browser das Bild cachen
    res.set('Cache-Control', 'public, max-age=86400');
    res.type(row.mime_type).send(Buffer.from(row.data));
  });

  return router;
}
