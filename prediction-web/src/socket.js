import { io } from 'socket.io-client';
import { supabase } from './lib/supabase.js';

let socket = null;

async function connectSocket() {
  if (socket) return socket;

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || null;

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
