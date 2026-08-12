import { MatchRuleError } from './match-errors.js';

export type MatchType = 'RANKED_PUBLIC' | 'UNRANKED_PUBLIC' | 'PRIVATE_UNRANKED';
export type MatchStatus =
  | 'COUNTDOWN'
  | 'ACTIVE'
  | 'RESOLVING'
  | 'FINISHED'
  | 'CANCELLED';

export type SubmissionVerdict =
  | 'QUEUED'
  | 'RUNNING'
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'COMPILE_ERROR'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT_EXCEEDED'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'OUTPUT_LIMIT_EXCEEDED'
  | 'SYSTEM_ERROR'
  | 'CANCELLED';

export type MatchResultReason =
  | 'ACCEPTED'
  | 'FORFEIT'
  | 'DRAW_TIMEOUT'
  | 'VOID_SYSTEM';

export interface MatchResult {
  readonly reason: MatchResultReason;
  readonly winnerUserId: string | null;
  readonly finishedAt: Date;
  readonly winningSubmissionId: string | null;
}

export interface MatchSubmission {
  readonly id: string;
  readonly userId: string;
  readonly admissionSeq: number;
  readonly eligibleReceivedAt: Date;
  verdict: SubmissionVerdict;
  finishedAt: Date | null;
}

export interface CreateMatchInput {
  readonly id: string;
  readonly type: MatchType;
  readonly participantUserIds: readonly [string, string];
  readonly startsAt: Date;
  readonly durationSeconds?: number;
}

export interface MatchSnapshot {
  readonly id: string;
  readonly type: MatchType;
  readonly status: MatchStatus;
  readonly participants: readonly string[];
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly nextSubmissionSeq: number;
  readonly submissions: readonly MatchSubmission[];
  readonly result: MatchResult | null;
}

const TERMINAL_VERDICTS = new Set<SubmissionVerdict>([
  'ACCEPTED',
  'WRONG_ANSWER',
  'COMPILE_ERROR',
  'RUNTIME_ERROR',
  'TIME_LIMIT_EXCEEDED',
  'MEMORY_LIMIT_EXCEEDED',
  'OUTPUT_LIMIT_EXCEEDED',
  'SYSTEM_ERROR',
  'CANCELLED'
]);

export class Match {
  private status: MatchStatus = 'COUNTDOWN';
  private nextSubmissionSeq = 1;
  private readonly submissions = new Map<string, MatchSubmission>();
  private result: MatchResult | null = null;

  readonly id: string;
  readonly type: MatchType;
  readonly participantUserIds: readonly [string, string];
  readonly startsAt: Date;
  readonly endsAt: Date;

  private constructor(input: CreateMatchInput) {
    const durationSeconds = input.durationSeconds ?? 600;
    const [first, second] = input.participantUserIds;

    if (!first || !second || first === second) {
      throw new MatchRuleError(
        'INVALID_PARTICIPANTS',
        'A match requires two distinct participants.'
      );
    }

    if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) {
      throw new MatchRuleError('INVALID_DURATION', 'Duration must be a positive integer.');
    }

    this.id = input.id;
    this.type = input.type;
    this.participantUserIds = [first, second];
    this.startsAt = new Date(input.startsAt);
    this.endsAt = new Date(this.startsAt.getTime() + durationSeconds * 1_000);
  }

  static create(input: CreateMatchInput): Match {
    return new Match(input);
  }

  start(serverNow: Date): void {
    this.requireStatus('COUNTDOWN');
    if (serverNow.getTime() < this.startsAt.getTime()) {
      throw new MatchRuleError('INVALID_TRANSITION', 'Countdown has not finished yet.');
    }
    this.status = 'ACTIVE';
  }

  admitSubmission(input: {
    readonly id: string;
    readonly userId: string;
    readonly serverReceivedAt: Date;
  }): MatchSubmission {
    this.requireStatus('ACTIVE');
    this.requireParticipant(input.userId);

    const existing = this.submissions.get(input.id);
    if (existing) {
      if (existing.userId === input.userId) return cloneSubmission(existing);
      throw new MatchRuleError('SUBMISSION_ID_REUSED', 'Submission ID is already in use.');
    }

    if (input.serverReceivedAt.getTime() > this.endsAt.getTime()) {
      throw new MatchRuleError(
        'SUBMISSION_DEADLINE_PASSED',
        'The server received this submission after the deadline.'
      );
    }

    const submission: MatchSubmission = {
      id: input.id,
      userId: input.userId,
      admissionSeq: this.nextSubmissionSeq,
      eligibleReceivedAt: new Date(input.serverReceivedAt),
      verdict: 'QUEUED',
      finishedAt: null
    };

    this.nextSubmissionSeq += 1;
    this.submissions.set(submission.id, submission);
    return cloneSubmission(submission);
  }

  markSubmissionRunning(submissionId: string): void {
    const submission = this.requireSubmission(submissionId);
    if (TERMINAL_VERDICTS.has(submission.verdict)) {
      throw new MatchRuleError(
        'SUBMISSION_ALREADY_TERMINAL',
        'A terminal submission cannot return to running.'
      );
    }
    submission.verdict = 'RUNNING';
  }

  recordVerdict(input: {
    readonly submissionId: string;
    readonly verdict: Exclude<SubmissionVerdict, 'QUEUED' | 'RUNNING'>;
    readonly serverFinishedAt: Date;
  }): MatchResult | null {
    if (this.isTerminal()) return this.result ? cloneResult(this.result) : null;

    const submission = this.requireSubmission(input.submissionId);
    if (TERMINAL_VERDICTS.has(submission.verdict)) {
      if (submission.verdict === input.verdict) {
        return this.result ? cloneResult(this.result) : null;
      }
      throw new MatchRuleError(
        'SUBMISSION_ALREADY_TERMINAL',
        'A terminal verdict cannot be replaced.'
      );
    }

    submission.verdict = input.verdict;
    submission.finishedAt = new Date(input.serverFinishedAt);
    return this.tryResolveAccepted(input.serverFinishedAt);
  }

  reachDeadline(serverNow: Date, systemIntegrityCompromised = false): MatchResult | null {
    if (this.isTerminal()) return this.result ? cloneResult(this.result) : null;
    if (serverNow.getTime() < this.endsAt.getTime()) {
      throw new MatchRuleError('INVALID_TRANSITION', 'The match deadline has not been reached.');
    }

    const accepted = this.tryResolveAccepted(serverNow);
    if (accepted) return accepted;

    if (this.hasPendingSubmissions()) {
      this.status = 'RESOLVING';
      return null;
    }

    return this.finish(
      systemIntegrityCompromised ? 'VOID_SYSTEM' : 'DRAW_TIMEOUT',
      null,
      serverNow,
      null
    );
  }

  forfeit(userId: string, serverNow: Date): MatchResult {
    if (this.isTerminal()) {
      throw new MatchRuleError('MATCH_ALREADY_TERMINAL', 'The match is already terminal.');
    }
    this.requireParticipant(userId);
    const winnerUserId = this.participantUserIds.find((id) => id !== userId) ?? null;
    return this.finish('FORFEIT', winnerUserId, serverNow, null);
  }

  voidForSystemFailure(serverNow: Date): MatchResult {
    if (this.isTerminal()) {
      throw new MatchRuleError('MATCH_ALREADY_TERMINAL', 'The match is already terminal.');
    }
    return this.finish('VOID_SYSTEM', null, serverNow, null);
  }

  getSnapshot(): MatchSnapshot {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      participants: [...this.participantUserIds],
      startsAt: new Date(this.startsAt),
      endsAt: new Date(this.endsAt),
      nextSubmissionSeq: this.nextSubmissionSeq,
      submissions: [...this.submissions.values()]
        .sort((a, b) => a.admissionSeq - b.admissionSeq)
        .map(cloneSubmission),
      result: this.result ? cloneResult(this.result) : null
    };
  }

  private tryResolveAccepted(serverNow: Date): MatchResult | null {
    const accepted = [...this.submissions.values()]
      .filter((submission) => submission.verdict === 'ACCEPTED')
      .sort((a, b) => a.admissionSeq - b.admissionSeq)[0];

    if (!accepted) return null;

    const hasEarlierPending = [...this.submissions.values()].some(
      (submission) =>
        submission.admissionSeq < accepted.admissionSeq &&
        !TERMINAL_VERDICTS.has(submission.verdict)
    );

    if (hasEarlierPending) {
      this.status = 'RESOLVING';
      return null;
    }

    return this.finish(
      'ACCEPTED',
      accepted.userId,
      serverNow,
      accepted.id
    );
  }

  private finish(
    reason: MatchResultReason,
    winnerUserId: string | null,
    serverNow: Date,
    winningSubmissionId: string | null
  ): MatchResult {
    this.status = 'FINISHED';
    this.result = {
      reason,
      winnerUserId,
      finishedAt: new Date(serverNow),
      winningSubmissionId
    };
    return cloneResult(this.result);
  }

  private hasPendingSubmissions(): boolean {
    return [...this.submissions.values()].some(
      (submission) => !TERMINAL_VERDICTS.has(submission.verdict)
    );
  }

  private requireParticipant(userId: string): void {
    if (!this.participantUserIds.includes(userId)) {
      throw new MatchRuleError('NOT_A_PARTICIPANT', 'User is not a match participant.');
    }
  }

  private requireSubmission(submissionId: string): MatchSubmission {
    const submission = this.submissions.get(submissionId);
    if (!submission) {
      throw new MatchRuleError('SUBMISSION_NOT_FOUND', 'Submission does not exist.');
    }
    return submission;
  }

  private requireStatus(expected: MatchStatus): void {
    if (this.status !== expected) {
      throw new MatchRuleError(
        'INVALID_TRANSITION',
        `Expected match status ${expected}, received ${this.status}.`
      );
    }
  }

  private isTerminal(): boolean {
    return this.status === 'FINISHED' || this.status === 'CANCELLED';
  }
}

function cloneSubmission(submission: MatchSubmission): MatchSubmission {
  return {
    ...submission,
    eligibleReceivedAt: new Date(submission.eligibleReceivedAt),
    finishedAt: submission.finishedAt ? new Date(submission.finishedAt) : null
  };
}

function cloneResult(result: MatchResult): MatchResult {
  return { ...result, finishedAt: new Date(result.finishedAt) };
}
