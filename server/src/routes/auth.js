// Login / Logout für den Admin
//
// POST /api/auth/login     { username, password }
// POST /api/auth/logout    alle Sitzungen beenden
// GET  /api/auth/me        wer ist eingeloggt
// PUT  /api/auth/password  { currentPassword, newPassword }
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { HttpError } from '../middleware/errors.js';
import { requireAuth, issueSession, clearSession } from '../middleware/auth.js';
import { validateBody, rules } from '../middleware/validate.js';
import { checkPasswordPolicy, hashPassword, verifyPassword, DUMMY_HASH } from '../security/passwords.js';

const loginSchema = {
  username: rules.requiredString(1, 100),
  password: rules.requiredString(1, 200),
};

const passwordSchema = {
  currentPassword: rules.requiredString(1, 200),
  newPassword: checkPasswordPolicy,
};

export function authRouter(db, { rateLimitEnabled = true } = {}) {
  const router = Router();
  const auth = requireAuth(db);

  // max 10 Login-Versuche pro IP in 15 Minuten
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Zu viele Anmeldeversuche. Bitte später erneut versuchen.' },
    skip: () => !rateLimitEnabled,
  });

  const findByName = db.prepare('SELECT * FROM admin_users WHERE username = ?');
  const findById = db.prepare('SELECT * FROM admin_users WHERE id = ?');
  const loginFailed = db.prepare(`
    UPDATE admin_users
       SET failed_attempts = failed_attempts + 1,
           locked_until = CASE WHEN failed_attempts + 1 >= ? THEN datetime('now', ?) ELSE locked_until END
     WHERE id = ?
  `);
  const resetAttempts = db.prepare(
    'UPDATE admin_users SET failed_attempts = 0, locked_until = NULL WHERE id = ?',
  );
  const bumpTokenVersion = db.prepare('UPDATE admin_users SET token_version = token_version + 1 WHERE id = ?');
  const setPassword = db.prepare(
    'UPDATE admin_users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?',
  );

  const isLocked = (user) => user.locked_until && new Date(user.locked_until + 'Z').getTime() > Date.now();

  router.post('/login', limiter, validateBody(loginSchema), async (req, res) => {
    let user = findByName.get(req.body.username.trim());

    if (user && isLocked(user)) {
      throw new HttpError(429, 'Zu viele Fehlversuche. Das Konto ist vorübergehend gesperrt.');
    }
    // Sperre vorbei, Zähler wieder auf 0
    if (user?.locked_until) {
      resetAttempts.run(user.id);
      user = findByName.get(user.username);
    }

    // auch wenn es den Benutzer nicht gibt vergleichen, damit es gleich lang dauert
    const valid = await verifyPassword(req.body.password, user?.password_hash ?? DUMMY_HASH);

    if (!user || !valid) {
      if (user) {
        loginFailed.run(config.login.maxFailedAttempts, `+${config.login.lockMinutes} minutes`, user.id);
      }
      throw new HttpError(401, 'Benutzername oder Passwort falsch.');
    }

    resetAttempts.run(user.id);
    res.json(issueSession(res, user));
  });

  router.post('/logout', auth, (req, res) => {
    bumpTokenVersion.run(req.user.id);
    clearSession(res);
    res.status(204).end();
  });

  router.get('/me', auth, (req, res) => {
    res.json({ username: req.user.username });
  });

  router.put('/password', auth, validateBody(passwordSchema), async (req, res) => {
    const user = findById.get(req.user.id);
    const valid = await verifyPassword(req.body.currentPassword, user.password_hash);
    if (!valid) {
      throw new HttpError(400, 'Validierung fehlgeschlagen.', { currentPassword: 'Aktuelles Passwort ist falsch.' });
    }
    if (req.body.currentPassword === req.body.newPassword) {
      throw new HttpError(400, 'Validierung fehlgeschlagen.', { newPassword: 'Muss sich vom alten unterscheiden.' });
    }

    // neues Passwort speichern, andere Geräte ausloggen, hier neu einloggen
    setPassword.run(hashPassword(req.body.newPassword), user.id);
    res.json(issueSession(res, findById.get(user.id)));
  });

  return router;
}
