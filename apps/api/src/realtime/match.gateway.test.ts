import { describe, expect, it } from 'vitest';
import { requireJoinPayload } from './match.gateway.js';

describe('match realtime resynchronization contract', () => {
  it('RF-MATCH-004 accepts a monotonic client event sequence for snapshot resync', () => {
    expect(requireJoinPayload({
      matchId: '019ff31b-6ec5-72d0-a306-1619d8c33cc7',
      lastEventSeq: 18
    })).toBe('019ff31b-6ec5-72d0-a306-1619d8c33cc7');
  });

  it('rejects invalid match IDs and negative sequences', () => {
    expect(() => requireJoinPayload({ matchId: 'not-a-uuid' })).toThrow();
    expect(() => requireJoinPayload({
      matchId: '019ff31b-6ec5-72d0-a306-1619d8c33cc7', lastEventSeq: -1
    })).toThrow();
  });
});
