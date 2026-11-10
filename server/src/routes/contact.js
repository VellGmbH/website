// Kontaktformular: POST /api/contact
// Nachricht wird verschlüsselt gespeichert und dann geht eine Mail an mich raus
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validateBody, rules } from '../middleware/validate.js';
import { encrypt } from '../security/crypto.js';
import { sendNewMessageNotification } from '../mail/mailer.js';

const contactSchema = {
  name: rules.requiredString(2, 100),
  email: rules.email,
  subject: rules.requiredString(3, 150),
  message: rules.requiredString(10, 5000),
  consent: (v) => (v === true ? null : 'Bitte der Datenschutzerklärung zustimmen.'),
};

export function contactRouter(db, { rateLimitEnabled = true } = {}) {
  const router = Router();

  // gegen Spam: max 5 Nachrichten pro IP in 15 Minuten
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Zu viele Nachrichten. Bitte später erneut versuchen.' },
    skip: () => !rateLimitEnabled,
  });

  const insertStmt = db.prepare(
    'INSERT INTO messages (name, email, subject, message) VALUES (?, ?, ?, ?)',
  );

  router.post('/', limiter, validateBody(contactSchema), (req, res) => {
    // Honeypot: unsichtbares Feld, wenn das ausgefüllt ist wars ein Bot
    // dann tun wir so als ob es geklappt hat, speichern aber nichts
    if (req.body.website) {
      return res.status(201).json({ ok: true });
    }

    const msg = {
      name: req.body.name.trim(),
      email: req.body.email.trim(),
      subject: req.body.subject.trim(),
      message: req.body.message.trim(),
    };

    insertStmt.run(encrypt(msg.name), encrypt(msg.email), encrypt(msg.subject), encrypt(msg.message));

    // nicht auf die Mail warten
    void sendNewMessageNotification(msg);

    // ID braucht der Besucher nicht
    res.status(201).json({ ok: true });
  });

  return router;
}
