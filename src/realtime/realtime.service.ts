import { Injectable, Logger } from '@nestjs/common';
import { WebSocketServer } from '@nestjs/websockets';
import type { Server as WsServer } from 'ws';

type Socket = any; // ws WebSocket
type Payload = Record<string, any>;

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private userSockets = new Map<string, Set<Socket>>();
  private sessionSockets = new Map<string, Set<Socket>>();
  private allSockets = new Set<Socket>();
  private heartbeatTimer: any;
  private lastEmitMap = new Map<string, number>(); // throttle by sessionId+event

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

  // ✅ payload standard + retry simple
  emitToUsersWithRetry(userIds: string[], event: string, payload: Payload, attempts = 3) {
    const ts = new Date().toISOString();
    const envelope = (sessionId?: string) =>
      JSON.stringify({ event, sessionId, ts, data: payload });
    userIds.forEach((uid) => {
      const set = this.userSockets.get(uid);
      if (!set) return;
      set.forEach((ws) => {
        let tries = 0;
        const send = () => {
          tries += 1;
          try {
            ws.send(envelope((payload as any)?.sessionId), (err?: any) => {
              if (err && tries < attempts) {
                setTimeout(send, Math.pow(2, tries - 1) * 500);
              } else if (err) {
                this.logger.warn(`WS send failed after retries user=${uid} event=${event}: ${String(err)}`);
              }
            });
          } catch (e) {
            if (tries < attempts) setTimeout(send, Math.pow(2, tries - 1) * 500);
            else this.logger.warn(`WS send failed user=${uid} event=${event}: ${String(e)}`);
          }
        };
        send();
      });
    });
  }

  emitSessionEvent(sessionId: string, userIds: string[], event: string, data: Payload = {}) {
    const throttleKey = `${sessionId}:${event}`;
    const last = this.lastEmitMap.get(throttleKey) ?? 0;
    if (Date.now() - last < 10_000) return;
    this.lastEmitMap.set(throttleKey, Date.now());
    const payload = { ...data, sessionId };
    this.emitToUsersWithRetry(userIds, event, payload);
  }

  isUserOnline(userId: string) {
    return (this.userSockets.get(userId)?.size || 0) > 0;
  }

  onModuleDestroy() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.allSockets.forEach((ws) => {
      try {
        ws.removeAllListeners?.();
        ws.terminate?.();
      } catch {}
    });
    this.allSockets.clear();
    this.userSockets.clear();
    this.sessionSockets.clear();
  }
}
