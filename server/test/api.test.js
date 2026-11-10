// Tests für die API (npm test)
// benutzt eine Datenbank im Speicher, Mails werden nicht verschickt
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

process.env.MAIL_DISABLED = 'true';
process.env.JWT_SECRET = randomBytes(48).toString('base64url');
process.env.MESSAGE_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.ADMIN_USERNAME = 'admin';
process.env.INITIAL_ADMIN_PASSWORD = 'test-passwort-123';

// erst jetzt laden, weil config.js die Variablen beim Import liest
const { openDatabase } = await import('../src/db/database.js');
const { createApp } = await import('../src/app.js');
const { encrypt, decrypt } = await import('../src/security/crypto.js');

let server;
let baseUrl;
let db;

// merkt sich die Cookies wie ein Browser
class Session {
  cookies = new Map();

  get csrf() {
    return this.cookies.get('XSRF-TOKEN');
  }

  async request(method, path, body, { csrf = true } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (csrf && this.csrf) headers['X-XSRF-TOKEN'] = this.csrf;

    const res = await fetch(baseUrl + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const [name, value] = pair.split('=');
      if (value) this.cookies.set(name, value);
      else this.cookies.delete(name);
    }

    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  }

  login(password = 'test-passwort-123') {
    return this.request('POST', '/auth/login', { username: 'admin', password });
  }
}

const anon = new Session();

before(async () => {
  db = openDatabase(':memory:');
  const app = createApp(db, { rateLimitEnabled: false });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://localhost:${server.address().port}/api`;
});

after(() => server.close());

const validMessage = {
  name: 'Max Mustermann',
  email: 'max@example.com',
  subject: 'Anfrage',
  message: 'Hallo, das ist eine Testnachricht.',
  consent: true,
};

// Allgemein

test('Sicherheits-Header sind gesetzt', async () => {
  const res = await anon.request('GET', '/health');
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-security-policy')?.includes("default-src 'self'"));
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('AES-GCM: verschlüsseln/entschlüsseln, Manipulation wird erkannt', () => {
  const enc = encrypt('geheim');
  assert.notEqual(enc, encrypt('geheim'), 'gleicher Klartext -> anderes Chiffrat (zufälliger IV)');
  assert.equal(decrypt(enc), 'geheim');

  const tampered = enc.slice(0, -4) + (enc.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  assert.throws(() => decrypt(tampered));
});

// Öffentlich

test('GET /projects liefert die Beispielprojekte', async () => {
  const res = await anon.request('GET', '/projects');
  assert.equal(res.status, 200);
  assert.ok(res.body.length >= 1);
  assert.ok(Array.isArray(res.body[0].technologies));
});

test('GET /projects/:id – 404 und 400', async () => {
  assert.equal((await anon.request('GET', '/projects/9999')).status, 404);
  assert.equal((await anon.request('GET', '/projects/abc')).status, 400);
});

test('POST /contact validiert die Eingaben (inkl. Einwilligung)', async () => {
  const res = await anon.request('POST', '/contact', { name: 'A', email: 'kaputt', subject: '', message: 'kurz' });
  assert.equal(res.status, 400);
  assert.deepEqual(Object.keys(res.body.details).sort(), ['consent', 'email', 'message', 'name', 'subject']);
});

test('POST /contact speichert die Nachricht verschlüsselt', async () => {
  const res = await anon.request('POST', '/contact', validMessage);
  assert.equal(res.status, 201);

  const row = db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 1').get();
  for (const field of ['name', 'email', 'subject', 'message']) {
    assert.ok(row[field].startsWith('enc:v1:'), `${field} ist verschlüsselt`);
    assert.ok(!row[field].includes(validMessage[field]), `${field} enthält keinen Klartext`);
  }
});

test('Ungültiges JSON ergibt 400', async () => {
  const res = await fetch(baseUrl + '/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{kaputt',
  });
  assert.equal(res.status, 400);
});

// Login

test('Admin-Routen sind ohne Sitzung gesperrt', async () => {
  assert.equal((await anon.request('GET', '/admin/messages')).status, 401);
  assert.equal((await anon.request('GET', '/auth/me')).status, 401);
});

test('Login mit falschem Passwort oder unbekanntem Benutzer schlägt fehl', async () => {
  const s = new Session();
  assert.equal((await s.login('falsch')).status, 401);
  const unknown = await s.request('POST', '/auth/login', { username: 'gibtsnicht', password: 'x' });
  assert.equal(unknown.status, 401);
  assert.equal(s.cookies.size, 0);
});

test('Login setzt httpOnly-Sitzungscookie, Token ist nicht im Body', async () => {
  const res = await fetch(baseUrl + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'test-passwort-123' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.token, undefined);

  const cookies = res.headers.getSetCookie();
  const session = cookies.find((c) => c.startsWith('session='));
  assert.match(session, /HttpOnly/);
  assert.match(session, /SameSite=Strict/);
  assert.ok(cookies.some((c) => c.startsWith('XSRF-TOKEN=') && !/HttpOnly/.test(c)));
});

test('Verändernde Anfragen ohne CSRF-Token werden abgelehnt', async () => {
  const s = new Session();
  await s.login();
  const res = await s.request('DELETE', '/admin/projects/1', undefined, { csrf: false });
  assert.equal(res.status, 403);
});

test('Logout beendet die Sitzung serverseitig', async () => {
  const s = new Session();
  await s.login();
  const oldCookies = new Map(s.cookies);

  assert.equal((await s.request('GET', '/auth/me')).status, 200);
  assert.equal((await s.request('POST', '/auth/logout')).status, 204);

  // altes Cookie geht danach nicht mehr
  const replay = new Session();
  replay.cookies = oldCookies;
  assert.equal((await replay.request('GET', '/auth/me')).status, 401);
});

// Admin

test('Admin: Nachrichten lesen (entschlüsselt), markieren und löschen', async () => {
  const s = new Session();
  await s.login();

  const list = await s.request('GET', '/admin/messages');
  assert.equal(list.status, 200);
  const msg = list.body.find((m) => m.subject === validMessage.subject);
  assert.equal(msg.message, validMessage.message);
  assert.equal(msg.isRead, false);

  const patched = await s.request('PATCH', `/admin/messages/${msg.id}`, { isRead: true });
  assert.equal(patched.body.isRead, true);

  const unread = await s.request('GET', '/admin/messages?unread=true');
  assert.equal(unread.body.length, 0);

  assert.equal((await s.request('DELETE', `/admin/messages/${msg.id}`)).status, 204);
  assert.equal((await s.request('DELETE', `/admin/messages/${msg.id}`)).status, 404);
});

test('Admin: Projekt anlegen, ändern und löschen', async () => {
  const s = new Session();
  await s.login();

  const project = {
    title: 'Testprojekt',
    description: 'Ein Projekt, das nur im Test existiert.',
    technologies: ['Node.js', 'SQLite'],
    githubUrl: 'https://github.com/example/test',
    demoUrl: '',
  };

  const created = await s.request('POST', '/admin/projects', project);
  assert.equal(created.status, 201);
  assert.equal(created.body.demoUrl, null);
  const id = created.body.id;

  const updated = await s.request('PUT', `/admin/projects/${id}`, { ...project, title: 'Geändert' });
  assert.equal(updated.body.title, 'Geändert');

  const invalid = await s.request('PUT', `/admin/projects/${id}`, { ...project, githubUrl: 'javascript:alert(1)' });
  assert.equal(invalid.status, 400);

  assert.equal((await s.request('DELETE', `/admin/projects/${id}`)).status, 204);
  assert.equal((await anon.request('GET', `/projects/${id}`)).status, 404);
});

test('Passwort ändern: Richtlinie, altes Passwort, andere Sitzungen beendet', async () => {
  const s = new Session();
  const other = new Session();
  await s.login();
  await other.login();

  const tooShort = await s.request('PUT', '/auth/password', { currentPassword: 'test-passwort-123', newPassword: 'kurz' });
  assert.equal(tooShort.status, 400);

  const wrongOld = await s.request('PUT', '/auth/password', { currentPassword: 'falsch', newPassword: 'neues-passwort-456' });
  assert.equal(wrongOld.status, 400);

  const ok = await s.request('PUT', '/auth/password', {
    currentPassword: 'test-passwort-123',
    newPassword: 'neues-passwort-456',
  });
  assert.equal(ok.status, 200);

  assert.equal((await s.request('GET', '/auth/me')).status, 200, 'eigene Sitzung bleibt gültig');
  assert.equal((await other.request('GET', '/auth/me')).status, 401, 'andere Sitzungen sind beendet');

  // wieder zurücksetzen für die anderen Tests
  await s.request('PUT', '/auth/password', { currentPassword: 'neues-passwort-456', newPassword: 'test-passwort-123' });
});

test('Konto wird nach 5 Fehlversuchen gesperrt', async () => {
  const s = new Session();
  for (let i = 0; i < 5; i++) {
    assert.equal((await s.login('falsch')).status, 401);
  }
  assert.equal((await s.login()).status, 429, 'auch mit richtigem Passwort gesperrt');

  db.prepare('UPDATE admin_users SET failed_attempts = 0, locked_until = NULL').run();
});

test('Inhalte: Seiten und Einstellungen sind öffentlich lesbar', async () => {
  const site = await anon.request('GET', '/site');
  assert.equal(site.status, 200);
  assert.equal(site.body.name, 'Daniel Shapiro');
  assert.equal(site.body.avatarVersion, null);

  const about = await anon.request('GET', '/pages/about');
  assert.equal(about.status, 200);
  assert.equal(about.body.title, 'Über mich');
  assert.match(about.body.content, /Kontaktformular/);

  assert.equal((await anon.request('GET', '/pages/gibt-es-nicht')).status, 404);
  assert.equal((await anon.request('GET', '/avatar')).status, 404);
});

test('Inhalte: Bearbeiten nur angemeldet und mit CSRF-Token', async () => {
  assert.equal((await anon.request('PUT', '/admin/pages/impressum', { title: 'X', content: 'y' })).status, 401);

  const s = new Session();
  await s.login();
  const noCsrf = await s.request('PUT', '/admin/pages/impressum', { title: 'X', content: 'y' }, { csrf: false });
  assert.equal(noCsrf.status, 403);
});

test('Admin: Seiten auflisten und bearbeiten', async () => {
  const s = new Session();
  await s.login();

  const list = await s.request('GET', '/admin/pages');
  assert.equal(list.status, 200);
  assert.deepEqual(
    list.body.map((p) => p.slug),
    ['about', 'projekte', 'kontakt', 'impressum', 'datenschutz'],
  );
  assert.ok(list.body.every((p) => p.label));

  const invalid = await s.request('PUT', '/admin/pages/impressum', { title: '', content: 'x' });
  assert.equal(invalid.status, 400);
  assert.ok(invalid.body.details.title);

  const saved = await s.request('PUT', '/admin/pages/impressum', {
    title: 'Impressum',
    content: '  Musterstraße 1\n66123 Saarbrücken  ',
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.content, 'Musterstraße 1\n66123 Saarbrücken');
  assert.equal((await anon.request('GET', '/pages/impressum')).body.content, 'Musterstraße 1\n66123 Saarbrücken');

  assert.equal((await s.request('PUT', '/admin/pages/neu', { title: 'Neu', content: '' })).status, 404);

  // im Admin Bereich gehen auch Texte über 20kb
  const long = await s.request('PUT', '/admin/pages/datenschutz', { title: 'Datenschutz', content: 'a'.repeat(30_000) });
  assert.equal(long.status, 200);
});

test('Admin: allgemeine Angaben ändern', async () => {
  const s = new Session();
  await s.login();

  const bad = await s.request('PUT', '/admin/settings', { name: '', tagline: 'x', githubUrl: 'javascript:alert(1)' });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.details.name && bad.body.details.githubUrl);

  const ok = await s.request('PUT', '/admin/settings', { name: 'Max', tagline: 'Hallo', githubUrl: '' });
  assert.equal(ok.status, 200);
  const site = (await anon.request('GET', '/site')).body;
  assert.equal(site.name, 'Max');
  assert.equal(site.tagline, 'Hallo');
  assert.equal(site.githubUrl, null);
});

test('Admin: Profilbild hochladen, prüfen und zurücksetzen', async () => {
  const s = new Session();
  await s.login();
  const headers = {
    Cookie: [...s.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
    'X-XSRF-TOKEN': s.csrf,
  };
  const upload = (body, type) =>
    fetch(baseUrl + '/admin/avatar', { method: 'PUT', headers: { ...headers, 'Content-Type': type }, body });

  // angeblich PNG, ist aber HTML
  assert.equal((await upload('<script>alert(1)</script>', 'image/png')).status, 415);
  // SVG geht nicht
  assert.equal((await upload('<svg/>', 'image/svg+xml')).status, 415);
  // zu groß
  assert.equal((await upload(Buffer.alloc(3 * 1024 * 1024), 'image/jpeg')).status, 413);

  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
  const res = await upload(png, 'image/png');
  assert.equal(res.status, 200);
  assert.ok((await res.json()).avatarVersion);

  const img = await fetch(baseUrl + '/avatar');
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
  assert.equal(img.headers.get('x-content-type-options'), 'nosniff');

  assert.equal((await s.request('DELETE', '/admin/avatar')).body.avatarVersion, null);
  assert.equal((await fetch(baseUrl + '/avatar')).status, 404);
});

// Mail

test('Mail: ganze Nachricht als reiner Text, Antwort geht an den Absender', async () => {
  const { buildMail } = await import('../src/mail/mailer.js');
  const mail = buildMail({ name: 'Max', email: 'max@example.com', subject: 'Hallo', message: '<b>Hi</b>\nZeile 2' });

  assert.equal(mail.subject, 'Kontaktformular: Hallo');
  assert.deepEqual(mail.replyTo, { name: 'Max', address: 'max@example.com' });
  assert.match(mail.text, /<b>Hi<\/b>\nZeile 2/);
  assert.equal(mail.html, undefined, 'kein HTML');
});

test('Mail: keine Header über Zeilenumbrüche einschleusen', async () => {
  const { buildMail, cleanHeader } = await import('../src/mail/mailer.js');
  const mail = buildMail({
    name: 'Max\r\nBcc: opfer@example.com',
    email: 'max@example.com',
    subject: 'Hallo\nBcc: opfer@example.com',
    message: 'x',
  });
  assert.doesNotMatch(mail.subject, /[\r\n]/);
  assert.doesNotMatch(mail.replyTo.name, /[\r\n]/);
  assert.equal(cleanHeader('a'.repeat(500)).length, 150);
});

test('Mail: neue Nachricht ist als "Mail noch offen" markiert', async () => {
  const res = await anon.request('POST', '/contact', validMessage);
  assert.equal(res.status, 201);
  const row = db.prepare('SELECT mail_sent FROM messages ORDER BY id DESC LIMIT 1').get();
  assert.equal(row.mail_sent, 0, 'Mail ist im Test abgeschaltet, also bleibt sie offen');
});

// SEO

test('SEO: robots.txt sperrt Admin und API, sitemap.xml enthält alle öffentlichen Seiten', async () => {
  const root = baseUrl.replace(/\/api$/, '');
  const robots = await fetch(root + '/robots.txt');
  const robotsText = await robots.text();
  assert.match(robotsText, /Disallow: \/admin\//);
  assert.match(robotsText, /Disallow: \/api\//);
  assert.match(robotsText, /Sitemap: .*\/sitemap\.xml/);

  const sitemap = await fetch(root + '/sitemap.xml');
  assert.match(sitemap.headers.get('content-type'), /xml/);
  const xml = await sitemap.text();
  for (const path of ['/projekte', '/kontakt', '/impressum', '/datenschutz', '/projekte/1']) {
    assert.ok(xml.includes(`${path}</loc>`), `${path} fehlt in der Sitemap`);
  }
  assert.ok(!xml.includes('/admin'));
});

test('SEO: Beschreibung pro Seite und Keywords sind änderbar, Längen werden geprüft', async () => {
  const s = new Session();
  await s.login();

  const tooLong = await s.request('PUT', '/admin/pages/about', { title: 'x'.repeat(81), content: '', description: 'y'.repeat(201) });
  assert.equal(tooLong.status, 400);
  assert.ok(tooLong.body.details.title && tooLong.body.details.description);

  const ok = await s.request('PUT', '/admin/pages/about', { title: 'Über mich', content: 'Hallo', description: 'Kurz und knapp' });
  assert.equal(ok.body.description, 'Kurz und knapp');

  const settings = await s.request('PUT', '/admin/settings', {
    name: 'Daniel Shapiro', tagline: '', githubUrl: '', description: 'Seite', keywords: 'a, b',
  });
  assert.equal(settings.status, 200);
  assert.equal(settings.body.keywords, 'a, b');
});
