import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { CoopSession } from './coop-session.schema';
import { Question } from '../../questions/schemas/question.schema';

@Schema({ timestamps: true, versionKey: false })
export class CoopAnswer {
  @Prop({ type: Types.ObjectId, ref: CoopSession.name, required: true })
  sessionId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Question.name, required: true })
  questionId!: Types.ObjectId;

  @Prop({ type: [Number], default: [] })
  selectedOptions!: number[];

  @Prop({ type: Boolean, default: false })
  isCorrect!: boolean;

  @Prop({ type: Date, required: true })
  submittedAt!: Date;

  @Prop({ type: Number, required: false })
  clientDuration?: number;
}

export type CoopAnswerDocument = CoopAnswer & Document;

export const CoopAnswerSchema = SchemaFactory.createForClass(CoopAnswer);

CoopAnswerSchema.index({ sessionId: 1, userId: 1 });
