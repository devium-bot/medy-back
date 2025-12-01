import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Question } from '../../questions/schemas/question.schema';

@Schema({ timestamps: true, versionKey: false })
export class CoopSession {
  @Prop({
    type: [{ type: Types.ObjectId, ref: User.name }],
    required: true,
    validate: {
      validator: (value: Types.ObjectId[]) =>
        Array.isArray(value) && value.length === 2,
      message: 'Une session coop nécessite exactement deux participants.',
    },
  })
  participants: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  initiator: Types.ObjectId;

  @Prop({ type: Map, of: Boolean, default: {} })
  readiness: Map<string, boolean>;

  @Prop({ default: 'pending', enum: ['pending', 'ready', 'in_progress', 'cancelled', 'expired'] })
  status: 'pending' | 'ready' | 'in_progress' | 'cancelled' | 'expired';

  @Prop({ type: Object, default: {} })
  filters?: Record<string, any>;

  @Prop({ type: String, enum: ['positive', 'standard', 'binary'], required: false })
  correctionMode?: 'positive' | 'standard' | 'binary';

  @Prop({ type: [Types.ObjectId], ref: Question.name, default: [] })
  questionIds?: Types.ObjectId[];

  @Prop({ type: String, required: false })
  seed?: string;

  @Prop({ type: String, enum: ['facile', 'moyen', 'difficile'], required: false })
  level?: 'facile' | 'moyen' | 'difficile';

  @Prop({
    type: Map,
    of: new MongooseSchema(
      {
        score: { type: Number, required: true },
        total: { type: Number, required: true },
        durationMs: { type: Number, required: false },
        completedAt: { type: Date, required: false },
      },
      { _id: false },
    ),
    default: {},
  })
  results?: Map<string, { score: number; total: number; durationMs?: number; completedAt?: Date }>;

  @Prop({ type: Date, required: false, index: { expireAfterSeconds: 0 } })
  expiresAt?: Date;
}

export type CoopSessionDocument = CoopSession &
  Document & {
    createdAt: Date;
    updatedAt: Date;
  };

export const CoopSessionSchema = SchemaFactory.createForClass(CoopSession);

CoopSessionSchema.index({ participants: 1 });
CoopSessionSchema.index({ participants: 1, status: 1 });
