import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Model } from 'mongoose';
import { UpdateUserDto } from './dto/update-user.dto';
import { Types } from 'mongoose';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  private static readonly STUDY_YEAR_COOLDOWN_MONTHS = 8;

  async findById(id: string) {
    const user = await this.userModel.findById(id).select('-passwordHash');
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findPublicProfile(id: string) {
    const user = await this.userModel
      .findById(id)
      .select(
        'username firstName lastName studyYear speciality avatarUrl badges stats createdAt showPublicStats showPublicAchievements',
      )
      .lean();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    return this.userModel.findOne({ email: normalized }).select('-passwordHash');
  }

  async updateProfile(id: string, dto: UpdateUserDto) {
    const user = await this.userModel.findById(id).select('-passwordHash');
    if (!user) throw new NotFoundException('User not found');

    if (dto.username && dto.username !== user.username) {
      const exists = await this.userModel.findOne({
        username: dto.username,
        _id: { $ne: id },
      });
      if (exists) throw new ConflictException('Username already taken');
    }

    const update: any = { ...dto };

    if (typeof dto.studyYear === 'number' && dto.studyYear !== user.studyYear) {
      const now = new Date();
      const hasExistingYear = user.studyYear !== null && user.studyYear !== undefined;

      if (hasExistingYear) {
        const lastChange = user.studyYearUpdatedAt;
        if (lastChange) {
          const diffMonths =
            (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24 * 30);
          if (diffMonths < UsersService.STUDY_YEAR_COOLDOWN_MONTHS) {
            throw new ConflictException(
              `Modification de l'année d'étude autorisée après ${UsersService.STUDY_YEAR_COOLDOWN_MONTHS} mois.`,
            );
          }
        }
        // Either no previous timestamp (legacy accounts) or cooldown satisfied -> set new timestamp
        update.studyYearUpdatedAt = now;
      }
      // If no existing year (première configuration), we accept without starting the cooldown clock.
    }

    const updated = await this.userModel
      .findByIdAndUpdate(id, { $set: update }, { new: true })
      .select('-passwordHash');
    return updated;
  }

  async setSubscription(userId: string, paymentDate: Date, months = 1) {
    // Admin helper: activate premium from now for N months
    return this.applySubscription(userId, {
      months,
      paidAt: paymentDate,
      provider: 'manual',
      paymentRef: undefined,
    });
  }

  async applySubscription(
    userId: string,
    opts: { months: number; paidAt: Date; provider: 'chargily' | 'iap' | 'manual'; paymentRef?: string },
  ) {
    const user = await this.userModel.findById(userId).select('subscription');
    if (!user) throw new NotFoundException('User not found');

    const now = opts.paidAt ?? new Date();
    const sub = (user.subscription || {}) as any;
    const hasActive = sub?.status === 'active' && sub?.endDate && new Date(sub.endDate).getTime() > Date.now();
    const effectiveStart = hasActive ? new Date(sub.endDate) : now;
    const newEnd = new Date(effectiveStart);
    newEnd.setMonth(newEnd.getMonth() + Math.max(1, opts.months));

    const updated = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          'subscription.paymentDate': now,
          'subscription.startDate': effectiveStart,
          'subscription.endDate': newEnd,
          'subscription.status': 'active',
          'subscription.plan': 'premium',
          'subscription.provider': opts.provider,
          'subscription.lastPaymentRef': opts.paymentRef,
        },
        { new: true },
      )
      .select('-passwordHash');
    return updated;
  }

  async findByPhone(phone: string) {
    return this.userModel.findOne({ phone }).select('-passwordHash');
  }

  async searchUsers(term: string, limit = 10) {
    if (!term || !term.trim()) return [];
    const sanitized = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(sanitized, 'i');
    return this.userModel
      .find({
        $or: [
          { username: regex },
          { email: regex },
          { firstName: regex },
          { lastName: regex },
        ],
      })
      .limit(Math.min(Math.max(limit, 1), 25))
      .select('username firstName lastName email')
      .lean();
  }

  async createByPhone(phone: string) {
    const digits = (phone ?? '').replace(/\D/g, '');
    const fallback = Math.floor(1000 + Math.random() * 9000).toString();
    const suffix = digits.slice(-4) || fallback;
    const username = await this.generateUniqueUsername(`user_${suffix}`);

    const user = new this.userModel({
      phone,
      username,
      authProvider: ['phone'],
      isVerified: true,
      verifiedAt: new Date(),
    });
    await user.save();
    return user;
  }

  async createByGoogle(email: string, firstName?: string, lastName?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const base = normalizedEmail.split('@')[0];
    const username = await this.generateUniqueUsername(base);
    const user = new this.userModel({
      email: normalizedEmail,
      username,
      firstName,
      lastName,
      isVerified: true,
      verifiedAt: new Date(),
      authProvider: ['google'],
    });
    await user.save();
    return user;
  }

  async linkGoogleAccount(userId: string) {
    // si l'utilisateur avait déjà un compte email/phone, on ajoute 'google' comme provider
    return this.userModel.findByIdAndUpdate(
      userId,
      { $addToSet: { authProvider: 'google' } },
      { new: true },
    );
  }

  private async generateUniqueUsername(base: string) {
    const safeBase =
      base && base.trim().length > 0 ? base.trim() : `user_${Date.now()}`;
    let candidate = safeBase;
    let suffix = 0;
    // Loop with small bound to avoid infinite in extreme cases
    while (await this.userModel.exists({ username: candidate })) {
      suffix += 1;
      candidate = `${safeBase}${suffix}`;
    }
    return candidate;
  }

  async updateStatsAfterAttempt(
    userId: string,
    payload: {
      score?: number;
      correct?: number;
      wrong?: number;
      skipped?: number;
      timeSpent?: number;
    },
  ) {
    const user = await this.userModel.findById(userId).select('stats');
    if (!user) return null;

    const score = payload.score ?? 0;
    const correct = payload.correct ?? 0;
    const wrong = payload.wrong ?? 0;
    const skipped = payload.skipped ?? 0;
    const timeSpent = payload.timeSpent ?? 0;

    const update: any = {
      $inc: {
        'stats.qcmAttempts': 1,
        'stats.totalScore': score,
        'stats.totalCorrect': correct,
        'stats.totalWrong': wrong,
        'stats.totalSkipped': skipped,
        'stats.totalTimeSpent': timeSpent,
      },
      $set: {
        'stats.lastScore': score,
        'stats.lastActivityAt': new Date(),
      },
    };

    const currentBest = user.stats?.bestScore ?? null;
    if (currentBest === null || (score ?? 0) > currentBest) {
      update.$set['stats.bestScore'] = score;
    }

    const updated = await this.userModel
      .findByIdAndUpdate(userId, update, { new: true })
      .select('-passwordHash');

    return updated?.stats ?? null;
  }

  async addFavoriteQuestion(userId: string, questionId: string) {
    if (!Types.ObjectId.isValid(questionId)) {
      throw new Error('Invalid question id');
    }
    const updated = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $addToSet: { 'favorites.questions': new Types.ObjectId(questionId) } },
        { new: true },
      )
      .select('-passwordHash');
    return updated?.favorites ?? { questions: [] };
  }

  async removeFavoriteQuestion(userId: string, questionId: string) {
    if (!Types.ObjectId.isValid(questionId)) {
      throw new Error('Invalid question id');
    }
    const updated = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $pull: { 'favorites.questions': new Types.ObjectId(questionId) } },
        { new: true },
      )
      .select('-passwordHash');
    return updated?.favorites ?? { questions: [] };
  }
}
