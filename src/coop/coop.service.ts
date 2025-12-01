import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CoopSession,
  CoopSessionDocument,
} from './schemas/coop-session.schema';
import {
  Friendship,
  FriendshipDocument,
} from '../friends/schemas/friendship.schema';
import { UpdateFiltersDto } from './dto/update-filters.dto';
import { Question } from '../questions/schemas/question.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class CoopService {
  private readonly logger = new Logger(CoopService.name);
  constructor(
    @InjectModel(CoopSession.name)
    private readonly coopModel: Model<CoopSessionDocument>,
    @InjectModel(Friendship.name)
    private readonly friendshipModel: Model<FriendshipDocument>,
    private readonly notificationsService: NotificationsService,
    @InjectModel(Question.name)
    private readonly questionModel: Model<Question>,
    private readonly realtime: RealtimeService,
    private readonly usersService: UsersService,
    // achievements removed
  ) {}

  private toObjectId(value: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Identifiant utilisateur invalide');
    }
    return new Types.ObjectId(value);
  }

  private sanitize(session: CoopSessionDocument) {
    const readiness: Record<string, boolean> = {};
    session.readiness?.forEach((value, key) => {
      readiness[key] = value;
    });

    const results: Record<string, any> = {};
    session.results?.forEach((value, key) => {
      results[key] = value;
    });

    return {
      id: String(session._id),
      participants: session.participants.map((p) => String(p)),
      initiator: String(session.initiator),
      readiness,
      status: session.status,
      filters: session.filters ?? {},
      correctionMode: session.correctionMode ?? undefined,
      questionIds: (session.questionIds ?? []).map((q) => String(q)),
      seed: session.seed,
      level: session.level,
      results,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  private async ensureFriendship(a: Types.ObjectId, b: Types.ObjectId) {
    const friendship = await this.friendshipModel.findOne({
      $or: [
        { requester: a, recipient: b },
        { requester: b, recipient: a },
      ],
      status: 'accepted',
    });

    if (!friendship) {
      throw new BadRequestException(
        'Vous devez être ami avec cet utilisateur pour lancer une session coop.',
      );
    }
  }

  async createSession(initiatorId: string, friendId: string) {
    const initiator = this.toObjectId(initiatorId);
    const friend = this.toObjectId(friendId);

    if (initiator.equals(friend)) {
      throw new BadRequestException(
        'Impossible de démarrer une session coop avec vous-même.',
      );
    }

    await this.ensureFriendship(initiator, friend);

    // Enforce single active session per participant
    const activeForInitiator = await this.coopModel.findOne({
      participants: initiator,
      status: { $in: ['pending', 'ready', 'in_progress'] },
    });
    if (activeForInitiator) {
      throw new BadRequestException(
        "Vous avez déjà une session coop active. Terminez-la ou annulez-la avant d'en créer une autre.",
      );
    }
    const activeForFriend = await this.coopModel.findOne({
      participants: friend,
      status: { $in: ['pending', 'ready', 'in_progress'] },
    });
    if (activeForFriend) {
      throw new BadRequestException('Votre ami a déjà une session coop active.');
    }

    const existing = await this.coopModel.findOne({
      participants: { $all: [initiator, friend], $size: 2 },
      status: 'pending',
    });

    const readiness = new Map<string, boolean>();
    readiness.set(initiator.toHexString(), false);
    readiness.set(friend.toHexString(), false);

    if (existing) {
      existing.readiness = readiness;
      existing.status = 'pending';
      existing.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await existing.save();
      const payload = this.sanitize(existing);
      this.realtime.emitToSession(String(existing._id), 'coop.session.updated', { session: payload });
      return payload;
    }

    const created = await this.coopModel.create({
      participants: [initiator, friend],
      initiator,
      readiness,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    // Notify friend of coop invitation
    await this.notificationsService.emit(friend, 'coop_invite', {
      sessionId: String(created._id),
      byUserId: String(initiator),
    });
    const payload = this.sanitize(created);
    this.realtime.emitToSession(String(created._id), 'coop.session.updated', { session: payload });
    this.logger.log(`Session créée ${String(created._id)} par ${initiatorId} avec ${friendId}`);
    return payload;
  }

  async setFilters(sessionId: string, userId: string, dto: UpdateFiltersDto) {
    const session = await this.coopModel.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Session coop introuvable');
    }
    const userObjectId = this.toObjectId(userId);
    if (!session.participants.some((p) => p.equals(userObjectId))) {
      throw new BadRequestException('Vous ne participez pas à cette session coop.');
    }
    // Only initiator can set filters/level
    if (!session.initiator.equals(userObjectId)) {
      throw new BadRequestException("Seul l'initiateur peut définir les filtres.");
    }
    if (session.status === 'in_progress') {
      throw new BadRequestException('La session a déjà démarré.');
    }
    const initiator = await this.usersService.findById(String(session.initiator));
    const safeFilters = dto.filters ?? session.filters ?? {};
    if (!safeFilters.speciality && initiator?.speciality) {
      (safeFilters as any).speciality = initiator.speciality;
    }
    if (
      (safeFilters as any).studyYear === undefined ||
      (safeFilters as any).studyYear === null
    ) {
      if (typeof initiator?.studyYear === 'number') {
        (safeFilters as any).studyYear = initiator.studyYear;
      }
    }
    session.filters = safeFilters;
    session.correctionMode = dto.correctionMode ?? session.correctionMode;
    session.level = dto.level ?? session.level;
    // store a count in filters meta if provided
    if (typeof dto.count === 'number') {
      (session.filters as any).__count = dto.count;
    }
    session.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await session.save();
    const payload = this.sanitize(session);
    this.realtime.emitToSession(String(session._id), 'coop.readiness.updated', { session: payload });
    return payload;
  }

  private buildQuestionQuery(filters: any) {
    const query: any = {};
    const safe = filters || {};
    const arrToObjectIds = (arr?: string[]) =>
      Array.isArray(arr)
        ? arr.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id))
        : undefined;
    const unites = arrToObjectIds(safe.unitIds);
    const modules = arrToObjectIds(safe.moduleIds);
    const courses = arrToObjectIds(safe.courseIds);
    if (unites?.length) query.unite = { $in: unites };
    if (modules?.length) query.module = { $in: modules };
    if (courses?.length) query.cours = { $in: courses };
    if (typeof safe.studyYear === 'number') query.year = safe.studyYear;
    if (safe.speciality) query.speciality = String(safe.speciality).toLowerCase();
    if (safe.university) query.university = String(safe.university).trim();
    return query;
  }

  async launchSession(sessionId: string, userId: string) {
    const session = await this.coopModel.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Session coop introuvable');
    }
    const userObjectId = this.toObjectId(userId);
    if (!session.participants.some((p) => p.equals(userObjectId))) {
      throw new BadRequestException('Vous ne participez pas à cette session coop.');
    }
    if (session.status === 'in_progress' && (session.questionIds?.length ?? 0) > 0) {
      const docs = await this.questionModel
        .find({ _id: { $in: session.questionIds } })
        .populate('unite', 'nom')
        .populate('module', 'nom')
        .populate('cours', 'nom')
        .lean();
      return { session: this.sanitize(session), questions: docs };
    }
    // optional readiness check: both true
    const readiness = session.readiness ?? new Map<string, boolean>();
    const everyReady = session.participants.every((p) => readiness.get(p.toHexString()));
    if (!everyReady) {
      throw new BadRequestException("Tous les participants doivent être prêts pour démarrer.");
    }

    const countFromFilters = Number((session.filters as any)?.__count || 0);
    const levelCount =
      session.level === 'moyen' ? 60 : session.level === 'difficile' ? 90 : 40;
    const count = Number.isFinite(countFromFilters) && countFromFilters > 0 ? countFromFilters : levelCount;
    const query = this.buildQuestionQuery(session.filters || {});
    const picked = await this.questionModel.aggregate([{ $match: query }, { $sample: { size: count } }]);
    const ids = picked.map((d: any) => d._id);
    if (ids.length === 0) {
      throw new BadRequestException('Aucun QCM disponible pour ces filtres (spécialité/année).');
    }
    session.questionIds = ids;
    session.status = 'in_progress';
    session.seed = session.seed || new Types.ObjectId().toHexString();
    session.expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
    await session.save();

    const populated = await this.questionModel
      .find({ _id: { $in: ids } })
      .populate('unite', 'nom')
      .populate('module', 'nom')
      .populate('cours', 'nom')
      .lean();

    const sanitized = this.sanitize(session);
    const payload = { session: sanitized, questions: populated };
    this.realtime.emitToSession(String(session._id), 'coop.session.launched', payload);
    this.logger.log(`Session ${String(session._id)} lancée (${ids.length} questions).`);
    return payload;
  }

  async submitResult(
    sessionId: string,
    userId: string,
    body: { score: number; total: number; durationMs?: number },
  ) {
    const session = await this.coopModel.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Session coop introuvable');
    }
    const userObjectId = this.toObjectId(userId);
    if (!session.participants.some((p) => p.equals(userObjectId))) {
      throw new BadRequestException('Vous ne participez pas à cette session coop.');
    }
    if (session.status !== 'in_progress') {
      throw new BadRequestException("La session n'est pas en cours.");
    }
    const key = userObjectId.toHexString();
    const existing = session.results ?? new Map<string, any>();
    existing.set(key, {
      score: Number(body.score) || 0,
      total: Number(body.total) || 0,
      durationMs: typeof body.durationMs === 'number' ? body.durationMs : undefined,
      completedAt: new Date(),
    });
    session.results = existing;
    await session.save();
    const payload = this.sanitize(session);
    this.realtime.emitToSession(String(session._id), 'coop.result.updated', { session: payload });
    // Shorten TTL if both results present and award winner
    const both = session.participants.every((p) => session.results?.has(p.toHexString()));
    if (both) {
      // Determine winner: highest score, then shortest duration
      const a = session.participants[0].toHexString();
      const b = session.participants[1].toHexString();
      const ra: any = session.results?.get(a) || { score: 0 };
      const rb: any = session.results?.get(b) || { score: 0 };
      let winner: string | null = null;
      if ((ra.score || 0) > (rb.score || 0)) winner = a;
      else if ((rb.score || 0) > (ra.score || 0)) winner = b;
      else {
        const da = typeof ra.durationMs === 'number' ? ra.durationMs : Number.MAX_SAFE_INTEGER;
        const db = typeof rb.durationMs === 'number' ? rb.durationMs : Number.MAX_SAFE_INTEGER;
        if (da < db) winner = a;
        else if (db < da) winner = b;
      }
      // achievements removed: no winner processing
      session.expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await session.save();
      this.logger.log(`Session ${String(session._id)} résultats complets (TTL 1h).`);
    }
    return payload;
  }

  async getSession(sessionId: string, userId: string) {
    const objectId = this.toObjectId(sessionId);
    const userObjectId = this.toObjectId(userId);

    const session = await this.coopModel.findById(objectId);
    if (!session) {
      throw new NotFoundException('Session coop introuvable');
    }

    if (
      !session.participants.some((participant) =>
        participant.equals(userObjectId),
      )
    ) {
      throw new BadRequestException(
        'Vous ne participez pas à cette session coop.',
      );
    }

    // mark expired if window passed
    if ((session.status === 'pending' || session.status === 'ready') && session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
      session.status = 'expired';
      await session.save();
    }
    return this.sanitize(session);
  }

  async setReady(sessionId: string, userId: string, ready: boolean) {
    const session = await this.coopModel.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Session coop introuvable');
    }

    const userObjectId = this.toObjectId(userId);

    if (
      !session.participants.some((participant) =>
        participant.equals(userObjectId),
      )
    ) {
      throw new BadRequestException(
        'Vous ne participez pas à cette session coop.',
      );
    }

    const readiness = session.readiness ?? new Map<string, boolean>();
    readiness.set(userObjectId.toHexString(), ready);
    session.readiness = readiness;

    const everyReady = session.participants.every((participant) =>
      readiness.get(participant.toHexString()),
    );
    session.status = everyReady ? 'ready' : 'pending';
    session.expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await session.save();
    const payload = this.sanitize(session);
    this.realtime.emitToSession(String(session._id), 'coop.readiness.updated', { session: payload });
    return payload;
  }

  async cancelSession(sessionId: string, userId: string) {
    const session = await this.coopModel.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Session coop introuvable');
    }

    const userObjectId = this.toObjectId(userId);
    if (
      !session.participants.some((participant) =>
        participant.equals(userObjectId),
      )
    ) {
      throw new BadRequestException(
        'Vous ne participez pas à cette session coop.',
      );
    }

    const sessionIdStr = String(session._id);
    session.status = 'cancelled';
    session.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await session.save();
    this.realtime.emitToSession(sessionIdStr, 'coop.session.cancelled', { sessionId: sessionIdStr });
    return { success: true };
  }
}
