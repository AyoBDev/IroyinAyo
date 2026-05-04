const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { usePostgresAuthState } = require('./authState');

async function createConnection(messageHandler) {
  const isProduction = process.env.NODE_ENV === 'production';

  const { state, saveCreds } = isProduction
    ? await usePostgresAuthState()
    : await useMultiFileAuthState('./auth_store');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      console.log('Connection closed. Reconnecting:', shouldReconnect);

      if (shouldReconnect) {
        setTimeout(() => createConnection(messageHandler), 5000);
      }
    } else if (connection === 'open') {
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
