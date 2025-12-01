import { Types } from 'mongoose';
import {
  TTL,
  bumpPendingTTL,
  canTransition,
  markExpiredIfNeeded,
  participantsHaveBothResults,
  setInProgressTTL,
  setResultsCompletedTTL,
} from './coop.state';

describe('coop.state helpers', () => {
  it('canTransition enforces simple allowed transitions', () => {
    expect(canTransition('pending', 'ready')).toBe(true);
    expect(canTransition('ready', 'in_progress')).toBe(true);
    expect(canTransition('in_progress', 'ready')).toBe(false);
    expect(canTransition('cancelled', 'ready')).toBe(false);
  });

  it('TTL helpers set appropriate windows', () => {
    const s: any = {};
    bumpPendingTTL(s);
    const pendingDelta = s.expiresAt.getTime() - Date.now();
    expect(pendingDelta).toBeGreaterThan(TTL.pendingMs - 2000);
    setInProgressTTL(s);
    const inProgDelta = s.expiresAt.getTime() - Date.now();
    expect(inProgDelta).toBeGreaterThan(TTL.inProgressMs - 2000);
    setResultsCompletedTTL(s);
    const resultsDelta = s.expiresAt.getTime() - Date.now();
    expect(resultsDelta).toBeGreaterThan(TTL.resultsCompleteMs - 2000);
  });

  it('participantsHaveBothResults checks results for all participants', () => {
    const a = new Types.ObjectId();
    const b = new Types.ObjectId();
    const sess: any = { participants: [a, b], results: new Map<string, any>() };
    sess.results.set(a.toHexString(), { score: 10, total: 10 });
    expect(participantsHaveBothResults(sess)).toBe(false);
    sess.results.set(b.toHexString(), { score: 9, total: 10 });
    expect(participantsHaveBothResults(sess)).toBe(true);
  });

  it('markExpiredIfNeeded flags pending/ready sessions', () => {
    const s: any = { status: 'pending', expiresAt: new Date(Date.now() - 1000) };
    expect(markExpiredIfNeeded(s)).toBe(true);
    expect(s.status).toBe('expired');
  });
});

