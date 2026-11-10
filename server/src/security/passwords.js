// Passwörter mit bcrypt hashen
// 12 Runden dauern ca. 250ms, das reicht gegen Durchprobieren
import bcrypt from 'bcryptjs';

const COST = 12;

// prüft ob das Passwort lang genug ist, gibt Fehlertext oder null zurück
export function checkPasswordPolicy(password) {
  if (typeof password !== 'string') return 'Pflichtfeld.';
  if (password.length < 12) return 'Mindestens 12 Zeichen.';
  if (password.length > 200) return 'Höchstens 200 Zeichen.';
  return null;
}

export function hashPassword(password) {
  return bcrypt.hashSync(password, COST);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Hash zum Vergleichen wenn es den Benutzer gar nicht gibt
// damit der Login gleich lange dauert und man nicht erraten kann welche Benutzer es gibt
export const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', COST);
