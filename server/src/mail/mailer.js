// Mail an mich wenn jemand das Kontaktformular abschickt (mit Nodemailer)
// in der Mail steht normalerweise nur dass es eine neue Nachricht gibt, nicht der Inhalt
// (kann man mit MAIL_INCLUDE_CONTENT=true ändern)
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
      secure,
      requireTLS: !secure, // nie unverschlüsselt senden
      tls: { minVersion: 'TLSv1.2' },
      auth: user ? { user, pass } : undefined,
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

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildMail(msg) {
  const adminUrl = `${config.publicUrl}/admin/nachrichten`;

  if (!config.mail.includeContent) {
    return {
      subject: 'Neue Nachricht über das Kontaktformular',
      text:
        'Über das Kontaktformular ist eine neue Nachricht eingegangen.\n\n' +
        `Lesen kannst du sie im Admin-Bereich:\n${adminUrl}\n`,
      html:
        '<p>Über das Kontaktformular ist eine neue Nachricht eingegangen.</p>' +
        `<p><a href="${escapeHtml(adminUrl)}">Im Admin-Bereich lesen</a></p>`,
    };
  }

  return {
    subject: `Neue Kontaktanfrage: ${msg.subject}`,
    replyTo: { name: msg.name, address: msg.email },
    text: `Von: ${msg.name} <${msg.email}>\nBetreff: ${msg.subject}\n\n${msg.message}\n\n${adminUrl}\n`,
    html: `
      <p><strong>Von:</strong> ${escapeHtml(msg.name)} &lt;${escapeHtml(msg.email)}&gt;<br>
         <strong>Betreff:</strong> ${escapeHtml(msg.subject)}</p>
      <p style="white-space:pre-wrap">${escapeHtml(msg.message)}</p>
      <p><a href="${escapeHtml(adminUrl)}">Im Admin-Bereich öffnen</a></p>
    `,
  };
}

// Benachrichtigung schicken. Wenn das schiefgeht wird nur geloggt,
// die Nachricht ist ja schon gespeichert
export async function sendNewMessageNotification(msg) {
  if (config.mail.disabled) return;

  try {
    // bei Ethereal ist die Adresse egal
    const to = config.mail.to || config.mail.user || (!config.mail.host ? 'test@example.com' : '');
    if (!to) {
      console.warn('[mail] MAIL_TO ist nicht gesetzt – keine Benachrichtigung verschickt.');
      return;
    }

    const transporter = await getTransporter();
    const info = await transporter.sendMail({ from: config.mail.from, to, ...buildMail(msg) });

    const preview = nodemailer.getTestMessageUrl(info);
    console.log(`[mail] Benachrichtigung verschickt.${preview ? ' Vorschau: ' + preview : ''}`);
  } catch (err) {
    console.error('[mail] Benachrichtigung konnte nicht verschickt werden:', err.message);
  }
}
