import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
  ConflictException,
  OnModuleDestroy,
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
import { SubmitAnswersDto } from './dto/submit-answers.dto';
import { CoopAnswer, CoopAnswerDocument } from './schemas/coop-answer.schema';

@Injectable()
export class CoopService {
  private readonly logger = new Logger(CoopService.name);
  private static readonly MIN_COUNT = 5;
  private static readonly MAX_COUNT = 50;
  private static readonly PENALTY_WRONG = 0.25;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private questionCache = new Map<string, { expiresAt: number; ids: Types.ObjectId[] }>();
  constructor(
    @InjectModel(CoopSession.name)
    private readonly coopModel: Model<CoopSessionDocument>,
    @InjectModel(Friendship.name)
    private readonly friendshipModel: Model<FriendshipDocument>,
    private readonly notificationsService: NotificationsService,
    @InjectModel(Question.name)
    private readonly questionModel: Model<Question>,
    @InjectModel(CoopAnswer.name)
    private readonly coopAnswerModel: Model<CoopAnswerDocument>,
    private readonly realtime: RealtimeService,
    private readonly usersService: UsersService,
    // achievements removed
  ) {
    // Simple cleanup job for abandoned in_progress sessions (every minute)
    this.cleanupTimer = setInterval(() => {
      this.expireAbandonedSessions().catch((e) =>
        this.logger.warn(`cleanup in_progress failed: ${String(e)}`),
      );
    }, 60 * 1000);
    (this.cleanupTimer as any)?.unref?.();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

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
      startedAt: session.startedAt,
      serverDuration: session.serverDuration,
      submittedBy: (session.submittedBy ?? []).map((id: any) => String(id)),
      winner: session.winner ? String(session.winner) : undefined,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  private async expireAbandonedSessions() {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000);
    const sessions = await this.coopModel.find({
      status: 'in_progress',
      updatedAt: { $lt: cutoff },
    });
    for (const s of sessions) {
      try {
        const resultsCount = s.results?.size ?? 0;
        let winner: Types.ObjectId | null = null;
        if (resultsCount === 1) {
          const only = Array.from(s.results!.keys())[0];
          winner = new Types.ObjectId(only);
        }
        s.status = 'expired';
        s.winner = winner;
        await s.save();
        const payload = this.sanitize(s);
        this.realtime.emitSessionEvent(String(s._id), payload.participants, 'coop:opponent_abandoned', {
          session: payload,
        });
        for (const pid of payload.participants) {
          if (!this.realtime.isUserOnline(pid)) {
            await this.notificationsService.sendPushToUser(pid, '⚠️ Session expirée', 'Votre adversaire a quitté.', {
              sessionId: String(s._id),
              type: 'coop_abandoned',
            });
          }
        }
      } catch (e) {
        this.logger.warn(`expireAbandonedSessions error ${String(e)}`);
      }
    }
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
    const invitePayload = {
      sessionId: String(created._id),
      byUserId: String(initiator),
      ts: new Date().toISOString(),
    };
    await this.notificationsService.emit(friend, 'coop_invite', invitePayload);
    this.realtime.emitSessionEvent(String(created._id), [friend.toHexString()], 'coop:invite_received', invitePayload);
    // push offline
    await this.notificationsService.sendPushToUser(friend.toHexString(), '👥 Nouveau défi', 'Un ami vous invite en coop', {
      sessionId: String(created._id),
      type: 'coop_invite',
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
      const bounded = Math.max(
        CoopService.MIN_COUNT,
        Math.min(CoopService.MAX_COUNT, Math.trunc(dto.count)),
      );
      (session.filters as any).__count = bounded;
    }
    session.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await session.save();
    const payload = this.sanitize(session);
    this.realtime.emitSessionEvent(String(session._id), payload.participants, 'coop:session_ready', { session: payload });
    // push offline au partenaire
    const other = payload.participants.find((p) => p !== userId);
    if (other) {
      await this.notificationsService.emit(new Types.ObjectId(other), 'coop_ready', {
        sessionId: String(session._id),
      });
      await this.notificationsService.sendPushToUser(other, '🎮 Session prête', 'Votre coop peut démarrer.', {
        sessionId: String(session._id),
        type: 'coop_ready',
      });
    }
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

  private cacheKey(query: any, count: number) {
    return JSON.stringify({ query, count });
  }

  private async getSampledQuestionIds(query: any, count: number) {
    if (count > CoopService.MAX_COUNT) {
      throw new BadRequestException('Max 50 questions autorisées en coop.');
    }
    const key = this.cacheKey(query, count);
    const cached = this.questionCache.get(key);
    if (cached && cached.expiresAt > Date.now() && cached.ids.length >= count) {
      return cached.ids.slice(0, count);
    }
    const picked = await this.questionModel.aggregate([{ $match: query }, { $sample: { size: count } }]);
    const ids = picked.map((d: any) => d._id);
    this.questionCache.set(key, { expiresAt: Date.now() + 60 * 1000, ids });
    return ids;
  }

  // ✅ [POINT 2] Déduplication + normalisation
  private normalizeAnswers(dto: SubmitAnswersDto) {
    const map = new Map<string, number[]>();
    for (const entry of dto.answers || []) {
      const qId = String(entry.questionId);
      if (!qId) continue;
      const unique = new Set<number>();
      (entry.selectedOptionIndexes || []).forEach((v) => {
        const n = Math.trunc(Number(v));
        if (Number.isFinite(n)) unique.add(n);
      });
      map.set(qId, Array.from(unique));
    }
    return map;
  }

  private computeScorePerQuestion(
    question: any,
    selectedIndexes: number[] | undefined,
    mode: 'positive' | 'standard' | 'binary' | undefined,
  ): { score: number; status: 'correct' | 'partial' | 'wrong' } {
    const correct = Array.isArray(question.correctAnswer)
      ? question.correctAnswer.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
      : [];
    const correctSet = new Set(correct);
    const optionCount = Array.isArray(question.options) ? question.options.length : 0;
    const filteredSelected = (selectedIndexes || []).filter((n) => Number.isInteger(n));
    // ✅ [POINT 2] Validation stricte des options
    if (filteredSelected.some((n) => n < 0 || n >= optionCount)) {
      throw new BadRequestException('Options sélectionnées invalides pour la question.');
    }
    if (filteredSelected.length > optionCount) {
      throw new BadRequestException('Trop d’options sélectionnées pour la question.');
    }
    const selectedSet = new Set(filteredSelected);

    if (mode === 'binary') {
      const allCorrect =
        correctSet.size === selectedSet.size &&
        filteredSelected.every((n) => correctSet.has(n));
      return { score: allCorrect ? 1 : 0, status: allCorrect ? 'correct' : 'wrong' };
    }

    // standard/positive with small penalty
    let score = 0;
    filteredSelected.forEach((idx) => {
      if (correctSet.has(idx)) score += 1;
      else score -= CoopService.PENALTY_WRONG;
    });
    score = Math.max(0, Math.min(1, score));
    const status: 'correct' | 'partial' | 'wrong' =
      score === 1 ? 'correct' : score === 0 ? 'wrong' : 'partial';
    return { score, status };
  }

  private computeSessionScore(
    questions: any[],
    answersMap: Map<string, number[]>,
    mode: 'positive' | 'standard' | 'binary' | undefined,
    orderedQuestionIds: string[],
  ) {
    const byId = new Map<string, any>();
    questions.forEach((q) => byId.set(String(q._id), q));
    let score = 0;
    const breakdown: Array<{
      questionId: string;
      score: number;
      status: 'correct' | 'partial' | 'wrong';
    }> = [];

    for (const questionId of orderedQuestionIds) {
      const q = byId.get(String(questionId));
      if (!q) {
        breakdown.push({ questionId: String(questionId), score: 0, status: 'wrong' });
        continue;
      }
      const selected = answersMap.get(String(questionId));
      const { score: s, status } = this.computeScorePerQuestion(q, selected, mode);
      score += s;
      breakdown.push({ questionId: String(questionId), score: s, status });
    }

    const totalQuestions = orderedQuestionIds.length || 1;
    const scorePct = Math.max(0, Math.min(100, (score / totalQuestions) * 100));
    return { score, scorePct, totalQuestions, breakdown };
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
    const desiredCount = Number.isFinite(countFromFilters) && countFromFilters > 0 ? countFromFilters : levelCount;
    const count = Math.max(
      CoopService.MIN_COUNT,
      Math.min(CoopService.MAX_COUNT, Math.trunc(desiredCount)),
    );
    const query = this.buildQuestionQuery(session.filters || {});
    const ids = await this.getSampledQuestionIds(query, count);
    if (ids.length === 0) {
      throw new BadRequestException('Aucun QCM disponible pour ces filtres (spécialité/année).');
    }
    session.questionIds = ids;
    session.status = 'in_progress';
    session.seed = session.seed || new Types.ObjectId().toHexString();
    // ✅ [POINT 1] Timer serveur
    session.startedAt = new Date();
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
    this.realtime.emitSessionEvent(String(session._id), sanitized.participants, 'coop:session_started', { ...payload, serverStartedAt: sanitized.startedAt });
    // push offline
    for (const pid of sanitized.participants) {
      if (!this.realtime.isUserOnline(pid)) {
        await this.notificationsService.sendPushToUser(pid, '🎮 Coop commencée', 'La partie a démarré.', {
          sessionId: String(session._id),
          type: 'coop_started',
        });
      }
    }
    this.logger.log(`Session ${String(session._id)} lancée (${ids.length} questions).`);
    return payload;
  }

  async submitResult(
    sessionId: string,
    userId: string,
    body: SubmitAnswersDto,
  ) {
    const userObjectId = this.toObjectId(userId);
    const session = await this.coopModel.findOneAndUpdate(
      {
        _id: sessionId,
        status: 'in_progress',
        participants: userObjectId,
        submittedBy: { $ne: userObjectId },
      },
      { $addToSet: { submittedBy: userObjectId } },
      { new: true },
    );
    if (!session) {
      throw new ConflictException('Résultat déjà soumis ou session inactive.');
    }
    session.submittedBy = Array.from(
      new Set([...(session.submittedBy ?? []), userObjectId]),
    ) as any;
    const key = userObjectId.toHexString();
    const durationMs = body.durationMs;
    if (durationMs !== undefined && (!Number.isFinite(durationMs) || durationMs < 0)) {
      throw new BadRequestException('durationMs doit être un nombre positif.');
    }
    if (!session.questionIds?.length) {
      throw new BadRequestException('Cette session ne contient pas de questions à corriger.');
    }
    const answersMap = this.normalizeAnswers(body);
    const questionIds = session.questionIds.map((id) => String(id));
    const questions = await this.questionModel
      .find({ _id: { $in: questionIds } })
      .lean();
    // ⚠️ [POINT 2] Pas de field "type" dans Question => impossible de distinguer single/multi; on borne seulement à la taille des options.
    const { score, scorePct, totalQuestions, breakdown } = this.computeSessionScore(
      questions,
      answersMap,
      session.correctionMode,
      questionIds,
    );
    const actualDuration = session.startedAt ? Date.now() - session.startedAt.getTime() : undefined;
    const existing = session.results ?? new Map<string, any>();
    existing.set(key, {
      score,
      scorePct,
      total: totalQuestions,
      durationMs: typeof actualDuration === 'number' && actualDuration >= 0 ? actualDuration : undefined,
      completedAt: new Date(),
    });
    session.results = existing;
    if (typeof actualDuration === 'number' && actualDuration >= 0) {
      session.serverDuration = actualDuration;
    }
    await session.save();
    // ✅ [POINT 4] Historique des réponses (audit)
    const submittedAt = new Date();
    const answersDocs = breakdown.map((b) => {
      const selected = answersMap.get(b.questionId) ?? [];
      return {
        sessionId: session._id,
        userId: userObjectId,
        questionId: new Types.ObjectId(b.questionId),
        selectedOptions: selected,
        isCorrect: b.status === 'correct',
        submittedAt,
        clientDuration: typeof durationMs === 'number' ? durationMs : undefined,
      };
    });
    if (answersDocs.length) {
      await this.coopAnswerModel.insertMany(answersDocs);
    }
    // ⚠️ [POINT 5] Transactions Mongo non mises en place ici (demande replica set) ; alternative : findOneAndUpdate + insertMany non transactionnels.
    let payload = this.sanitize(session);
    // Shorten TTL if both results present and award winner
    const both = session.participants.every((p) => session.results?.has(p.toHexString()));
    if (both) {
      // Determine winner: highest score, then shortest duration
      const a = session.participants[0].toHexString();
      const b = session.participants[1].toHexString();
      const ra: any = session.results?.get(a) || { score: 0 };
      const rb: any = session.results?.get(b) || { score: 0 };
      let winner: string | null = null;
      const scoreA = Number.isFinite(ra.scorePct) ? ra.scorePct : ra.score || 0;
      const scoreB = Number.isFinite(rb.scorePct) ? rb.scorePct : rb.score || 0;
      if (scoreA > scoreB) winner = a;
      else if (scoreB > scoreA) winner = b;
      else {
        const da = typeof ra.durationMs === 'number' ? ra.durationMs : Number.MAX_SAFE_INTEGER;
        const db = typeof rb.durationMs === 'number' ? rb.durationMs : Number.MAX_SAFE_INTEGER;
        if (da < db) winner = a;
        else if (db < da) winner = b;
      }
      // achievements removed: no winner processing
      session.winner = winner ? new Types.ObjectId(winner) : null;
      session.expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await session.save();
      payload = this.sanitize(session);
      this.logger.log(`Session ${String(session._id)} résultats complets (TTL 1h).`);
      this.realtime.emitSessionEvent(String(session._id), payload.participants, 'coop:session_finished', {
        session: payload,
      });
      for (const pid of payload.participants) {
        if (!this.realtime.isUserOnline(pid)) {
          const title = payload.winner === pid ? '🏆 Victoire !' : '💪 Défaite en coop';
          await this.notificationsService.sendPushToUser(pid, title, 'La session coop est terminée.', {
            sessionId: String(session._id),
            type: 'coop_finished',
          });
        }
      }
    }
    this.realtime.emitSessionEvent(String(session._id), payload.participants, 'coop:opponent_answered', {
      session: payload,
      userId: key,
    });
    if (both) {
      this.realtime.emitSessionEvent(String(session._id), payload.participants, 'coop:both_answered', {
        session: payload,
      });
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
    const payload = this.sanitize(session);
    // ✅ Snapshot pour reconnexion
    this.realtime.emitSessionEvent(String(session._id), [userId], 'coop:snapshot', { session: payload });
    return payload;
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
    this.realtime.emitSessionEvent(String(session._id), payload.participants, 'coop:session_ready', { session: payload });
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
    this.realtime.emitSessionEvent(sessionIdStr, session.participants.map((p) => p.toHexString()), 'coop:session_cancelled', { sessionId: sessionIdStr });
    return { success: true };
  }
}
