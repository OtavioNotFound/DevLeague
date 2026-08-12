import type { MatchResultReason, MatchType } from '../match/match.js';

export const ELO_V1 = {
  algorithmVersion: 'elo-v1',
  initialRating: 0,
  kFactor: 32,
  scale: 400
} as const;

export interface RatingChange {
  readonly before: number;
  readonly expectedScore: number;
  readonly actualScore: number;
  readonly delta: number;
  readonly after: number;
  readonly algorithmVersion: typeof ELO_V1.algorithmVersion;
}

export interface RatingSettlement {
  readonly rated: boolean;
  readonly first: RatingChange;
  readonly second: RatingChange;
}

export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / ELO_V1.scale));
}

export function settleElo(input: {
  readonly matchType: MatchType;
  readonly reason: MatchResultReason;
  readonly firstRating: number;
  readonly secondRating: number;
  readonly winner: 'FIRST' | 'SECOND' | null;
}): RatingSettlement {
  const firstExpected = expectedScore(input.firstRating, input.secondRating);
  const secondExpected = 1 - firstExpected;

  if (input.matchType !== 'RANKED_PUBLIC' || input.reason === 'VOID_SYSTEM') {
    return {
      rated: false,
      first: unchanged(input.firstRating, firstExpected),
      second: unchanged(input.secondRating, secondExpected)
    };
  }

  const firstActual = input.winner === 'FIRST' ? 1 : input.winner === 'SECOND' ? 0 : 0.5;
  const secondActual = 1 - firstActual;
  const firstDelta = Math.round(ELO_V1.kFactor * (firstActual - firstExpected));
  const secondDelta = -firstDelta;
  const firstAfter = Math.max(0, input.firstRating + firstDelta);
  const secondAfter = Math.max(0, input.secondRating + secondDelta);

  return {
    rated: true,
    first: {
      before: input.firstRating,
      expectedScore: firstExpected,
      actualScore: firstActual,
      delta: firstAfter - input.firstRating,
      after: firstAfter,
      algorithmVersion: ELO_V1.algorithmVersion
    },
    second: {
      before: input.secondRating,
      expectedScore: secondExpected,
      actualScore: secondActual,
      delta: secondAfter - input.secondRating,
      after: secondAfter,
      algorithmVersion: ELO_V1.algorithmVersion
    }
  };
}

function unchanged(rating: number, expected: number): RatingChange {
  return {
    before: rating,
    expectedScore: expected,
    actualScore: 0,
    delta: 0,
    after: rating,
    algorithmVersion: ELO_V1.algorithmVersion
  };
}
