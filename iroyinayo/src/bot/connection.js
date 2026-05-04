const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { usePostgresAuthState } = require('./authState');

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

async function createConnection(messageHandler) {
  const isProduction = process.env.NODE_ENV === 'production';

  const { state, saveCreds } = isProduction
    ? await usePostgresAuthState()
    : await useMultiFileAuthState('./auth_store');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      if (isProduction) {
        console.log('WhatsApp QR code received but cannot display in production.');
        console.log('Pair the bot locally first, then export auth to the database.');
        console.log('See: node scripts/export-auth-to-db.js');
      } else {
        // In development, print QR to terminal using qrcode-terminal
        try {
          const qrcode = require('qrcode-terminal');
          qrcode.generate(qr, { small: true });
        } catch {
          console.log('QR code (scan with WhatsApp):', qr);
        }
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delay = Math.min(5000 * reconnectAttempts, 30000);
        console.log(`Connection closed (code: ${statusCode}). Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(() => createConnection(messageHandler), delay);
      } else if (!shouldReconnect) {
        console.log('WhatsApp logged out. Re-pair the bot to reconnect.');
      } else {
        console.log(`Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Bot stopped. Redeploy or restart to try again.`);
      }
    } else if (connection === 'open') {
      reconnectAttempts = 0;
      console.log('Iroyinayo bot connected to WhatsApp');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key.fromMe && msg.message) {
        const jid = msg.key.remoteJid;
        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          '';

        if (text && jid.endsWith('@s.whatsapp.net')) {
          try {
            await messageHandler(sock, jid, text.trim(), msg);
          } catch (err) {
            console.error(`Error handling message from ${jid}:`, err);
            await sock.sendMessage(jid, {
              text: '\u26a0 Something went wrong. Please try again.',
            });
          }
        }
      }
    }
  });

  return sock;
}

module.exports = { createConnection };
