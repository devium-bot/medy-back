import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OtpEntryDocument = HydratedDocument<OtpEntry>;

@Schema({ collection: 'otps', timestamps: true })
export class OtpEntry {
  @Prop({ required: true, unique: true })
  phone: string;

  @Prop({ required: true })
  codeHash: string;

  @Prop({ required: true, type: Date })
  expiresAt: Date;

  @Prop({ required: true, type: Date })
  lastSentAt: Date;

  @Prop({ default: 0 })
  attempts: number;
}

export const OtpEntrySchema = SchemaFactory.createForClass(OtpEntry);
