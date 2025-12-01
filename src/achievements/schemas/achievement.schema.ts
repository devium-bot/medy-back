import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type AchievementKey =
  | 'five_sessions'
  | 'perfect_run'
  | 'coop_winner'
  | 'exam_low_30_three'
  | 'exam_under_5';

@Schema({ timestamps: true, versionKey: false })
export class Achievement {
  @Prop({ type: Types.ObjectId, ref: User.name, index: true, required: true })
  user: Types.ObjectId;

  @Prop({ type: String, required: true })
  key: AchievementKey;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({ type: String, required: false })
  icon?: string;

  @Prop({ type: Object, default: {} })
  meta?: Record<string, any>;

  @Prop({ type: Date, default: Date.now })
  earnedAt?: Date;
}

export type AchievementDocument = HydratedDocument<Achievement>;

export const AchievementSchema = SchemaFactory.createForClass(Achievement);
AchievementSchema.index({ user: 1, key: 1 }, { unique: true });
