// sorgt dafür dass keine Mail verloren geht (z.B. wenn der Server neu startet oder Gmail kurz weg ist)
// jede neue Nachricht hat in der DB mail_sent = 0, erst wenn die Mail raus ist wird es 1
// was noch offen ist wird beim Start und dann alle 5 Minuten nochmal versucht (nur Nachrichten der letzten 24 Stunden)
import { config } from '../config.js';
import { toMessage } from '../db/mappers.js';
import { sendNewMessageNotification } from './mailer.js';

export function createMailOutbox(db) {
  const getMessage = db.prepare('SELECT * FROM messages WHERE id = ?');
  const listPending = db.prepare(
    "SELECT id FROM messages WHERE mail_sent = 0 AND created_at > datetime('now', '-1 day') ORDER BY id",
  );
  const markSent = db.prepare('UPDATE messages SET mail_sent = 1 WHERE id = ?');

  // damit eine Nachricht nicht 2x gleichzeitig verschickt wird
  const sending = new Set();

  async function send(id) {
    if (config.mail.disabled || sending.has(id)) return;
    const row = getMessage.get(id);
    if (!row || row.mail_sent) return;

    sending.add(id);
    try {
      if (await sendNewMessageNotification(toMessage(row))) markSent.run(id);
    } finally {
      sending.delete(id);
    }
  }

  async function sendPending() {
    for (const { id } of listPending.all()) await send(id);
  }

  return { send, sendPending };
}
