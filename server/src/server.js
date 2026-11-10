// startet den Server
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { openDatabase, deleteExpiredMessages } from './db/database.js';
import { createApp } from './app.js';
import { checkMailConnection } from './mail/mailer.js';

const db = openDatabase();

// alte Nachrichten löschen, beim Start und dann 1x am Tag
deleteExpiredMessages(db);
const cleanupTimer = setInterval(() => deleteExpiredMessages(db), 24 * 60 * 60 * 1000);
cleanupTimer.unref();

// hier liegt der gebaute Client (npm run build)
const staticDir = fileURLToPath(new URL('../../client/dist/client/browser', import.meta.url));
const app = createApp(db, { staticDir });

// https wenn ein Zertifikat angegeben ist
const useHttps = Boolean(config.https.keyFile && config.https.certFile);
const server = useHttps
  ? createHttpsServer({ key: readFileSync(config.https.keyFile), cert: readFileSync(config.https.certFile) }, app)
  : createHttpServer(app);

server.listen(config.port, () => {
  const protocol = useHttps ? 'https' : 'http';
  console.log(`[server] läuft auf ${protocol}://localhost:${config.port}`);
  void checkMailConnection();
});

// bei Strg+C sauber beenden
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
