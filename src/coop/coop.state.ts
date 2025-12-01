import { Types } from 'mongoose';

export type CoopStatus = 'pending' | 'ready' | 'in_progress' | 'cancelled' | 'expired';

export const TTL = {
  pendingMs: 30 * 60 * 1000,
  readyMs: 30 * 60 * 1000,
  inProgressMs: 6 * 60 * 60 * 1000,
  cancelledMs: 10 * 60 * 1000,
  resultsCompleteMs: 60 * 60 * 1000,
};

export const canTransition = (from: CoopStatus, to: CoopStatus) => {
  const allowed: Record<CoopStatus, CoopStatus[]> = {
    pending: ['ready', 'cancelled', 'expired'],
    ready: ['pending', 'in_progress', 'cancelled', 'expired'],
    in_progress: ['cancelled', 'expired'],
    cancelled: [],
    expired: [],
  };
  return allowed[from]?.includes(to) ?? false;
};

export function bumpPendingTTL(session: any) {
  session.expiresAt = new Date(Date.now() + TTL.pendingMs);
}

export function setInProgressTTL(session: any) {
  session.expiresAt = new Date(Date.now() + TTL.inProgressMs);
}

export function setCancelledTTL(session: any) {
  session.expiresAt = new Date(Date.now() + TTL.cancelledMs);
}

export function setResultsCompletedTTL(session: any) {
  session.expiresAt = new Date(Date.now() + TTL.resultsCompleteMs);
}

export function markExpiredIfNeeded(session: any) {
  if ((session.status === 'pending' || session.status === 'ready') && session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
    session.status = 'expired';
    return true;
  }
  return false;
}

export function participantsHaveBothResults(session: any): boolean {
  if (!session?.participants?.length || !session.results) return false;
  return session.participants.every((p: Types.ObjectId) => session.results.has(p.toHexString()));
}

export function isParticipant(session: any, userId: Types.ObjectId) {
  return session.participants?.some((p: Types.ObjectId) => p.equals(userId));
}

