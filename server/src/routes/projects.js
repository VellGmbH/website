// Projekte für alle (nur lesen)
// GET /api/projects
// GET /api/projects/:id
import { Router } from 'express';
import { toProject } from '../db/mappers.js';
import { HttpError } from '../middleware/errors.js';
import { parseId } from '../middleware/validate.js';

export function projectsRouter(db) {
  const router = Router();

  const listStmt = db.prepare('SELECT * FROM projects ORDER BY sort_order ASC, created_at DESC');
  const getStmt = db.prepare('SELECT * FROM projects WHERE id = ?');

  router.get('/', (_req, res) => {
    res.json(listStmt.all().map(toProject));
  });

  router.get('/:id', parseId, (req, res) => {
    const row = getStmt.get(req.id);
    if (!row) throw new HttpError(404, 'Projekt nicht gefunden.');
    res.json(toProject(row));
  });

  return router;
}
