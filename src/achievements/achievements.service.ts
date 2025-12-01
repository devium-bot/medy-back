import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { QcmAttempt, QcmAttemptDocument } from '../stats/schemas/qcm-attempt.schema';
import { UsersService } from '../users/users.service';

type AchItem = {
  key: string;
  title: string;
  description: string;
  lottie: string;
};

const CATALOG: AchItem[] = [
  {
    key: 'first_session',
    title: 'Première session',
    description: 'Termine ta première session QCM.',
    lottie:
      'https://lottie.host/020b1d0d-7e3b-4f2c-8b8f-5e59a3c7e40c/3f9OQbC2qB.json',
  },
  // New trophies based on requested rules
  {
    key: 'how_the_hell_medcine',
    title: "How the hell did you get into medicine",
    description: 'Obtiens 5% ou moins sur 2 QCM.',
    lottie:
      'https://lottie.host/5f7d6d2f-9a3f-4b32-8f31-0b4b5c0f0b21/medcine-low.json',
  },
  {
    key: 'project_biologie',
    title: 'Project Biologie',
    description: 'Obtiens 20% ou moins sur 3 QCM.',
    lottie:
      'https://lottie.host/c9e5f6d7-2a3b-4c7d-9f11-1a2b3c4d5e6f/biology.json',
  },
  {
    key: 'el_profesor',
    title: 'El Profesor',
    description: 'Atteins ≥85% sur au moins 5 QCM.',
    lottie:
      'https://lottie.host/ab12cd34-ef56-7890-ab12-cd34ef567890/professor.json',
  },
  {
    key: 'save_the_world',
    title: 'Continue, you will save the world',
    description: 'Fais 100% sur un QCM.',
    lottie:
      'https://lottie.host/0a1b2c3d-4e5f-6789-0a1b-2c3d4e5f6789/world.json',
  },
  {
    key: 'streak_3',
    title: 'Série de 3',
    description: 'Enchaîne 3 sessions en une journée.',
    lottie:
      'https://lottie.host/1a0f8a4b-a8ae-4f5a-9437-6b8e4a2c95c1/2J3z9mHQ9s.json',
  },
  {
    key: 'top_scorer_80',
    title: 'Score 80%',
    description: 'Atteins un score de 80% ou plus.',
    lottie:
      'https://lottie.host/0e1f3075-8f89-4c44-9ac1-f2b0d2e8fe6a/2w8Ck1b4kW.json',
  },
  {
    key: 'night_owl',
    title: 'Oiseau de nuit',
    description: 'Termine une session après 22h.',
    lottie:
      'https://lottie.host/0cfe0fa7-5c57-4d48-a2ed-bb15f8eaa2f1/Mf8W4mQAZj.json',
  },
  {
    key: 'library_explorer',
    title: 'Explorateur',
    description: 'Consulte 10 questions depuis la bibliothèque.',
    lottie:
      'https://lottie.host/0f154aa9-1a0a-4b53-b76b-7f6b61aeb196/c8k0f6cFPc.json',
  },
];

@Injectable()
export class AchievementsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(QcmAttempt.name)
    private attemptModel: Model<QcmAttemptDocument>,
    private readonly usersService: UsersService,
  ) {}

  catalog() {
    return CATALOG;
  }

  async listForUser(userId: string) {
    if (!Types.ObjectId.isValid(userId)) return [];
    const user = await this.userModel
      .findById(userId)
      .select('stats')
      .lean();
    const unlocked = new Set<string>();
    if (user?.stats?.qcmAttempts && user.stats.qcmAttempts > 0)
      unlocked.add('first_session');
    if (
      typeof user?.stats?.bestScore === 'number' &&
      user.stats.bestScore >= 0.8
    )
      unlocked.add('top_scorer_80');
    const last = user?.stats?.lastActivityAt;
    if (last) {
      const h = new Date(last).getHours();
      if (h >= 22 || h < 6) unlocked.add('night_owl');
    }
    // Aggregated rules on attempts
    const [low5, low20, high85, full100] = await Promise.all([
      this.attemptModel.countDocuments({ user: userId, percentage: { $lte: 5 } }),
      this.attemptModel.countDocuments({ user: userId, percentage: { $lte: 20 } }),
      this.attemptModel.countDocuments({ user: userId, percentage: { $gte: 85 } }),
      this.attemptModel.countDocuments({ user: userId, percentage: 100 }),
    ]);

    if (low5 >= 2) unlocked.add('how_the_hell_medcine');
    if (low20 >= 3) unlocked.add('project_biologie');
    if (high85 >= 5) unlocked.add('el_profesor');
    if (full100 >= 1) unlocked.add('save_the_world');

    // streak_3 & library_explorer require more granular data; keep locked for MVP backend
    return Array.from(unlocked.values());
  }

  async summaryForUser(userId: string) {
    const [catalog, mine] = await Promise.all([
      Promise.resolve(CATALOG),
      this.listForUser(userId),
    ]);
    const set = new Set(mine);
    return catalog.map((c) => ({ ...c, unlocked: set.has(c.key) }));
  }

  async onSoloSession(
    userId: string,
    payload: { score: number; total: number; mode?: string },
  ) {
    // snapshot before
    const before = new Set(await this.listForUser(userId));

    // record attempt with computed percentage and update user stats
    const percentage = payload.total > 0 ? (payload.score / payload.total) * 100 : 0;
    await this.attemptModel.create({
      user: new Types.ObjectId(userId),
      score: payload.score,
      total: payload.total,
      percentage: Number(percentage.toFixed(2)),
    });
    await this.usersService.updateStatsAfterAttempt(userId, {
      score: payload.score,
    });

    // compute after and diff
    const after = new Set(await this.listForUser(userId));
    const awarded: string[] = [];
    after.forEach((k) => {
      if (!before.has(k)) awarded.push(k);
    });
    return awarded;
  }
}
