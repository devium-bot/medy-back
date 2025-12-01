import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TransactionDocument = HydratedDocument<Transaction>;

@Schema({ timestamps: true, collection: 'billing_transactions' })
export class Transaction {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true, required: true })
  user!: Types.ObjectId;

  @Prop({ type: String, enum: ['chargily', 'iap', 'manual'], index: true })
  provider!: 'chargily' | 'iap' | 'manual';

  @Prop({ type: String, index: true })
  orderId?: string; // provider order/reference id

  @Prop({ type: Number })
  amount!: number; // in DZD

  @Prop({ type: String, default: 'DZD' })
  currency!: string;

  @Prop({ type: String, enum: ['pending', 'paid', 'failed', 'expired', 'refunded'], index: true, default: 'pending' })
  status!: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

  @Prop({ type: Date })
  paidAt?: Date;

  @Prop({ type: Object })
  payload?: Record<string, any>; // raw webhook/response snapshot
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
TransactionSchema.index({ provider: 1, orderId: 1 }, { unique: true, sparse: true });

