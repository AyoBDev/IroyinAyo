const { Server } = require('socket.io');
const db = require('./config/database');
const { verifySupabaseToken } = require('./middleware/verifySupabaseToken');

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

  io.on('connection', async (socket) => {
    let studentId = null;
    let studentName = null;
    let lastChatTime = 0;

    const token = socket.handshake.auth.token;
    if (token) {
      try {
        const { authUserId } = await verifySupabaseToken(`Bearer ${token}`);
        const student = await db('students').where({ auth_user_id: authUserId }).first();
        if (student && !student.is_banned) {
          studentId = student.id;
          studentName = student.name;
          socket.join(`student:${studentId}`);
        }
      } catch (err) {
        // Anonymous connection — token invalid or no student row yet
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

    // Crews room subscription: backend emits to `crew:${crewId}` for
    // crew:pool:prediction and crew:pool:resolved. Frontend (CrewDetail,
    // CrewPool) calls emit('crew:join', { crewId }) — without these handlers
    // the events would never reach the client.
    socket.on('crew:join', ({ crewId } = {}) => {
      if (typeof crewId === 'string' && crewId.length > 0) {
        socket.join(`crew:${crewId}`);
      }
    });
    socket.on('crew:leave', ({ crewId } = {}) => {
      if (typeof crewId === 'string' && crewId.length > 0) {
        socket.leave(`crew:${crewId}`);
      }
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
