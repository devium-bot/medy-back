import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument, NotificationType } from './schemas/notification.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly realtime: RealtimeService,
  ) {}

  async emit(
    recipient: Types.ObjectId,
    type: NotificationType,
    payload: Record<string, any> = {},
  ) {
    const doc = await this.notificationModel.create({ recipient, type, payload, read: false });
    return doc.toObject();
  }

  async list(recipientId: string, onlyUnread = false) {
    const recipient = new Types.ObjectId(recipientId);
    const filter: any = { recipient };
    if (onlyUnread) filter.read = false;
    return this.notificationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .lean();
  }

  async markRead(recipientId: string, id: string) {
    const recipient = new Types.ObjectId(recipientId);
    const _id = new Types.ObjectId(id);
    const updated = await this.notificationModel.findOneAndUpdate(
      { _id, recipient },
      { $set: { read: true } },
      { new: true },
    );
    return updated?.toObject();
  }

  async markAllRead(recipientId: string) {
    const recipient = new Types.ObjectId(recipientId);
    await this.notificationModel.updateMany({ recipient, read: false }, { $set: { read: true } });
    return { success: true };
  }

  async sendPushToUser(userId: string, title: string, body: string, data: Record<string, any> = {}) {
    if (this.realtime.isUserOnline(userId)) {
      return { skipped: true, reason: 'online' };
    }
    const user = await this.userModel.findById(userId).select('pushTokens username').lean();
    const tokens = (user?.pushTokens ?? []).filter((t) => t?.token).map((t) => t.token);
    const expoTokens = tokens.filter((token) => this.isExpoPushToken(token));
    if (!expoTokens.length) return { skipped: true, reason: 'no_tokens' };

    const messages = expoTokens.map((to) => ({
      to,
      title,
      body,
      data,
      sound: 'default',
    }));
    const chunks = this.chunkMessages(messages, 100);
    let sent = 0;
    let failed = 0;

    for (const chunk of chunks) {
      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chunk),
        });
        const payload = await res.json().catch(() => ({}));
        const results = Array.isArray(payload?.data) ? payload.data : [];
        results.forEach((r: any) => {
          if (r?.status === 'ok') sent += 1;
          else failed += 1;
        });
      } catch (err) {
        failed += chunk.length;
        this.logger.warn(`Push send failed user=${userId} err=${String(err)}`);
      }
    }

    return { sent, failed };
  }

  private isExpoPushToken(token: string) {
    return (
      typeof token === 'string' &&
      /^(ExpoPushToken|ExponentPushToken)\[[^\]]+\]$/.test(token)
    );
  }

  private chunkMessages<T>(items: T[], size: number) {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  }
}
