// einfache Validierung, jede Regel gibt einen Fehlertext oder null zurück
import { HttpError } from './errors.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const rules = {
  requiredString: (min, max) => (v) => {
    if (typeof v !== 'string' || v.trim().length === 0) return 'Pflichtfeld.';
    const len = v.trim().length;
    if (len < min) return `Mindestens ${min} Zeichen.`;
    if (len > max) return `Höchstens ${max} Zeichen.`;
    return null;
  },
  optionalString: (max) => (v) => {
    if (v === undefined || v === null) return null;
    if (typeof v !== 'string') return 'Muss ein Text sein.';
    return v.trim().length > max ? `Höchstens ${max} Zeichen.` : null;
  },
  email: (v) =>
    typeof v === 'string' && EMAIL_RE.test(v.trim()) && v.length <= 254 ? null : 'Ungültige E-Mail-Adresse.',
  optionalUrl: (v) => {
    if (v === undefined || v === null || v === '') return null;
    try {
      const url = new URL(v);
      return ['http:', 'https:'].includes(url.protocol) ? null : 'Nur http(s)-Links erlaubt.';
    } catch {
      return 'Ungültige URL.';
    }
  },
  stringArray: (maxItems) => (v) => {
    if (!Array.isArray(v)) return 'Muss eine Liste sein.';
    if (v.length > maxItems) return `Höchstens ${maxItems} Einträge.`;
    if (v.some((s) => typeof s !== 'string' || s.trim() === '' || s.length > 50)) {
      return 'Jeder Eintrag muss ein nicht-leerer Text (max. 50 Zeichen) sein.';
    }
    return null;
  },
  optionalInt: (v) => (v === undefined || Number.isInteger(v) ? null : 'Muss eine ganze Zahl sein.'),
  boolean: (v) => (typeof v === 'boolean' ? null : 'Muss true oder false sein.'),
};

// prüft req.body mit den Regeln aus dem Schema
// partial = true -> nur Felder prüfen die mitgeschickt wurden
export function validateBody(schema, { partial = false } = {}) {
  return (req, _res, next) => {
    const body = req.body ?? {};
    const errors = {};

    for (const [field, rule] of Object.entries(schema)) {
      if (partial && !(field in body)) continue;
      const error = rule(body[field]);
      if (error) errors[field] = error;
    }

    if (Object.keys(errors).length > 0) {
      return next(new HttpError(400, 'Validierung fehlgeschlagen.', errors));
    }
    next();
  };
}

// :id muss eine positive Zahl sein, steht dann in req.id
export function parseId(req, _res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return next(new HttpError(400, 'Ungültige ID.'));
  }
  req.id = id;
  next();
}
