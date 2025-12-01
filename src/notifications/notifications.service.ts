import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument, NotificationType } from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
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
}

