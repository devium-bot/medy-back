import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'coop_invite'
  | 'coop_ready'
  | 'generic';

@Schema({ timestamps: { createdAt: true, updatedAt: false }, versionKey: false })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  recipient: Types.ObjectId;

  @Prop({ type: String, required: true })
  type: NotificationType;

  @Prop({ type: Object, default: {} })
  payload: Record<string, any>;

  @Prop({ type: Boolean, default: false })
  read: boolean;
}

export type NotificationDocument = HydratedDocument<Notification>;

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, createdAt: -1 });

