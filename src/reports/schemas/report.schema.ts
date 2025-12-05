import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReportDocument = HydratedDocument<Report>;

export type ReportType = 'question' | 'feature' | 'other';
export type ReportStatus = 'open' | 'in_progress' | 'closed';

@Schema({ collection: 'reports', timestamps: true })
export class Report {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: ['question', 'feature', 'other'], required: true })
  type: ReportType;

  @Prop({ type: String, enum: ['open', 'in_progress', 'closed'], default: 'open' })
  status?: ReportStatus;

  @Prop({ type: String, required: true })
  message: string;

  @Prop({ type: Types.ObjectId, ref: 'Question', default: null })
  questionId?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  screen?: string | null;

  @Prop({ type: Object, default: null })
  context?: Record<string, any> | null;

  @Prop({ type: String, default: null })
  screenshotUrl?: string | null;

  @Prop({ type: String, default: null })
  internalNote?: string | null;

  @Prop() createdAt?: Date;
  @Prop() updatedAt?: Date;
}

export const ReportSchema = SchemaFactory.createForClass(Report);
