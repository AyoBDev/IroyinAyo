const contentService = require('../../modules/content/content.service');
const { formatFeed } = require('../formatters');

async function handleInfo(sock, jid, student) {
  const feed = await contentService.getFeedForStudent(student.id);
  const items = feed.slice(0, 3);
  await sock.sendMessage(jid, { text: formatFeed(items) });
}

module.exports = { handleInfo };
