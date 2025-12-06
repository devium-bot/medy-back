import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SPECIALITIES, Speciality } from '../../common/specialities';

export type UserDocument = HydratedDocument<User>;

export type AuthProvider = 'email' | 'google' | 'phone';

export type UserRole = 'user' | 'admin';

@Schema({ timestamps: true })
export class Subscription {
  @Prop() paymentDate?: Date;
  @Prop() startDate?: Date;
  @Prop() endDate?: Date;
  @Prop({ default: 'expired' }) status?: 'active' | 'expired' | 'pending';
  @Prop({ default: 'free' }) plan?: 'free' | 'premium';
  @Prop({ default: 'manual' }) provider?: 'chargily' | 'iap' | 'manual';
  @Prop() lastPaymentRef?: string;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

@Schema()
export class Stats {
  @Prop({ default: null }) lastScore?: number;
  @Prop({ default: null }) bestScore?: number;
  @Prop({ default: 0 }) qcmAttempts?: number;
  @Prop({ default: null }) lastLogin?: Date;
  @Prop({ default: 0 }) totalScore?: number;
  @Prop({ default: 0 }) totalCorrect?: number;
  @Prop({ default: 0 }) totalWrong?: number;
  @Prop({ default: 0 }) totalSkipped?: number;
  @Prop({ default: 0 }) totalTimeSpent?: number;
  @Prop({ default: null }) lastActivityAt?: Date;
  @Prop({ default: 0 }) examLow30Count?: number;
}

export const StatsSchema = SchemaFactory.createForClass(Stats);

@Schema()
export class Favorites {
  @Prop({ type: [Types.ObjectId], default: [] }) questions: Types.ObjectId[];
}

export const FavoritesSchema = SchemaFactory.createForClass(Favorites);

@Schema({ collection: 'users' })
export class User {
  @Prop({ required: true, unique: true }) username: string;

  @Prop({ unique: true, sparse: true }) email?: string;
  @Prop() passwordHash?: string;

  @Prop({ default: false })
  isVerified?: boolean;

  @Prop({ select: false })
  verificationTokenHash?: string;

  @Prop({ type: Date, select: false })
  verificationTokenExpiresAt?: Date;

  @Prop({ type: Date })
  verifiedAt?: Date;

  @Prop({ unique: true, sparse: true }) phone?: string; // <-- ajout du champ phone

  @Prop() firstName?: string;
  @Prop() lastName?: string;
  @Prop({ default: null }) studyYear?: number;

  @Prop({ type: Date })
  studyYearUpdatedAt?: Date;

  @Prop({ default: null })
  deletedAt?: Date;

  @Prop({
    type: {
      email: { type: String },
      username: { type: String },
      reason: { type: String },
      note: { type: String },
      at: { type: Date },
    },
    default: null,
  })
  deletionMeta?: {
    email?: string;
    username?: string;
    reason?: string;
    note?: string;
    at?: Date;
  };

  @Prop({ default: 0 })
  tokenVersion?: number;

  @Prop({ type: String, enum: SPECIALITIES, default: null })
  speciality?: Speciality;

  @Prop({ default: true })
  showPublicStats?: boolean;

  @Prop({ default: true })
  showPublicAchievements?: boolean;

  @Prop({
    type: [String],
    enum: ['email', 'google', 'phone'],
    default: ['email'],
  })
  authProvider: AuthProvider[];

  @Prop({ type: String, enum: ['user', 'admin'], default: 'user' })
  role: UserRole;

  @Prop({ type: SubscriptionSchema, default: {} })
  subscription?: Subscription;

  @Prop({ type: FavoritesSchema, default: {} })
  favorites?: Favorites;

  @Prop({ type: StatsSchema, default: {} })
  stats?: Stats;

  @Prop() avatarUrl?: string;

  @Prop({ type: [String], default: [] })
  badges?: string[];

  @Prop({
    type: {
      dateISO: { type: String, default: () => new Date().toISOString().slice(0, 10) },
      sessionsUsed: { type: Number, default: 0 },
      questionsUsed: { type: Number, default: 0 },
      aiRequestsUsed: { type: Number, default: 0 },
    },
    default: {},
  })
  usageDaily?: {
    dateISO?: string;
    sessionsUsed?: number;
    questionsUsed?: number;
    aiRequestsUsed?: number;
  };

  @Prop({
    type: [
      {
        token: { type: String, required: true },
        deviceId: { type: String, required: false },
        platform: { type: String, required: false },
      },
    ],
    default: [],
  })
  pushTokens?: Array<{ token: string; deviceId?: string; platform?: string }>;

  @Prop({ default: Date.now }) createdAt?: Date;
  @Prop() updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
