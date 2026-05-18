import { io } from 'socket.io-client';
import { getToken } from './api.js';

let socket = null;

function connectSocket() {
  if (socket) return socket;

  const token = getToken();
  socket = io('/', {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('Socket connected');
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  return socket;
}

function getSocket() {
  return socket;
}

function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export { connectSocket, getSocket, disconnectSocket };
