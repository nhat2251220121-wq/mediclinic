import { io } from 'socket.io-client';

// Kết nối Socket.IO tới Backend server
const SOCKET_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace('/api', '')
  : 'http://localhost:5000';

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling']
});
