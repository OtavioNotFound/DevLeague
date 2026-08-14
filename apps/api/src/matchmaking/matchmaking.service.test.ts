import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MatchmakingEntry } from '@devleague/application';
import { MatchmakingWakeSignalService } from './matchmaking-wake-signal.service.js';
import {
  isCasualBrowserExecutionEnabled,
  isCompetitiveExecutionEnabled,
  isMatchmakingExecutionEnabled,
  isMatchmakingModeEnabled,
  MatchmakingService
} from './matchmaking.service.js';

afterEach(() => vi.unstubAllEnvs());

describe('matchmaking safety gate', () => {
  it('RN-MATCH-001 keeps ranked disabled until the production judge is explicitly ready', () => {
    expect(isMatchmakingModeEnabled('RANKED', {})).toBe(false);
    expect(isMatchmakingModeEnabled('RANKED', { RANKED_MATCHMAKING_ENABLED: 'false' })).toBe(false);
    expect(isMatchmakingModeEnabled('RANKED', { RANKED_MATCHMAKING_ENABLED: 'true' })).toBe(true);
  });

  it('keeps public unranked available independently from the ranked gate', () => {
    expect(isMatchmakingModeEnabled('UNRANKED', {})).toBe(true);
  });

  it('requires an explicit gate before any competitive execution is accepted', () => {
    expect(isCompetitiveExecutionEnabled({})).toBe(false);
    expect(isCompetitiveExecutionEnabled({ COMPETITIVE_EXECUTION_ENABLED: 'true' })).toBe(true);
  });

  it('RN-MATCH-006 enables only unranked through the browser execution gate', () => {
    const environment = { ALPHA_BROWSER_MATCHES_UNRANKED: 'true' };
    expect(isCasualBrowserExecutionEnabled(environment)).toBe(true);
    expect(isMatchmakingExecutionEnabled('UNRANKED', environment)).toBe(true);
    expect(isMatchmakingExecutionEnabled('RANKED', environment)).toBe(false);
  });
});

describe('matchmaking Redis degradation', () => {
  it('RF-OPS-001 maps a Redis command failure to a stable 503 response', async () => {
    const redis = {
      matchmakingQueue: () => Promise.resolve({
        heartbeat: () => Promise.reject(new Error('quota exhausted'))
      })
    };
    const users = {
      requireEligible: () => Promise.resolve({ id: 'user-1' })
    };
    const service = new MatchmakingService(
      redis as never,
      users as never,
      new MatchmakingWakeSignalService()
    );

    await expect(service.heartbeat({ subject: 'subject-1', emailVerified: true }))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('RF-MM-001 wakes the embedded matcher after a successful queue entry', async () => {
    vi.stubEnv('MATCHMAKING_ENABLED', 'true');
    vi.stubEnv('ALPHA_BROWSER_MATCHES_UNRANKED', 'true');
    const entry: MatchmakingEntry = {
      id: 'entry-1', userId: 'user-1', rating: 0, region: 'br-sa-east', mode: 'UNRANKED',
      enteredAt: 1, expiresAt: 2
    };
    const redis = {
      matchmakingQueue: () => Promise.resolve({ upsert: () => Promise.resolve(entry) })
    };
    const users = {
      requireEligible: () => Promise.resolve({ id: 'user-1', rating: 0, activeMatchId: null })
    };
    const wakeSignal = new MatchmakingWakeSignalService();
    const snapshot = wakeSignal.snapshot();
    const service = new MatchmakingService(redis as never, users as never, wakeSignal);

    await expect(service.upsert({ subject: 'subject-1', emailVerified: true }, 'UNRANKED'))
      .resolves.toEqual(entry);
    expect(wakeSignal.snapshot()).toBeGreaterThan(snapshot);
  });
});
