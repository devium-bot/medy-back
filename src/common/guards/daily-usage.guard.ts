import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';

// Enforce free-plan daily limits and allow premium users to bypass
// Rules (MVP):
// - Free: max 2 sessions per day (coop session creation)
// - Free: max 3 questions per draw (questions/random)
// - Premium or Admin: unlimited

@Injectable()
export class DailyUsageGuard implements CanActivate {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: any = context.switchToHttp().getRequest();
    const user = req.user as any;
    if (!user) return false;

    // refetch to have full subscription + usageDaily fields
    const dbUser = await this.userModel.findById(user._id);
    if (!dbUser) return false;

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const usage = dbUser.usageDaily || ({} as any);
    if (!usage.dateISO || usage.dateISO !== today) {
      usage.dateISO = today;
      usage.sessionsUsed = 0;
      usage.questionsUsed = 0;
      usage.aiRequestsUsed = 0;
      usage.examSessionsUsed = 0;
      usage.soloSessionsUsed = 0;
      usage.coopSessionsUsed = 0;
    }

    const isAdmin = (dbUser.role as any) === 'admin';
    const isPremium = this.isPremium(dbUser, now) || isAdmin;

    const url: string = req?.originalUrl || req?.url || '';
    const method: string = (req?.method || '').toUpperCase();

    // If premium/admin, allow without touching counters
    if (isPremium) {
      return true;
    }

    // Free plan enforcement
    if (
      method === 'POST' &&
      (
        (url.startsWith('/coop/session') && !url.includes('/filters') && !url.includes('/ready') && !url.includes('/result')) ||
        url.startsWith('/questions/solo/start')
      )
    ) {
      if (url.startsWith('/questions/solo/start')) {
        const mode = String(req?.body?.mode ?? 'random');
        const countRaw = Number(req?.body?.count ?? 0);
        if (mode === 'exam') {
          if ((usage.examSessionsUsed || 0) >= 1) {
            throw new ForbiddenException(
              "Limite quotidienne atteinte: 1 examen complet par jour en mode gratuit.",
            );
          }
          if (countRaw !== 40) {
            throw new ForbiddenException(
              "Le plan gratuit autorise uniquement un examen complet de 40 questions.",
            );
          }
          usage.examSessionsUsed = (usage.examSessionsUsed || 0) + 1;
        } else {
          if ((usage.soloSessionsUsed || 0) >= 1) {
            throw new ForbiddenException(
              "Limite quotidienne atteinte: 1 session solo par jour en mode gratuit.",
            );
          }
          usage.soloSessionsUsed = (usage.soloSessionsUsed || 0) + 1;
        }
      } else if (url.startsWith('/coop/session')) {
        if ((usage.coopSessionsUsed || 0) >= 1) {
          throw new ForbiddenException(
            "Limite quotidienne atteinte: 1 session coop par jour en mode gratuit.",
          );
        }
        usage.coopSessionsUsed = (usage.coopSessionsUsed || 0) + 1;
      }

      usage.sessionsUsed =
        (usage.examSessionsUsed || 0) +
        (usage.soloSessionsUsed || 0) +
        (usage.coopSessionsUsed || 0);
      dbUser.usageDaily = usage as any;
      await dbUser.save();
      return true;
    }

    if (method === 'GET' && url.startsWith('/questions/random')) {
      const paramsCount = Number(req.params?.count ?? req.query?.count ?? 0);
      const count = Number.isFinite(paramsCount) && paramsCount > 0 ? paramsCount : 0;
      if (count > 3) {
        throw new ForbiddenException('Le plan gratuit autorise au maximum 3 questions par session.');
      }
      usage.questionsUsed = (usage.questionsUsed || 0) + count;
      dbUser.usageDaily = usage as any;
      await dbUser.save();
      return true;
    }

    // Default allow for other routes; this guard should be applied only where needed
    return true;
  }

  private isPremium(user: UserDocument, now: Date) {
    const sub = user.subscription as any;
    if (!sub) return false;
    const nowMs = now.getTime();
    const endMs = sub.endDate ? new Date(sub.endDate).getTime() : undefined;
    const hasFutureEnd = endMs === undefined || endMs > nowMs;
    // Consider premium if either status is active or plan is premium and the end date is not expired (or missing)
    return hasFutureEnd && (sub.status === 'active' || sub.plan === 'premium');
  }
}
