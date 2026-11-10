// Admin Routen, nur mit Login
//
// GET    /api/admin/messages       Nachrichten (?unread=true nur ungelesene)
// PATCH  /api/admin/messages/:id   gelesen / ungelesen
// DELETE /api/admin/messages/:id   löschen
// POST   /api/admin/projects       Projekt anlegen
// PUT    /api/admin/projects/:id   Projekt ändern
// DELETE /api/admin/projects/:id   Projekt löschen
// Texte und Profil: siehe admin-content.js
import express, { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { validateBody, rules, parseId } from '../middleware/validate.js';
import { toMessage, toProject } from '../db/mappers.js';
import { registerContentRoutes } from './admin-content.js';

const projectSchema = {
  title: rules.requiredString(2, 120),
  description: rules.requiredString(10, 5000),
  technologies: rules.stringArray(20),
  githubUrl: rules.optionalUrl,
  demoUrl: rules.optionalUrl,
  imageUrl: rules.optionalUrl,
  sortOrder: rules.optionalInt,
};

// leere Strings als NULL speichern
const orNull = (v) => (v === undefined || v === null || v === '' ? null : v);

export function adminRouter(db) {
  const router = Router();
  router.use(requireAuth(db));
  // hier sind längere Texte erlaubt (Datenschutz ist lang), aber erst nach dem Login
  router.use(express.json({ limit: '200kb' }));

  // Nachrichten

  const listMessages = db.prepare('SELECT * FROM messages ORDER BY created_at DESC, id DESC');
  const listUnread = db.prepare('SELECT * FROM messages WHERE is_read = 0 ORDER BY created_at DESC, id DESC');
  const getMessage = db.prepare('SELECT * FROM messages WHERE id = ?');
  const setRead = db.prepare('UPDATE messages SET is_read = ? WHERE id = ?');
  const deleteMessage = db.prepare('DELETE FROM messages WHERE id = ?');

  router.get('/messages', (req, res) => {
    const rows = req.query.unread === 'true' ? listUnread.all() : listMessages.all();
    res.json(rows.map(toMessage));
  });

  router.patch('/messages/:id', parseId, validateBody({ isRead: rules.boolean }), (req, res) => {
    const result = setRead.run(req.body.isRead ? 1 : 0, req.id);
    if (result.changes === 0) throw new HttpError(404, 'Nachricht nicht gefunden.');
    res.json(toMessage(getMessage.get(req.id)));
  });

  router.delete('/messages/:id', parseId, (req, res) => {
    const result = deleteMessage.run(req.id);
    if (result.changes === 0) throw new HttpError(404, 'Nachricht nicht gefunden.');
    res.status(204).end();
  });

  // Projekte

  const getProject = db.prepare('SELECT * FROM projects WHERE id = ?');
  const insertProject = db.prepare(`
    INSERT INTO projects (title, description, technologies, github_url, demo_url, image_url, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const updateProject = db.prepare(`
    UPDATE projects
       SET title = ?, description = ?, technologies = ?, github_url = ?, demo_url = ?,
           image_url = ?, sort_order = ?, updated_at = datetime('now')
     WHERE id = ?
  `);
  const deleteProject = db.prepare('DELETE FROM projects WHERE id = ?');

  const projectParams = (b) => [
    b.title.trim(),
    b.description.trim(),
    JSON.stringify(b.technologies.map((t) => t.trim())),
    orNull(b.githubUrl),
    orNull(b.demoUrl),
    orNull(b.imageUrl),
    b.sortOrder ?? 0,
  ];

  router.post('/projects', validateBody(projectSchema), (req, res) => {
    const result = insertProject.run(...projectParams(req.body));
    res.status(201).json(toProject(getProject.get(result.lastInsertRowid)));
  });

  router.put('/projects/:id', parseId, validateBody(projectSchema), (req, res) => {
    const result = updateProject.run(...projectParams(req.body), req.id);
    if (result.changes === 0) throw new HttpError(404, 'Projekt nicht gefunden.');
    res.json(toProject(getProject.get(req.id)));
  });

  router.delete('/projects/:id', parseId, (req, res) => {
    const result = deleteProject.run(req.id);
    if (result.changes === 0) throw new HttpError(404, 'Projekt nicht gefunden.');
    res.status(204).end();
  });

  // Texte, Profil, Profilbild
  registerContentRoutes(router, db);

  return router;
}
