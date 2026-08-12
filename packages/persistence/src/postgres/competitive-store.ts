import { randomUUID } from 'node:crypto';
import { settleElo } from '@devleague/domain';
import type {
  MatchResultReason,
  MatchStatus,
  MatchType,
  SubmissionVerdict
} from '@devleague/domain';
import type { TransactionSql } from 'postgres';
import type { Database } from './database.js';
import { StoreRuleError } from './store-errors.js';

type Transaction = TransactionSql<Record<string, never>>;
type TerminalVerdict = Exclude<SubmissionVerdict, 'QUEUED' | 'RUNNING'>;

interface MatchRow {
  id: string;
  type: MatchType;
  status: MatchStatus;
  startsAt: Date;
  endsAt: Date;
  finishedAt: Date | null;
  winnerUserId: string | null;
  resultReason: MatchResultReason | null;
  winningSubmissionId: string | null;
  nextSubmissionSeq: number;
}

interface ParticipantRow {
  userId: string;
  slot: number;
  currentRating: number;
}

interface SubmissionRow {
  id: string;
  matchId: string;
  userId: string;
  admissionSeq: number;
  requestHash: string;
  status: 'QUEUED' | 'RUNNING' | 'FINISHED';
  verdict: TerminalVerdict | null;
  eligibleReceivedAt: Date;
  finishedAt: Date | null;
}

interface CountRow {
  count: number;
}

export interface AdmittedSubmission {
  readonly id: string;
  readonly matchId: string;
  readonly userId: string;
  readonly admissionSeq: number;
  readonly eligibleReceivedAt: Date;
  readonly status: SubmissionRow['status'];
  readonly verdict: TerminalVerdict | null;
}

export interface PersistedRatingChange {
  readonly userId: string;
  readonly before: number;
  readonly delta: number;
  readonly after: number;
}

export interface PersistedMatchResult {
  readonly matchId: string;
  readonly reason: MatchResultReason;
  readonly winnerUserId: string | null;
  readonly winningSubmissionId: string | null;
  readonly finishedAt: Date;
  readonly ratingChanges: readonly PersistedRatingChange[];
}

export interface PersistedMatchSnapshot {
  readonly id: string;
  readonly type: MatchType;
  readonly status: MatchStatus;
  readonly serverNow: Date;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly version: number;
  readonly problem: {
    readonly versionId: string;
    readonly title: string;
    readonly statementMarkdown: string;
    readonly constraintsMarkdown: string;
  };
  readonly participants: readonly {
    readonly userId: string;
    readonly username: string;
    readonly submissions: number;
  }[];
  readonly mySubmissions: readonly AdmittedSubmission[];
  readonly result: PersistedMatchResult | null;
}

export class CompetitiveStore {
  constructor(private readonly database: Database) {}

  async provisionUser(userId: string, initialRating = 0): Promise<void> {
    await this.database.begin(async (transaction) => {
      await transaction`
        insert into devleague.app_user (id)
        values (${userId})
        on conflict (id) do nothing
      `;
      await transaction`
        insert into devleague.rating_account (
          user_id, current_rating, peak_rating, algorithm_version
        ) values (${userId}, ${initialRating}, ${initialRating}, 'elo-v1')
        on conflict (user_id) do nothing
      `;
    });
  }

  async provisionProblemVersion(input: {
    readonly problemId: string;
    readonly versionId: string;
    readonly title: string;
  }): Promise<void> {
    await this.database.begin(async (transaction) => {
      await transaction`
        insert into devleague.problem (id, slug, status)
        values (${input.problemId}, ${`problem-${input.problemId}`}, 'PUBLISHED')
        on conflict (id) do nothing
      `;
      await transaction`
        insert into devleague.problem_version (
          id, problem_id, version_number, title, competitive_eligible
        ) values (${input.versionId}, ${input.problemId}, 1, ${input.title}, true)
        on conflict (id) do nothing
      `;
    });
  }

  async createMatch(input: {
    readonly id: string;
    readonly type: MatchType;
    readonly problemVersionId: string;
    readonly participantUserIds: readonly [string, string];
    readonly startsAt: Date;
    readonly durationSeconds?: number;
    readonly originKey?: string;
  }): Promise<string> {
    const durationSeconds = input.durationSeconds ?? 600;
    const [firstUserId, secondUserId] = input.participantUserIds;

    return this.database.begin(async (transaction) => {
      const participants = await this.lockRatingAccounts(transaction, [firstUserId, secondUserId]);
      const ratingByUser = new Map(participants.map((participant) => [
        participant.userId,
        participant.currentRating
      ]));

      const inserted = await transaction<{ id: string }[]>`
        insert into devleague.match (
          id, type, status, problem_version_id, duration_seconds,
          starts_at, ends_at, rating_policy_version, origin_key
        ) values (
          ${input.id}, ${input.type}, 'ACTIVE', ${input.problemVersionId},
          ${durationSeconds}, ${input.startsAt},
          ${new Date(input.startsAt.getTime() + durationSeconds * 1_000)},
          ${input.type === 'RANKED_PUBLIC' ? 'elo-v1' : null}, ${input.originKey ?? null}
        )
        on conflict (origin_key) where origin_key is not null do nothing
        returning id
      `;
      if (inserted.length === 0) {
        const [existing] = await transaction<{ id: string }[]>`
          select id from devleague.match where origin_key = ${input.originKey ?? null}
        `;
        if (!existing) throw new Error('Match origin conflict could not be resolved.');
        return existing.id;
      }
      await transaction`
        insert into devleague.match_participant (
          match_id, user_id, slot, rating_snapshot
        ) values
          (${input.id}, ${firstUserId}, 1, ${ratingByUser.get(firstUserId) ?? null}),
          (${input.id}, ${secondUserId}, 2, ${ratingByUser.get(secondUserId) ?? null})
      `;
      await transaction`
        insert into devleague.active_engagement (user_id, match_id)
        values (${firstUserId}, ${input.id}), (${secondUserId}, ${input.id})
      `;
      await this.appendOutbox(transaction, {
        aggregateId: input.id,
        eventType: 'match.started',
        dedupeKey: `match.started:${input.id}`,
        payload: {
          matchId: input.id,
          type: input.type,
          startsAt: input.startsAt.toISOString()
        }
      });
      return input.id;
    });
  }

  async getSnapshot(matchId: string, userId: string): Promise<PersistedMatchSnapshot | null> {
    const [match] = await this.database<{
      id: string;
      type: MatchType;
      status: MatchStatus;
      serverNow: Date;
      startsAt: Date;
      endsAt: Date;
      version: number;
      problemVersionId: string;
      title: string;
      statementMarkdown: string;
      constraintsMarkdown: string;
      finishedAt: Date | null;
      winnerUserId: string | null;
      resultReason: MatchResultReason | null;
      winningSubmissionId: string | null;
    }[]>`
      select m.id, m.type, m.status, clock_timestamp() as server_now,
             m.starts_at, m.ends_at, m.version,
             pv.id as problem_version_id, pv.title,
             pv.statement_markdown, pv.constraints_markdown,
             m.finished_at, m.winner_user_id, m.result_reason, m.winning_submission_id
      from devleague.match m
      join devleague.problem_version pv on pv.id = m.problem_version_id
      join devleague.match_participant mine
        on mine.match_id = m.id and mine.user_id = ${userId}
      where m.id = ${matchId}
    `;
    if (!match) return null;

    const participants = await this.database<{
      userId: string;
      username: string;
      submissions: number;
    }[]>`
      select mp.user_id, p.username, count(s.id)::integer as submissions
      from devleague.match_participant mp
      join devleague.profile p on p.user_id = mp.user_id
      left join devleague.submission s
        on s.match_id = mp.match_id and s.user_id = mp.user_id
      where mp.match_id = ${matchId}
      group by mp.user_id, mp.slot, p.username
      order by mp.slot
    `;
    const submissions = await this.database<SubmissionRow[]>`
      select id, match_id, user_id, admission_seq, request_hash,
             status, verdict, eligible_received_at, finished_at
      from devleague.submission
      where match_id = ${matchId} and user_id = ${userId}
      order by admission_seq
    `;
    let result: PersistedMatchResult | null = null;
    if (match.status === 'FINISHED' && match.finishedAt && match.resultReason) {
      const changes = await this.database<PersistedRatingChange[]>`
        select user_id, rating_before as before, delta, rating_after as after
        from devleague.rating_history where match_id = ${matchId} order by user_id
      `;
      result = {
        matchId,
        reason: match.resultReason,
        winnerUserId: match.winnerUserId,
        winningSubmissionId: match.winningSubmissionId,
        finishedAt: match.finishedAt,
        ratingChanges: changes
      };
    }

    return {
      id: match.id,
      type: match.type,
      status: match.status,
      serverNow: match.serverNow,
      startsAt: match.startsAt,
      endsAt: match.endsAt,
      version: match.version,
      problem: {
        versionId: match.problemVersionId,
        title: match.title,
        statementMarkdown: match.statementMarkdown,
        constraintsMarkdown: match.constraintsMarkdown
      },
      participants,
      mySubmissions: submissions.map(toAdmittedSubmission),
      result
    };
  }

  async forfeit(matchId: string, userId: string): Promise<PersistedMatchResult> {
    return this.database.begin(async (transaction) => {
      const match = await this.lockMatch(transaction, matchId);
      const participants = await transaction<{ userId: string }[]>`
        select user_id from devleague.match_participant
        where match_id = ${matchId} order by slot
      `;
      if (!participants.some((participant) => participant.userId === userId)) {
        throw new StoreRuleError('NOT_A_PARTICIPANT', 'User is not a match participant.');
      }
      if (match.status === 'FINISHED') return this.toStoredResult(transaction, match);
      if (match.status === 'CANCELLED') {
        throw new StoreRuleError('MATCH_ALREADY_TERMINAL', 'Match is cancelled.');
      }
      const winner = participants.find((participant) => participant.userId !== userId);
      if (!winner) throw new Error('A match requires an opponent.');
      return this.finishMatch(transaction, match, {
        reason: 'FORFEIT',
        winnerUserId: winner.userId,
        winningSubmissionId: null
      });
    });
  }

  async admitSubmission(input: {
    readonly id: string;
    readonly matchId: string;
    readonly userId: string;
    readonly languageKey: 'python' | 'java' | 'javascript' | 'cpp';
    readonly runtimeVersion: string;
    readonly sourceRef: string;
    readonly source: string;
    readonly sourceSha256: string;
    readonly requestHash: string;
    readonly idempotencyKey: string;
  }): Promise<AdmittedSubmission> {
    return this.database.begin(async (transaction) => {
      const match = await this.lockMatch(transaction, input.matchId);
      if (match.status !== 'ACTIVE') {
        throw new StoreRuleError('MATCH_NOT_ACTIVE', 'The match is not accepting submissions.');
      }

      const [participant] = await transaction<{ exists: boolean }[]>`
        select true as exists
        from devleague.match_participant
        where match_id = ${input.matchId} and user_id = ${input.userId}
      `;
      if (!participant) {
        throw new StoreRuleError('NOT_A_PARTICIPANT', 'User is not a match participant.');
      }

      const [existing] = await transaction<SubmissionRow[]>`
        select id, match_id, user_id, admission_seq, request_hash,
               status, verdict, eligible_received_at, finished_at
        from devleague.submission
        where id = ${input.id}
           or (
             match_id = ${input.matchId}
             and user_id = ${input.userId}
             and idempotency_key = ${input.idempotencyKey}
           )
        limit 1
      `;
      if (existing) {
        if (existing.requestHash !== input.requestHash) {
          throw new StoreRuleError(
            'IDEMPOTENCY_KEY_REUSED',
            'The idempotency key was reused with a different request.'
          );
        }
        return toAdmittedSubmission(existing);
      }

      const [clock] = await transaction<{ receivedAt: Date }[]>`
        select clock_timestamp() as received_at
      `;
      if (!clock) throw new Error('PostgreSQL did not return its current clock.');
      if (clock.receivedAt.getTime() > match.endsAt.getTime()) {
        throw new StoreRuleError(
          'SUBMISSION_DEADLINE_PASSED',
          'PostgreSQL admitted the submission after the match deadline.'
        );
      }

      const admissionSeq = match.nextSubmissionSeq;
      await transaction`
        update devleague.match
        set next_submission_seq = next_submission_seq + 1,
            version = version + 1,
            updated_at = clock_timestamp()
        where id = ${input.matchId}
      `;
      const [submission] = await transaction<SubmissionRow[]>`
        insert into devleague.submission (
          id, match_id, user_id, admission_seq, language_key, runtime_version,
          source_ref, source_text, source_sha256, request_hash, idempotency_key,
          eligible_received_at
        ) values (
          ${input.id}, ${input.matchId}, ${input.userId}, ${admissionSeq},
          ${input.languageKey}, ${input.runtimeVersion}, ${input.sourceRef},
          ${input.source}, ${input.sourceSha256}, ${input.requestHash}, ${input.idempotencyKey},
          ${clock.receivedAt}
        )
        returning id, match_id, user_id, admission_seq, request_hash,
                  status, verdict, eligible_received_at, finished_at
      `;
      if (!submission) throw new Error('Submission insert returned no row.');

      const executionJobId = randomUUID();
      await transaction`
        insert into devleague.execution_job (
          id, practice_submission_id, match_submission_id, priority
        ) values (${executionJobId}, null, ${input.id}, 10)
      `;

      await this.appendOutbox(transaction, {
        aggregateId: input.matchId,
        eventType: 'submission.admitted',
        dedupeKey: `submission.admitted:${input.id}`,
        payload: {
          matchId: input.matchId,
          submissionId: input.id,
          userId: input.userId,
          admissionSeq
        }
      });
      await this.appendOutbox(transaction, {
        aggregateId: input.matchId,
        eventType: 'match.execution.requested',
        dedupeKey: `match.execution.requested:${input.id}`,
        payload: {
          matchId: input.matchId,
          submissionId: input.id,
          jobId: executionJobId
        }
      });

      return toAdmittedSubmission(submission);
    });
  }

  async markSubmissionRunning(submissionId: string): Promise<void> {
    const result = await this.database`
      update devleague.submission
      set status = 'RUNNING'
      where id = ${submissionId} and status = 'QUEUED'
    `;
    if (result.count === 0) {
      const [submission] = await this.database<{ status: string }[]>`
        select status from devleague.submission where id = ${submissionId}
      `;
      if (!submission) {
        throw new StoreRuleError('SUBMISSION_NOT_FOUND', 'Submission does not exist.');
      }
      if (submission.status === 'FINISHED') {
        throw new StoreRuleError(
          'SUBMISSION_ALREADY_TERMINAL',
          'A terminal submission cannot return to running.'
        );
      }
    }
  }

  async recordTerminalVerdict(input: {
    readonly submissionId: string;
    readonly verdict: TerminalVerdict;
  }): Promise<PersistedMatchResult | null> {
    return this.database.begin(async (transaction) => {
      const [identity] = await transaction<{ matchId: string }[]>`
        select match_id from devleague.submission where id = ${input.submissionId}
      `;
      if (!identity) {
        throw new StoreRuleError('SUBMISSION_NOT_FOUND', 'Submission does not exist.');
      }

      const match = await this.lockMatch(transaction, identity.matchId);
      const [submission] = await transaction<SubmissionRow[]>`
        select id, match_id, user_id, admission_seq, request_hash,
               status, verdict, eligible_received_at, finished_at
        from devleague.submission
        where id = ${input.submissionId}
        for update
      `;
      if (!submission) {
        throw new StoreRuleError('SUBMISSION_NOT_FOUND', 'Submission does not exist.');
      }

      if (submission.status === 'FINISHED') {
        if (submission.verdict !== input.verdict) {
          throw new StoreRuleError(
            'SUBMISSION_ALREADY_TERMINAL',
            'A terminal verdict cannot be replaced.'
          );
        }
      } else {
        await transaction`
          update devleague.submission
          set status = 'FINISHED', verdict = ${input.verdict},
              finished_at = clock_timestamp()
          where id = ${input.submissionId}
        `;
      }

      if (match.status === 'FINISHED') return this.toStoredResult(transaction, match);
      if (match.status === 'CANCELLED') return null;

      return this.resolveAcceptedCandidate(transaction, match);
    });
  }

  async reachDeadline(
    matchId: string,
    systemIntegrityCompromised = false
  ): Promise<PersistedMatchResult | null> {
    return this.database.begin(async (transaction) => {
      const match = await this.lockMatch(transaction, matchId);
      if (match.status === 'FINISHED') return this.toStoredResult(transaction, match);
      if (match.status === 'CANCELLED') {
        throw new StoreRuleError('MATCH_ALREADY_TERMINAL', 'The match is cancelled.');
      }

      const [clock] = await transaction<{ now: Date }[]>`
        select clock_timestamp() as now
      `;
      if (!clock) throw new Error('PostgreSQL did not return its current clock.');
      if (clock.now.getTime() < match.endsAt.getTime()) {
        throw new StoreRuleError('MATCH_NOT_ACTIVE', 'The match deadline was not reached.');
      }

      const accepted = await this.resolveAcceptedCandidate(transaction, match);
      if (accepted) return accepted;

      const pendingCount = await this.countPending(transaction, matchId);
      if (pendingCount > 0) {
        await this.markResolving(transaction, matchId);
        return null;
      }

      return this.finishMatch(transaction, match, {
        reason: systemIntegrityCompromised ? 'VOID_SYSTEM' : 'DRAW_TIMEOUT',
        winnerUserId: null,
        winningSubmissionId: null
      });
    });
  }

  private async resolveAcceptedCandidate(
    transaction: Transaction,
    match: MatchRow
  ): Promise<PersistedMatchResult | null> {
    const [candidate] = await transaction<SubmissionRow[]>`
      select id, match_id, user_id, admission_seq, request_hash,
             status, verdict, eligible_received_at, finished_at
      from devleague.submission
      where match_id = ${match.id} and verdict = 'ACCEPTED'
      order by admission_seq
      limit 1
    `;
    if (!candidate) return null;

    const [earlierPending] = await transaction<CountRow[]>`
      select count(*)::integer as count
      from devleague.submission
      where match_id = ${match.id}
        and admission_seq < ${candidate.admissionSeq}
        and status <> 'FINISHED'
    `;
    if ((earlierPending?.count ?? 0) > 0) {
      await this.markResolving(transaction, match.id);
      return null;
    }

    return this.finishMatch(transaction, match, {
      reason: 'ACCEPTED',
      winnerUserId: candidate.userId,
      winningSubmissionId: candidate.id
    });
  }

  private async finishMatch(
    transaction: Transaction,
    match: MatchRow,
    result: {
      readonly reason: MatchResultReason;
      readonly winnerUserId: string | null;
      readonly winningSubmissionId: string | null;
    }
  ): Promise<PersistedMatchResult> {
    const participants = await this.lockRatingAccountsForMatch(transaction, match.id);
    if (participants.length !== 2) throw new Error('A match must have exactly two participants.');
    const [first, second] = participants;
    if (!first || !second) throw new Error('A match must have exactly two ordered participants.');

    const winner = result.winnerUserId === first.userId
      ? 'FIRST'
      : result.winnerUserId === second.userId
        ? 'SECOND'
        : null;
    const settlement = settleElo({
      matchType: match.type,
      reason: result.reason,
      firstRating: first.currentRating,
      secondRating: second.currentRating,
      winner
    });
    const finishedAt = new Date();

    await transaction`
      update devleague.match
      set status = 'FINISHED', result_reason = ${result.reason},
          winner_user_id = ${result.winnerUserId},
          winning_submission_id = ${result.winningSubmissionId},
          finished_at = clock_timestamp(), updated_at = clock_timestamp(),
          version = version + 1
      where id = ${match.id}
    `;

    const changes: PersistedRatingChange[] = [];
    const entries = [
      { participant: first, change: settlement.first },
      { participant: second, change: settlement.second }
    ] as const;

    for (const entry of entries) {
      const participantResult = result.reason === 'VOID_SYSTEM'
        ? 'VOID'
        : winner === null
          ? 'DRAW'
          : entry.participant.userId === result.winnerUserId
            ? 'WIN'
            : 'LOSS';
      await transaction`
        update devleague.match_participant
        set result = ${participantResult}
        where match_id = ${match.id} and user_id = ${entry.participant.userId}
      `;

      if (!settlement.rated) continue;
      await transaction`
        update devleague.rating_account
        set current_rating = ${entry.change.after},
            peak_rating = greatest(peak_rating, ${entry.change.after}),
            games = games + 1,
            wins = wins + ${participantResult === 'WIN' ? 1 : 0},
            losses = losses + ${participantResult === 'LOSS' ? 1 : 0},
            draws = draws + ${participantResult === 'DRAW' ? 1 : 0},
            algorithm_version = ${entry.change.algorithmVersion},
            updated_at = clock_timestamp()
        where user_id = ${entry.participant.userId}
      `;
      await transaction`
        insert into devleague.rating_history (
          id, user_id, match_id, rating_before, expected_score,
          actual_score, delta, rating_after, algorithm_version
        ) values (
          ${randomUUID()}, ${entry.participant.userId}, ${match.id},
          ${entry.change.before}, ${entry.change.expectedScore},
          ${entry.change.actualScore}, ${entry.change.delta},
          ${entry.change.after}, ${entry.change.algorithmVersion}
        )
        on conflict (user_id, match_id) do nothing
      `;
      changes.push({
        userId: entry.participant.userId,
        before: entry.change.before,
        delta: entry.change.delta,
        after: entry.change.after
      });
    }

    await transaction`
      delete from devleague.active_engagement where match_id = ${match.id}
    `;
    await this.appendOutbox(transaction, {
      aggregateId: match.id,
      eventType: 'match.finished',
      dedupeKey: `match.finished:${match.id}`,
      payload: {
        matchId: match.id,
        reason: result.reason,
        winnerUserId: result.winnerUserId,
        winningSubmissionId: result.winningSubmissionId,
        ratingChanges: changes
      }
    });

    const [stored] = await transaction<{ finishedAt: Date }[]>`
      select finished_at from devleague.match where id = ${match.id}
    `;
    if (stored) finishedAt.setTime(stored.finishedAt.getTime());

    return {
      matchId: match.id,
      reason: result.reason,
      winnerUserId: result.winnerUserId,
      winningSubmissionId: result.winningSubmissionId,
      finishedAt,
      ratingChanges: changes
    };
  }

  private async toStoredResult(
    transaction: Transaction,
    match: MatchRow
  ): Promise<PersistedMatchResult> {
    if (!match.resultReason || !match.finishedAt) {
      throw new Error('A finished match is missing its persisted result.');
    }
    const changes = await transaction<PersistedRatingChange[]>`
      select user_id, rating_before as before, delta, rating_after as after
      from devleague.rating_history
      where match_id = ${match.id}
      order by user_id
    `;
    return {
      matchId: match.id,
      reason: match.resultReason,
      winnerUserId: match.winnerUserId,
      winningSubmissionId: match.winningSubmissionId,
      finishedAt: match.finishedAt,
      ratingChanges: [...changes]
    };
  }

  private async lockMatch(transaction: Transaction, matchId: string): Promise<MatchRow> {
    const [match] = await transaction<MatchRow[]>`
      select id, type, status, starts_at, ends_at, finished_at,
             winner_user_id, result_reason, winning_submission_id,
             next_submission_seq
      from devleague.match
      where id = ${matchId}
      for update
    `;
    if (!match) throw new StoreRuleError('MATCH_NOT_FOUND', 'Match does not exist.');
    return match;
  }

  private async lockRatingAccounts(
    transaction: Transaction,
    userIds: readonly string[]
  ): Promise<ParticipantRow[]> {
    const accounts = await transaction<ParticipantRow[]>`
      select user_id, 0::smallint as slot, current_rating
      from devleague.rating_account
      where user_id in ${transaction(userIds)}
      order by user_id
      for update
    `;
    if (accounts.length !== userIds.length) {
      throw new StoreRuleError('RATING_ACCOUNT_MISSING', 'A rating account is missing.');
    }
    return [...accounts];
  }

  private async lockRatingAccountsForMatch(
    transaction: Transaction,
    matchId: string
  ): Promise<ParticipantRow[]> {
    const participants = await transaction<ParticipantRow[]>`
      select participant.user_id, participant.slot, account.current_rating
      from devleague.match_participant participant
      join devleague.rating_account account on account.user_id = participant.user_id
      where participant.match_id = ${matchId}
      order by account.user_id
      for update of account
    `;
    return [...participants].sort((a, b) => a.slot - b.slot);
  }

  private async countPending(transaction: Transaction, matchId: string): Promise<number> {
    const [row] = await transaction<CountRow[]>`
      select count(*)::integer as count
      from devleague.submission
      where match_id = ${matchId} and status <> 'FINISHED'
    `;
    return row?.count ?? 0;
  }

  private async markResolving(transaction: Transaction, matchId: string): Promise<void> {
    await transaction`
      update devleague.match
      set status = 'RESOLVING', version = version + 1,
          updated_at = clock_timestamp()
      where id = ${matchId} and status = 'ACTIVE'
    `;
  }

  private async appendOutbox(
    transaction: Transaction,
    input: {
      readonly aggregateId: string;
      readonly eventType: string;
      readonly dedupeKey: string;
      readonly payload: Record<string, unknown>;
    }
  ): Promise<void> {
    await transaction`
      insert into devleague.outbox_event (
        id, aggregate_type, aggregate_id, event_type,
        schema_version, payload, dedupe_key
      ) values (
        ${randomUUID()}, 'match', ${input.aggregateId}, ${input.eventType},
        1, cast(${JSON.stringify(input.payload)} as jsonb), ${input.dedupeKey}
      )
      on conflict (dedupe_key) do nothing
    `;
  }
}

function toAdmittedSubmission(row: SubmissionRow): AdmittedSubmission {
  return {
    id: row.id,
    matchId: row.matchId,
    userId: row.userId,
    admissionSeq: row.admissionSeq,
    eligibleReceivedAt: row.eligibleReceivedAt,
    status: row.status,
    verdict: row.verdict
  };
}
