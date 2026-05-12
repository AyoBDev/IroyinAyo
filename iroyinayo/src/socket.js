const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('./config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

let io = null;
const chatHistory = [];
const MAX_CHAT_HISTORY = 50;

function createSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    let studentId = null;
    let studentName = null;

    const token = socket.handshake.auth.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        studentId = decoded.studentId;
        socket.join(`student:${studentId}`);

        db('students').where({ id: studentId }).first().then((student) => {
          if (student) studentName = student.name;
        });
      } catch (err) {
        // Anonymous connection
      }
    }

    socket.on('chat:join', () => {
      socket.emit('chat:history', chatHistory.slice(-MAX_CHAT_HISTORY));
    });

    socket.on('chat:send', ({ text }) => {
      if (!text || !text.trim() || !studentId) return;
      const sanitized = text.trim().slice(0, 200);

      const msg = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId: studentId,
        userName: studentName || 'Anon',
        text: sanitized,
        timestamp: Date.now(),
      };

      chatHistory.push(msg);
      if (chatHistory.length > MAX_CHAT_HISTORY) {
        chatHistory.shift();
      }

      io.emit('chat:message', msg);
    });
  });

  return io;
}

function getIO() {
  return io;
}

module.exports = { createSocketServer, getIO };
