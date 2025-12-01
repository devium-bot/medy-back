import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { RealtimeService } from './realtime.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CoopSession, CoopSessionDocument } from '../coop/schemas/coop-session.schema';

@WebSocketGateway({ path: '/ws', cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly jwtService: JwtService,
    private readonly realtime: RealtimeService,
    @InjectModel(CoopSession.name) private readonly coopModel: Model<CoopSessionDocument>,
  ) {}

  async handleConnection(client: any, ...args: any[]) {
    try {
      const req = args?.[0];
      const url: string = req?.url || '';
      const token = this.extractToken(url, req?.headers);
      if (!token) throw new Error('Missing token');
      const payload: any = this.jwtService.verify(token);
      const userId = String(payload?.sub || payload?._id || payload?.id);
      if (!userId) throw new Error('Invalid token payload');
      client.userId = userId;
      this.realtime.bindUser(userId, client);
      this.realtime.registerSocket(client);
    } catch {
      try { client.close(); } catch {}
    }
  }

  handleDisconnect(client: any) {
    const userId = client?.userId;
    if (userId) this.realtime.unbindUser(userId, client);
    this.realtime.removeSocket(client);
  }

  private extractToken(url: string, headers?: any) {
    // Prefer subprotocol header (Sec-WebSocket-Protocol)
    const proto = headers?.['sec-websocket-protocol'];
    if (typeof proto === 'string' && proto.trim()) {
      const first = String(proto.split(',')[0] || '').trim();
      if (first) return first;
    }
    const qIndex = url.indexOf('?');
    if (qIndex === -1) return null;
    const search = new URLSearchParams(url.slice(qIndex + 1));
    return search.get('token');
  }

  @SubscribeMessage('coop.join')
  async onJoin(@ConnectedSocket() client: any, @MessageBody() body: { sessionId: string }) {
    const sessionId = body?.sessionId;
    if (!Types.ObjectId.isValid(sessionId)) return { event: 'error', data: 'Invalid sessionId' };
    const session = await this.coopModel.findById(sessionId);
    if (!session) return { event: 'error', data: 'Session not found' };
    const userId = new Types.ObjectId(client.userId);
    const isParticipant = session.participants.some((p) => p.equals(userId));
    if (!isParticipant) return { event: 'error', data: 'Not a participant' };
    this.realtime.joinSession(String(session._id), client);
    // No direct return channel with ws adapter; push a message to the socket
    try {
      client.send(JSON.stringify({ event: 'coop.joined', data: { sessionId: String(session._id) } }));
    } catch {}
    return;
  }
}
