// schickt mir jede Nachricht vom Kontaktformular per Mail (mit Nodemailer)
// - Verbindung zum Mailserver immer verschlüsselt (TLS 1.2 oder neuer, Zertifikat wird geprüft)
// - nur Text, kein HTML, damit niemand was in die Mail einbauen kann
// - antworten geht direkt an den Absender (Reply-To)
// ohne SMTP Daten wird ein Ethereal Testkonto benutzt, der Link zur Mail steht dann in der Konsole
import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporterPromise = null;

function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = createTransporter().catch((err) => {
      transporterPromise = null; // nächstes Mal nochmal versuchen
      throw err;
    });
  }
  return transporterPromise;
}

async function createTransporter() {
  const { host, port, secure, user, pass } = config.mail;

  if (host) {
    return nodemailer.createTransport({
      host,
      port,
      secure, // Port 465: gleich verschlüsselt
      requireTLS: !secure, // Port 587: STARTTLS ist Pflicht, sonst wird nicht gesendet
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      auth: user ? { user, pass } : undefined,
      // nicht ewig warten wenn der Mailserver hängt
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  const testAccount = await nodemailer.createTestAccount();
  console.log('[mail] Kein SMTP konfiguriert – verwende Ethereal-Testkonto.');
  return nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
}

// Zeilenumbrüche und Steuerzeichen raus, damit keiner eigene Header einschleusen kann
export function cleanHeader(value, maxLength = 150) {
  return String(value)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

// baut die Mail zusammen (nur Text)
export function buildMail(msg) {
  const adminUrl = `${config.publicUrl}/admin/nachrichten`;
  const name = cleanHeader(msg.name, 100);
  const email = cleanHeader(msg.email, 254);

  if (!config.mail.includeContent) {
    return {
      subject: 'Neue Nachricht über das Kontaktformular',
      text: `Es ist eine neue Nachricht über das Kontaktformular gekommen.\n\nLesen im Admin Bereich:\n${adminUrl}\n`,
    };
  }

  return {
    subject: `Kontaktformular: ${cleanHeader(msg.subject)}`,
    replyTo: { name, address: email },
    text:
      `Von:     ${name} <${email}>\n` +
      `Betreff: ${cleanHeader(msg.subject)}\n` +
      `Datum:   ${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}\n` +
      `\n${msg.message}\n\n` +
      `--\nZum Antworten einfach auf diese Mail antworten.\nAdmin Bereich: ${adminUrl}\n`,
  };
}

// Mails pro Stunde zählen (gegen Spam von vielen verschiedenen IPs)
let sentTimes = [];
function underHourlyLimit() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  sentTimes = sentTimes.filter((t) => t > oneHourAgo);
  return sentTimes.length < config.mail.maxPerHour;
}

// Mail verschicken, gibt true zurück wenn es geklappt hat
// wenn nicht wird nur geloggt, die Nachricht ist ja gespeichert und outbox.js versucht es später nochmal
export async function sendNewMessageNotification(msg) {
  if (config.mail.disabled) return false;

  // bei Ethereal ist die Adresse egal
  const to = config.mail.to || (!config.mail.host ? 'test@example.com' : '');
  if (!to) {
    console.warn('[mail] MAIL_TO ist nicht gesetzt – keine Mail verschickt.');
    return false;
  }
  if (!underHourlyLimit()) {
    console.warn('[mail] Zu viele Mails in der letzten Stunde – wird später verschickt.');
    return false;
  }
  sentTimes.push(Date.now());

  const mail = {
    from: config.mail.from,
    to,
    ...buildMail(msg),
    headers: {
      // keine Abwesenheitsnotizen an den Absender schicken
      'Auto-Submitted': 'auto-generated',
      'X-Auto-Response-Suppress': 'All',
    },
  };

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail(mail);
    const preview = nodemailer.getTestMessageUrl(info);
    console.log(`[mail] Nachricht weitergeleitet.${preview ? ' Vorschau: ' + preview : ''}`);
    return true;
  } catch (err) {
    // nur die Fehlermeldung loggen, keine Daten aus der Nachricht
    console.error(`[mail] Versand fehlgeschlagen, wird später nochmal versucht: ${err.message}`);
    return false;
  }
}

// beim Start einmal testen ob die Anmeldung beim Mailserver klappt
export async function checkMailConnection() {
  if (config.mail.disabled || !config.mail.host) return;
  try {
    const transporter = await getTransporter();
    await transporter.verify();
    console.log(`[mail] Verbindung zu ${config.mail.host} ok (verschlüsselt). Mails gehen an ${config.mail.to || '(MAIL_TO fehlt!)'}.`);
  } catch (err) {
    console.error(`[mail] Keine Verbindung zum Mailserver: ${err.message}`);
  }
}
