import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'

let io: SocketIOServer | null = null

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.IO not initialized. Call initSocketIO first.')
  return io
}

export function initSocketIO(httpServer: HTTPServer): SocketIOServer {
  if (io) return io
  io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  })
  return io
}
