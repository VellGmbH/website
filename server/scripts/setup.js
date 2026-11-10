// erstellt die .env aus .env.example und trägt zufällige Schlüssel ein
// npm run setup              -> neue .env (nur wenn noch keine da ist)
// npm run setup -- --force   -> überschreibt die .env
// Achtung: mit neuem MESSAGE_ENCRYPTION_KEY kann man alte Nachrichten nicht mehr lesen!
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const examplePath = root + '.env.example';
const envPath = root + '.env';
const force = process.argv.includes('--force');

if (existsSync(envPath) && !force) {
  console.error('.env existiert bereits. Zum Überschreiben: npm run setup -- --force');
  console.error('Achtung: Mit einem neuen MESSAGE_ENCRYPTION_KEY sind alte Nachrichten nicht mehr lesbar.');
  process.exit(1);
}

const secrets = {
  JWT_SECRET: randomBytes(48).toString('base64url'),
  MESSAGE_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
};

let content = readFileSync(examplePath, 'utf8');
for (const [key, value] of Object.entries(secrets)) {
  content = content.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);
}

writeFileSync(envPath, content, { encoding: 'utf8', mode: 0o600 });
console.log('server/.env wurde mit zufälligen Schlüsseln angelegt.');
console.log('Beim ersten Serverstart wird ein Admin-Passwort erzeugt und in der Konsole angezeigt.');
