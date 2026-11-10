// Admin Passwort zurücksetzen falls man es vergessen hat
// npm run reset-password              -> zufälliges Passwort
// npm run reset-password -- <passwort> -> eigenes Passwort
import { openDatabase } from '../src/db/database.js';
import { checkPasswordPolicy, hashPassword } from '../src/security/passwords.js';
import { randomToken } from '../src/security/crypto.js';
import { config } from '../src/config.js';

const password = process.argv[2] || randomToken(12);
const policyError = checkPasswordPolicy(password);
if (policyError) {
  console.error(`Passwort ungültig: ${policyError}`);
  process.exit(1);
}

const db = openDatabase();
const result = db
  .prepare(
    `UPDATE admin_users
        SET password_hash = ?, token_version = token_version + 1, failed_attempts = 0, locked_until = NULL
      WHERE username = ?`,
  )
  .run(hashPassword(password), config.adminUsername);
db.close();

if (result.changes === 0) {
  console.error(`Benutzer "${config.adminUsername}" nicht gefunden.`);
  process.exit(1);
}

console.log(`Passwort für "${config.adminUsername}" wurde geändert.`);
if (!process.argv[2]) console.log(`Neues Passwort: ${password}`);
