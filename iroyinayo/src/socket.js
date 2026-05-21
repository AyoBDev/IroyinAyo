const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('./config/database');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-secret' : (() => { throw new Error('JWT_SECRET env var is required in production'); })());

let io = null;
const chatHistory = [];
const marketChatHistory = {};
const MAX_CHAT_HISTORY = 50;

function createSocketServer(httpServer) {
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : (process.env.NODE_ENV === 'production' ? false : true);

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    let studentId = null;
    let studentName = null;
    let lastChatTime = 0;

    const token = socket.handshake.auth.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.purpose) {
          // URL exchange tokens are not valid for socket auth
        } else {
          studentId = decoded.studentId;
          socket.join(`student:${studentId}`);
          db('students').where({ id: studentId }).first().then((student) => {
            if (student) studentName = student.name;
          });
        }
      } catch (err) {
        // Anonymous connection
      }
    }

    socket.on('chat:join', ({ marketId } = {}) => {
      if (marketId) {
        socket.join(`market:${marketId}`);
        const history = marketChatHistory[marketId] || [];
        socket.emit('chat:history', history.slice(-MAX_CHAT_HISTORY));
      } else {
        socket.emit('chat:history', chatHistory.slice(-MAX_CHAT_HISTORY));
      }
    });

    socket.on('chat:leave', ({ marketId }) => {
      if (marketId) socket.leave(`market:${marketId}`);
    });

    socket.on('chat:send', ({ text, marketId }) => {
      if (!text || !text.trim() || !studentId) return;
      const now = Date.now();
      if (now - lastChatTime < 1000) return;
      lastChatTime = now;
      const sanitized = text.trim().slice(0, 200).replace(/[<>]/g, '');

      const msg = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId: studentId,
        userName: studentName || 'Anon',
        text: sanitized,
        marketId: marketId || null,
        timestamp: Date.now(),
      };

      if (marketId) {
        if (!marketChatHistory[marketId]) marketChatHistory[marketId] = [];
        marketChatHistory[marketId].push(msg);
        if (marketChatHistory[marketId].length > MAX_CHAT_HISTORY) {
          marketChatHistory[marketId].shift();
        }
        io.to(`market:${marketId}`).emit('chat:message', msg);
      } else {
        chatHistory.push(msg);
        if (chatHistory.length > MAX_CHAT_HISTORY) {
          chatHistory.shift();
        }
        io.emit('chat:message', msg);
      }
    });
  });

  return io;
}

function getIO() {
  return io;
}

module.exports = { createSocketServer, getIO };
