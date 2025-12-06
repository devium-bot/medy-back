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
    const tokens = (user?.pushTokens ?? []).filter((t) => t?.token);
    if (!tokens.length) return { skipped: true, reason: 'no_tokens' };
    // Placeholder push: log and pretend success; integrate with Expo/Firebase later
    this.logger.log(`Push -> user=${userId} title="${title}" tokens=${tokens.length}`);
    return { sent: tokens.length };
  }
}
