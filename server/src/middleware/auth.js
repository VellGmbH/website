// Login-Sitzung für den Admin Bereich
// - das JWT ist in einem httpOnly Cookie, also kommt JavaScript nicht ran
// - SameSite=Strict, damit fremde Seiten das Cookie nicht mitschicken
// - CSRF Schutz: beim Login gibts ein zufälliges Token, das steht im JWT und im Cookie XSRF-TOKEN,
//   Angular schickt es als Header mit und der Server vergleicht beides
// - token_version wird beim Logout/Passwort ändern hochgezählt, dann sind alle alten Tokens ungültig
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { randomToken, safeEqual } from '../security/crypto.js';
import { HttpError } from './errors.js';

export const SESSION_COOKIE = 'session';
export const CSRF_COOKIE = 'XSRF-TOKEN';
export const CSRF_HEADER = 'x-xsrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// neue Sitzung: setzt das Session-Cookie und das CSRF-Cookie
export function issueSession(res, user) {
  const csrf = randomToken();
  const maxAge = config.session.hours * 60 * 60 * 1000;

  const token = jwt.sign(
    { sub: String(user.id), username: user.username, ver: user.token_version, csrf },
    config.session.secret,
    { expiresIn: `${config.session.hours}h`, algorithm: 'HS256' },
  );

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.session.cookieSecure,
    sameSite: 'strict',
    path: '/api',
    maxAge,
  });
  res.cookie(CSRF_COOKIE, csrf, {
    httpOnly: false, // muss für Angular lesbar sein
    secure: config.session.cookieSecure,
    sameSite: 'strict',
    path: '/',
    maxAge,
  });

  return { username: user.username, expiresAt: new Date(Date.now() + maxAge).toISOString() };
}

export function clearSession(res) {
  const base = { secure: config.session.cookieSecure, sameSite: 'strict' };
  res.clearCookie(SESSION_COOKIE, { ...base, httpOnly: true, path: '/api' });
  res.clearCookie(CSRF_COOKIE, { ...base, path: '/' });
}

// prüft ob man eingeloggt ist (und das CSRF-Token), Benutzer landet dann in req.user
export function requireAuth(db) {
  const findUser = db.prepare('SELECT id, username, token_version FROM admin_users WHERE id = ?');

  return (req, _res, next) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) return next(new HttpError(401, 'Nicht angemeldet.'));

    let payload;
    try {
      payload = jwt.verify(token, config.session.secret, { algorithms: ['HS256'] });
    } catch {
      return next(new HttpError(401, 'Sitzung ungültig oder abgelaufen.'));
    }

    const user = findUser.get(Number(payload.sub));
    if (!user || user.token_version !== payload.ver) {
      return next(new HttpError(401, 'Sitzung ungültig oder abgelaufen.'));
    }

    // bei POST/PUT/DELETE usw. auch das CSRF-Token prüfen
    if (!SAFE_METHODS.has(req.method)) {
      const header = req.get(CSRF_HEADER);
      if (!header || !safeEqual(header, payload.csrf)) {
        return next(new HttpError(403, 'CSRF-Prüfung fehlgeschlagen. Bitte Seite neu laden.'));
      }
    }

    req.user = user;
    next();
  };
}
