const db = require('../../config/database');
const { getBotSocket } = require('../../bot/botSocket');

// Pacing: randomized delay between sends + cool-down every chunk.
// WhatsApp flags bursty automation; jitter + chunked pacing keeps sends under the radar.
const SEND_DELAY_MIN_MS = 3000;
const SEND_DELAY_MAX_MS = 8000;
const CHUNK_SIZE = 50;
const CHUNK_PAUSE_MIN_MS = 30000;
const CHUNK_PAUSE_MAX_MS = 60000;

function randomDelay(minMs, maxMs) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendPayload(sock, recipientJid, caption, imageBuffer) {
  if (imageBuffer) {
    await sock.sendMessage(recipientJid, {
      image: imageBuffer,
      caption: caption || undefined,
    });
  } else {
    await sock.sendMessage(recipientJid, { text: caption });
  }
}

function estimateRangeMin(count) {
  const min = (count * SEND_DELAY_MIN_MS + Math.floor(count / CHUNK_SIZE) * CHUNK_PAUSE_MIN_MS) / 1000 / 60;
  const max = (count * SEND_DELAY_MAX_MS + Math.floor(count / CHUNK_SIZE) * CHUNK_PAUSE_MAX_MS) / 1000 / 60;
  return { min: Math.round(min), max: Math.round(max) };
}

async function sendToOne(phone, caption, imageBuffer) {
  const sock = getBotSocket();
  if (!sock) throw new Error('Bot socket not connected');
  const cleanPhone = String(phone).replace(/\D/g, '');
  if (!cleanPhone) throw new Error('Invalid phone number');
  await sendPayload(sock, `${cleanPhone}@s.whatsapp.net`, caption, imageBuffer);
  return { sent: 1, recipient: cleanPhone };
}

// Runs in the background — does not block the HTTP response.
async function broadcastToAll(caption, imageBuffer) {
  const sock = getBotSocket();
  if (!sock) throw new Error('Bot socket not connected');

  const students = await db('students').where({ is_banned: false }).select('phone_number');
  const eta = estimateRangeMin(students.length);
  console.log(`[broadcast] starting to ${students.length} students; eta ${eta.min}–${eta.max} min`);

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    try {
      await sendPayload(sock, `${student.phone_number}@s.whatsapp.net`, caption, imageBuffer);
      sent++;
      if (sent % 25 === 0) console.log(`[broadcast] progress: ${sent}/${students.length} sent, ${failed} failed`);
    } catch (err) {
      failed++;
      console.error(`[broadcast] failed for ${student.phone_number}:`, err.message);
    }

    if (i < students.length - 1) {
      const isChunkBoundary = (i + 1) % CHUNK_SIZE === 0;
      if (isChunkBoundary) {
        await randomDelay(CHUNK_PAUSE_MIN_MS, CHUNK_PAUSE_MAX_MS);
      } else {
        await randomDelay(SEND_DELAY_MIN_MS, SEND_DELAY_MAX_MS);
      }
    }
  }

  console.log(`[broadcast] complete: ${sent}/${students.length} sent, ${failed} failed`);
  return { sent, failed, total: students.length };
}

module.exports = { sendToOne, broadcastToAll, estimateRangeMin };
