import { describe, expect, it } from 'vitest';
import { ELO_V1, expectedScore, settleElo } from './elo-policy.js';

describe('EloPolicy', () => {
  it('RN-RATE-001 uses the documented initial rating and version', () => {
    expect(ELO_V1).toMatchObject({
      algorithmVersion: 'elo-v1',
      initialRating: 0,
      kFactor: 32
    });
  });

  it('starts equal new players at zero and awards points to the winner', () => {
    const result = settleElo({
      matchType: 'RANKED_PUBLIC',
      reason: 'ACCEPTED',
      firstRating: 0,
      secondRating: 0,
      winner: 'FIRST'
    });

    expect(result.rated).toBe(true);
    expect(result.first).toMatchObject({ before: 0, delta: 16, after: 16 });
    expect(result.second).toMatchObject({ before: 0, delta: 0, after: 0 });
  });

  it('RN-RATE-002 calculates the expected score using the Elo formula', () => {
    expect(expectedScore(1_200, 1_200)).toBe(0.5);
    expect(expectedScore(1_600, 1_200)).toBeCloseTo(10 / 11);
  });

  it('RN-RATE-004 changes both ratings for a valid public ranked victory', () => {
    const result = settleElo({
      matchType: 'RANKED_PUBLIC',
      reason: 'ACCEPTED',
      firstRating: 1_200,
      secondRating: 1_200,
      winner: 'FIRST'
    });

    expect(result.rated).toBe(true);
    expect(result.first).toMatchObject({ before: 1_200, delta: 16, after: 1_216 });
    expect(result.second).toMatchObject({ before: 1_200, delta: -16, after: 1_184 });
  });

  it('RN-RATE-004 treats a ranked timeout draw as half a point', () => {
    const result = settleElo({
      matchType: 'RANKED_PUBLIC',
      reason: 'DRAW_TIMEOUT',
      firstRating: 1_400,
      secondRating: 1_200,
      winner: null
    });

    expect(result.rated).toBe(true);
    expect(result.first.delta).toBeLessThan(0);
    expect(result.second.delta).toBeGreaterThan(0);
  });

  it('RN-MATCH-002 never rates a private match', () => {
    const result = settleElo({
      matchType: 'PRIVATE_UNRANKED',
      reason: 'ACCEPTED',
      firstRating: 1_200,
      secondRating: 1_200,
      winner: 'FIRST'
    });

    expect(result.rated).toBe(false);
    expect(result.first.delta).toBe(0);
    expect(result.second.delta).toBe(0);
  });

  it('never rates a public unranked match', () => {
    const result = settleElo({
      matchType: 'UNRANKED_PUBLIC',
      reason: 'ACCEPTED',
      firstRating: 32,
      secondRating: 16,
      winner: 'FIRST'
    });

    expect(result.rated).toBe(false);
    expect(result.first).toMatchObject({ before: 32, delta: 0, after: 32 });
    expect(result.second).toMatchObject({ before: 16, delta: 0, after: 16 });
  });

  it('RN-RATE-004 never rates a void system result', () => {
    const result = settleElo({
      matchType: 'RANKED_PUBLIC',
      reason: 'VOID_SYSTEM',
      firstRating: 1_200,
      secondRating: 1_200,
      winner: null
    });

    expect(result.rated).toBe(false);
    expect(result.first.after).toBe(1_200);
    expect(result.second.after).toBe(1_200);
  });
});
