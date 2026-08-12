import { describe, expect, it } from 'vitest';
import { Match } from './match.js';
import type { MatchRuleError, MatchRuleErrorCode } from './match-errors.js';

const START = new Date('2026-08-11T20:00:00.000Z');

function activeMatch(type: 'RANKED_PUBLIC' | 'PRIVATE_UNRANKED' = 'RANKED_PUBLIC'): Match {
  const match = Match.create({
    id: 'match-1',
    type,
    participantUserIds: ['player-a', 'player-b'],
    startsAt: START
  });
  match.start(START);
  return match;
}

describe('Match', () => {
  it('RN-TIME-001 starts with the documented ten-minute duration', () => {
    const match = activeMatch();

    expect(match.getSnapshot().endsAt.toISOString()).toBe('2026-08-11T20:10:00.000Z');
  });

  it('RN-RESULT-001 assigns an authoritative monotonic admission sequence', () => {
    const match = activeMatch();

    const first = match.admitSubmission({
      id: 'submission-1',
      userId: 'player-a',
      serverReceivedAt: new Date('2026-08-11T20:01:00.000Z')
    });
    const second = match.admitSubmission({
      id: 'submission-2',
      userId: 'player-b',
      serverReceivedAt: new Date('2026-08-11T20:01:00.000Z')
    });

    expect(first.admissionSeq).toBe(1);
    expect(second.admissionSeq).toBe(2);
  });

  it('RN-SUB-003 treats a repeated submission ID from the same user idempotently', () => {
    const match = activeMatch();
    const input = {
      id: 'submission-1',
      userId: 'player-a',
      serverReceivedAt: new Date('2026-08-11T20:01:00.000Z')
    } as const;

    expect(match.admitSubmission(input)).toEqual(match.admitSubmission(input));
    expect(match.getSnapshot().submissions).toHaveLength(1);
  });

  it('RN-TIME-004 admits exactly at endsAt and rejects anything later', () => {
    const match = activeMatch();

    expect(() =>
      match.admitSubmission({
        id: 'at-deadline',
        userId: 'player-a',
        serverReceivedAt: new Date('2026-08-11T20:10:00.000Z')
      })
    ).not.toThrow();

    expectRuleError(
      () =>
      match.admitSubmission({
        id: 'after-deadline',
        userId: 'player-b',
        serverReceivedAt: new Date('2026-08-11T20:10:00.001Z')
      }),
      'SUBMISSION_DEADLINE_PASSED'
    );
  });

  it('RN-RESULT-003 waits when a later Accepted returns before an earlier pending submission', () => {
    const match = activeMatch();
    match.admitSubmission({
      id: 'earlier',
      userId: 'player-a',
      serverReceivedAt: new Date('2026-08-11T20:01:00.000Z')
    });
    match.admitSubmission({
      id: 'later',
      userId: 'player-b',
      serverReceivedAt: new Date('2026-08-11T20:01:01.000Z')
    });

    const provisional = match.recordVerdict({
      submissionId: 'later',
      verdict: 'ACCEPTED',
      serverFinishedAt: new Date('2026-08-11T20:01:02.000Z')
    });

    expect(provisional).toBeNull();
    expect(match.getSnapshot().status).toBe('RESOLVING');

    const result = match.recordVerdict({
      submissionId: 'earlier',
      verdict: 'WRONG_ANSWER',
      serverFinishedAt: new Date('2026-08-11T20:01:03.000Z')
    });

    expect(result).toMatchObject({
      reason: 'ACCEPTED',
      winnerUserId: 'player-b',
      winningSubmissionId: 'later'
    });
  });

  it('RF-RESULT-001 lets the earlier submission win even when its callback arrives last', () => {
    const match = activeMatch();
    match.admitSubmission({
      id: 'earlier',
      userId: 'player-a',
      serverReceivedAt: new Date('2026-08-11T20:01:00.000Z')
    });
    match.admitSubmission({
      id: 'later',
      userId: 'player-b',
      serverReceivedAt: new Date('2026-08-11T20:01:01.000Z')
    });

    match.recordVerdict({
      submissionId: 'later',
      verdict: 'ACCEPTED',
      serverFinishedAt: new Date('2026-08-11T20:01:02.000Z')
    });
    const result = match.recordVerdict({
      submissionId: 'earlier',
      verdict: 'ACCEPTED',
      serverFinishedAt: new Date('2026-08-11T20:01:04.000Z')
    });

    expect(result?.winnerUserId).toBe('player-a');
    expect(result?.winningSubmissionId).toBe('earlier');
  });

  it('RN-RESULT-004 resolves a deadline without Accepted as a draw', () => {
    const match = activeMatch();
    match.admitSubmission({
      id: 'wrong',
      userId: 'player-a',
      serverReceivedAt: new Date('2026-08-11T20:09:00.000Z')
    });
    match.recordVerdict({
      submissionId: 'wrong',
      verdict: 'WRONG_ANSWER',
      serverFinishedAt: new Date('2026-08-11T20:09:01.000Z')
    });

    expect(match.reachDeadline(new Date('2026-08-11T20:10:00.000Z'))).toMatchObject({
      reason: 'DRAW_TIMEOUT',
      winnerUserId: null
    });
  });

  it('RN-RESULT-006 can void a system-compromised result without choosing a winner', () => {
    const match = activeMatch();

    expect(match.reachDeadline(new Date('2026-08-11T20:10:00.000Z'), true)).toMatchObject({
      reason: 'VOID_SYSTEM',
      winnerUserId: null
    });
  });

  it('RN-DC-002 awards a forfeit to the opponent', () => {
    const match = activeMatch();

    expect(match.forfeit('player-a', new Date('2026-08-11T20:02:00.000Z'))).toMatchObject({
      reason: 'FORFEIT',
      winnerUserId: 'player-b'
    });
  });

  it('rejects submissions from a non-participant', () => {
    const match = activeMatch();

    expectRuleError(
      () =>
      match.admitSubmission({
        id: 'intruder',
        userId: 'player-c',
        serverReceivedAt: new Date('2026-08-11T20:01:00.000Z')
      }),
      'NOT_A_PARTICIPANT'
    );
  });
});

function expectRuleError(action: () => void, code: MatchRuleErrorCode): void {
  try {
    action();
  } catch (error: unknown) {
    const ruleError = error as MatchRuleError;
    expect(ruleError.name).toBe('MatchRuleError');
    expect(ruleError.code).toBe(code);
    return;
  }

  throw new Error(`Expected MatchRuleError with code ${code}.`);
}
