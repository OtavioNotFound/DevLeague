import { describe, expect, it } from 'vitest';
import {
  matchmakingRecoveryInterval,
  matchmakingRetryDelay
} from './matchmaking-loop.service.js';
import { MatchmakingWakeSignalService } from './matchmaking-wake-signal.service.js';

describe('embedded matchmaking scheduling', () => {
  it('RF-MM-003 clamps legacy aggressive polling to a quota-safe recovery interval', () => {
    expect(matchmakingRecoveryInterval({ MATCHMAKER_POLL_MS: '100' })).toBe(30_000);
    expect(matchmakingRecoveryInterval({ MATCHMAKER_RECOVERY_MS: '45000' })).toBe(45_000);
  });

  it('RF-OPS-001 backs off repeated Redis failures up to one minute', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(matchmakingRetryDelay))
      .toEqual([2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000]);
  });

  it('RF-MM-001 wakes immediately instead of waiting for the recovery scan', async () => {
    const signal = new MatchmakingWakeSignalService();
    const waiting = signal.waitForChange(signal.snapshot(), 30_000);

    signal.wake();

    await expect(waiting).resolves.toBeUndefined();
  });
});
