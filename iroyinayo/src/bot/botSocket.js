let sock = null;

function setBotSocket(s) {
  sock = s;
}

function getBotSocket() {
  return sock;
}

module.exports = { setBotSocket, getBotSocket };
