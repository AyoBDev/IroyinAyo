const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { usePostgresAuthState } = require('./authState');
const { updateSocket } = require('./scheduler/dailyJobs');
const { setBotSocket } = require('./botSocket');

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
let latestQR = null;

function getLatestQR() { return latestQR; }

async function createConnection(messageHandler) {
  const isProduction = process.env.NODE_ENV === 'production';

  const { state, saveCreds } = isProduction
    ? await usePostgresAuthState()
    : await useMultiFileAuthState('./auth_store');

  const { version } = await fetchLatestBaileysVersion({});
  console.log('Using WA version:', version.join('.'));

  let qrDisplayed = false;

  const sock = makeWASocket({
    auth: state,
    version,
    browser: Browsers.ubuntu('Chrome'),
    logger: pino({ level: 'silent' }),
    qrTimeout: 60000,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrDisplayed = true;
      latestQR = qr;
      console.log('\n--- Scan this QR code with WhatsApp ---');
      if (isProduction) {
        console.log('QR available at /api/bot/qr endpoint');
      } else {
        try {
          const qrcode = require('qrcode-terminal');
          qrcode.generate(qr, { small: true });
        } catch {
          console.log('QR code:', qr);
        }
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      if (qrDisplayed && shouldReconnect) {
        console.log('QR code expired. Generating a new one...');
        setTimeout(() => createConnection(messageHandler), 2000);
        return;
      }

      if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delay = Math.min(5000 * reconnectAttempts, 30000);
        console.log(`Connection closed (code: ${statusCode}). Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(() => createConnection(messageHandler), delay);
      } else if (!shouldReconnect) {
        console.log('WhatsApp logged out. Re-pair the bot to reconnect.');
      } else {
        console.log(`Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Bot stopped.`);
      }
    } else if (connection === 'open') {
      reconnectAttempts = 0;
      qrDisplayed = false;
      latestQR = null;
      updateSocket(sock);
      setBotSocket(sock);
      console.log('Iroyinayo bot connected to WhatsApp');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const msg of messages) {
      if (!msg.key.fromMe && msg.message) {
        const jid = msg.key.remoteJid;
        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          '';

        if (text && (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid'))) {
          try {
            await messageHandler(sock, jid, text.trim(), msg);
          } catch (err) {
            console.error(`Error handling message from ${jid}:`, err);
            await sock.sendMessage(jid, {
              text: '⚠ Something went wrong. Please try again.',
            });
          }
        }
      }
    }
  });

  return sock;
}

module.exports = { createConnection, getLatestQR };
