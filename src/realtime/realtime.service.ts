import { Injectable, Logger } from '@nestjs/common';
import { WebSocketServer } from '@nestjs/websockets';
import type { Server as WsServer } from 'ws';

type Socket = any; // ws WebSocket

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private userSockets = new Map<string, Set<Socket>>();
  private sessionSockets = new Map<string, Set<Socket>>();
  private allSockets = new Set<Socket>();
  private heartbeatTimer: any;

  @WebSocketServer()
  server: WsServer;

  constructor() {
    // Heartbeat: ping every 30s
    this.heartbeatTimer = setInterval(() => {
      this.allSockets.forEach((ws: any) => {
        try {
          if (ws.isAlive === false) {
            try { ws.terminate(); } catch {}
            this.allSockets.delete(ws);
            return;
          }
          ws.isAlive = false;
          ws.ping?.();
        } catch {}
      });
    }, 30000);
  }

  registerSocket(socket: any) {
    try {
      this.allSockets.add(socket);
      socket.isAlive = true;
      socket.on?.('pong', () => { socket.isAlive = true; });
    } catch {}
  }

  removeSocket(socket: any) {
    this.allSockets.delete(socket);
  }

  bindUser(userId: string, socket: Socket) {
    const set = this.userSockets.get(userId) ?? new Set<Socket>();
    set.add(socket);
    this.userSockets.set(userId, set);
  }

  unbindUser(userId: string, socket: Socket) {
    const set = this.userSockets.get(userId);
    if (!set) return;
    set.delete(socket);
    if (set.size === 0) this.userSockets.delete(userId);
  }

  joinSession(sessionId: string, socket: Socket) {
    const set = this.sessionSockets.get(sessionId) ?? new Set<Socket>();
    set.add(socket);
    this.sessionSockets.set(sessionId, set);
  }

  leaveSession(sessionId: string, socket: Socket) {
    const set = this.sessionSockets.get(sessionId);
    if (!set) return;
    set.delete(socket);
    if (set.size === 0) this.sessionSockets.delete(sessionId);
  }

  emitToUser(userId: string, event: string, payload: any) {
    const set = this.userSockets.get(userId);
    if (!set) return;
    const message = JSON.stringify({ event, data: payload });
    set.forEach((ws) => {
      try {
        ws.send(message);
      } catch (e) {
        this.logger.warn(`Send to user ${userId} failed: ${String(e)}`);
      }
    });
  }

  emitToSession(sessionId: string, event: string, payload: any) {
    const set = this.sessionSockets.get(sessionId);
    if (!set) return;
    const message = JSON.stringify({ event, data: payload });
    set.forEach((ws) => {
      try {
        ws.send(message);
      } catch (e) {
        this.logger.warn(`Send to session ${sessionId} failed: ${String(e)}`);
      }
    });
  }
}
