// Einstellungen aus der .env laden (Vorlage: .env.example)
// JWT_SECRET und MESSAGE_ENCRYPTION_KEY müssen gesetzt sein, sonst startet der Server nicht.
// Mit "npm run setup" wird die .env erstellt.
const env = process.env;
const isProduction = env.NODE_ENV === 'production';

function requireSecret(name, check, hint) {
  const value = env[name];
  if (!value || !check(value)) {
    throw new Error(
      `Konfigurationsfehler: ${name} fehlt oder ist ungültig (${hint}).\n` +
        `Führe im Ordner "server" einmal "npm run setup" aus, um eine .env mit sicheren Werten zu erzeugen.`,
    );
  }
  return value;
}

const jwtSecret = requireSecret('JWT_SECRET', (v) => v.length >= 32, 'mindestens 32 Zeichen');
const encryptionKey = Buffer.from(
  requireSecret(
    'MESSAGE_ENCRYPTION_KEY',
    (v) => Buffer.from(v, 'base64').length === 32,
    '32 Byte, Base64-kodiert',
  ),
  'base64',
);

export const config = {
  isProduction,
  port: Number(env.PORT) || 3000,
  dbPath: env.DB_PATH || './data/database.sqlite',

  // Adresse der Seite, wird für den Link in der Mail gebraucht
  publicUrl: (env.PUBLIC_URL || 'http://localhost:4200').replace(/\/$/, ''),

  // optional: Zertifikat für https
  https: {
    keyFile: env.HTTPS_KEY_FILE || '',
    certFile: env.HTTPS_CERT_FILE || '',
  },

  session: {
    secret: jwtSecret,
    hours: Number(env.SESSION_HOURS) || 2,
    // secure-Cookies gehen nur über https
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProduction,
  },

  // Schlüssel zum Verschlüsseln der Nachrichten
  encryptionKey,

  login: {
    maxFailedAttempts: 5,
    lockMinutes: 15,
  },

  // nach wie vielen Tagen alte Nachrichten gelöscht werden (0 = nie)
  messageRetentionDays: env.MESSAGE_RETENTION_DAYS !== undefined ? Number(env.MESSAGE_RETENTION_DAYS) : 180,

  // Benutzername für den ersten Admin
  adminUsername: env.ADMIN_USERNAME || 'admin',

  mail: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT) || 587,
    secure: env.SMTP_SECURE === 'true',
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || 'Website <no-reply@example.com>',
    to: env.MAIL_TO || '',
    // Nachrichtentext normalerweise nicht mitschicken, Mails sind ja nicht verschlüsselt
    includeContent: env.MAIL_INCLUDE_CONTENT === 'true',
    disabled: env.MAIL_DISABLED === 'true',
  },
};
