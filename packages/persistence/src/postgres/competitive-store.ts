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
import { CatalogStore, type CatalogProblemDetail } from '../catalog/catalog-store.js';

type Transaction = TransactionSql<Record<string, never>>;
type TerminalVerdict = Exclude<SubmissionVerdict, 'QUEUED' | 'RUNNING'>;

interface MatchRow {
  id: string;
  type: MatchType;
  status: MatchStatus;
  startsAt: Date;
  endsAt: Date;
  durationSeconds: number;
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
  readonly verification: 'AUTHORITATIVE_JUDGE' | 'BROWSER_PUBLIC_EXAMPLES' | 'SERVER_RULE';
  readonly ratingChanges: readonly PersistedRatingChange[];
}

export interface PersistedMatchSnapshot {
  readonly id: string;
  readonly currentUserId: string;
  readonly type: MatchType;
  readonly status: MatchStatus;
  readonly serverNow: Date;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly lobbyExpiresAt: Date | null;
  readonly version: number;
  readonly problem: CatalogProblemDetail | null;
  readonly participants: readonly {
    readonly userId: string;
    readonly username: string;
    readonly submissions: number;
    readonly ready: boolean;
  }[];
  readonly mySubmissions: readonly AdmittedSubmission[];
  readonly result: PersistedMatchResult | null;
}

export interface MatchLifecycleProgress {
  readonly activated: number;
  readonly reachedDeadline: number;
  readonly voidedAfterGrace: number;
  readonly cancelledLobbies: number;
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
    readonly lobbyTimeoutSeconds?: number;
    readonly originKey?: string;
  }): Promise<string> {
    const durationSeconds = input.durationSeconds ?? 600;
    const lobbyTimeoutSeconds = input.lobbyTimeoutSeconds ?? 120;
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
          starts_at, ends_at, lobby_expires_at, rating_policy_version, origin_key
        ) values (
          ${input.id}, ${input.type}, 'COUNTDOWN', ${input.problemVersionId},
          ${durationSeconds}, ${input.startsAt},
          ${new Date(input.startsAt.getTime() + durationSeconds * 1_000)},
          clock_timestamp() + (${lobbyTimeoutSeconds} * interval '1 second'),
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
        eventType: 'match.lobby_created',
        dedupeKey: `match.lobby_created:${input.id}`,
        payload: {
          matchId: input.id,
          type: input.type,
          startsAt: input.startsAt.toISOString()
        }
      });
      return input.id;
    });
  }

  async advanceLifecycle(input: {
    readonly resolutionGraceSeconds?: number;
    readonly batchSize?: number;
  } = {}): Promise<MatchLifecycleProgress> {
    const resolutionGraceSeconds = input.resolutionGraceSeconds ?? 60;
    const batchSize = input.batchSize ?? 50;
    const activatedIds = await this.database.begin(async (transaction) => {
      const due = await transaction<{ id: string; startsAt: Date }[]>`
        select m.id, m.starts_at
        from devleague.match m
        where m.status = 'COUNTDOWN' and m.starts_at <= clock_timestamp()
          and not exists (
            select 1 from devleague.match_participant mp
            where mp.match_id = m.id and mp.ready_at is null
          )
        order by starts_at
        limit ${batchSize}
        for update skip locked
      `;
      for (const match of due) {
        await transaction`
          update devleague.match
          set status = 'ACTIVE', version = version + 1,
              updated_at = clock_timestamp()
          where id = ${match.id} and status = 'COUNTDOWN'
        `;
        await this.appendOutbox(transaction, {
          aggregateId: match.id,
          eventType: 'match.started',
          dedupeKey: `match.started:${match.id}`,
          payload: { matchId: match.id, startsAt: match.startsAt.toISOString() }
        });
      }
      return due.map((match) => match.id);
    });

    const cancelledLobbies = await this.database.begin(async (transaction) => {
      const expired = await transaction<{ id: string }[]>`
        select id from devleague.match
        where status = 'COUNTDOWN' and lobby_expires_at <= clock_timestamp()
        order by lobby_expires_at
        limit ${batchSize}
        for update skip locked
      `;
      for (const match of expired) {
        await transaction`
          update devleague.match
          set status = 'CANCELLED', version = version + 1,
              updated_at = clock_timestamp()
          where id = ${match.id} and status = 'COUNTDOWN'
        `;
        await transaction`delete from devleague.active_engagement where match_id = ${match.id}`;
        await this.appendOutbox(transaction, {
          aggregateId: match.id,
          eventType: 'match.cancelled',
          dedupeKey: `match.cancelled:lobby-timeout:${match.id}`,
          payload: { matchId: match.id, reason: 'LOBBY_TIMEOUT' }
        });
      }
      return expired.length;
    });

    const deadlineIds = await this.database<{ id: string }[]>`
      select id from devleague.match
      where status = 'ACTIVE' and ends_at <= clock_timestamp()
      order by ends_at
      limit ${batchSize}
    `;
    let reachedDeadline = 0;
    for (const match of deadlineIds) {
      try {
        await this.reachDeadline(match.id);
        reachedDeadline += 1;
      } catch (error: unknown) {
        if (!(error instanceof StoreRuleError) || (
          error.code !== 'MATCH_ALREADY_TERMINAL' && error.code !== 'MATCH_NOT_ACTIVE'
        )) throw error;
      }
    }

    const staleIds = await this.database<{ id: string }[]>`
      select id from devleague.match
      where status = 'RESOLVING'
        and ends_at + (${resolutionGraceSeconds} * interval '1 second') <= clock_timestamp()
      order by ends_at
      limit ${batchSize}
    `;
    let voidedAfterGrace = 0;
    for (const match of staleIds) {
      if (await this.voidStaleResolvingMatch(match.id, resolutionGraceSeconds)) {
        voidedAfterGrace += 1;
      }
    }

    return { activated: activatedIds.length, reachedDeadline, voidedAfterGrace, cancelledLobbies };
  }

  async markReady(matchId: string, userId: string, countdownSeconds = 5): Promise<void> {
    await this.database.begin(async (transaction) => {
      const match = await this.lockMatch(transaction, matchId);
      const [participant] = await transaction<{ readyAt: Date | null }[]>`
        select ready_at from devleague.match_participant
        where match_id = ${matchId} and user_id = ${userId}
        for update
      `;
      if (!participant) throw new StoreRuleError('NOT_A_PARTICIPANT', 'User is not a match participant.');
      if (match.status !== 'COUNTDOWN') return;
      if (participant.readyAt) return;

      const [clock] = await transaction<{ now: Date }[]>`select clock_timestamp() as now`;
      if (!clock) throw new Error('PostgreSQL did not return its current clock.');
      const [lobby] = await transaction<{ lobbyExpiresAt: Date | null }[]>`
        select lobby_expires_at from devleague.match where id = ${matchId}
      `;
      if (lobby?.lobbyExpiresAt && lobby.lobbyExpiresAt.getTime() <= clock.now.getTime()) {
        throw new StoreRuleError('LOBBY_EXPIRED', 'The match lobby has expired.');
      }
      await transaction`
        update devleague.match_participant set ready_at = clock_timestamp()
        where match_id = ${matchId} and user_id = ${userId}
      `;
      await transaction`
        update devleague.match
        set version = version + 1, updated_at = clock_timestamp()
        where id = ${matchId} and status = 'COUNTDOWN'
      `;
      await this.appendOutbox(transaction, {
        aggregateId: matchId,
        eventType: 'match.participant_ready',
        dedupeKey: `match.participant_ready:${matchId}:${userId}`,
        payload: { matchId, userId }
      });
      const [ready] = await transaction<CountRow[]>`
        select count(*)::integer as count from devleague.match_participant
        where match_id = ${matchId} and ready_at is not null
      `;
      if ((ready?.count ?? 0) !== 2) return;

      const startsAt = new Date(clock.now.getTime() + Math.max(0, countdownSeconds) * 1_000);
      await transaction`
        update devleague.match
        set starts_at = ${startsAt},
            ends_at = ${new Date(startsAt.getTime() + match.durationSeconds * 1_000)},
            lobby_expires_at = null,
            version = version + 1, updated_at = clock_timestamp()
        where id = ${matchId} and status = 'COUNTDOWN'
      `;
      await this.appendOutbox(transaction, {
        aggregateId: matchId,
        eventType: 'match.countdown_started',
        dedupeKey: `match.countdown_started:${matchId}`,
        payload: { matchId, startsAt: startsAt.toISOString() }
      });
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
      lobbyExpiresAt: Date | null;
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
             m.starts_at, m.ends_at, m.lobby_expires_at, m.version,
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
      ready: boolean;
    }[]>`
      select mp.user_id, p.username, count(s.id)::integer as submissions,
             (mp.ready_at is not null) as ready
      from devleague.match_participant mp
      join devleague.profile p on p.user_id = mp.user_id
      left join devleague.submission s
        on s.match_id = mp.match_id and s.user_id = mp.user_id
      where mp.match_id = ${matchId}
      group by mp.user_id, mp.slot, p.username, mp.ready_at
      order by mp.slot
    `;
    const allParticipantsReady = participants.length === 2 && participants.every((participant) => participant.ready);
    let problem: CatalogProblemDetail | null = null;
    if (allParticipantsReady || match.status === 'ACTIVE' || match.status === 'RESOLVING' || match.status === 'FINISHED') {
      problem = await new CatalogStore(this.database).getPublicVersion(match.problemVersionId);
      if (!problem) throw new Error('A match references a missing problem version.');
    }
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
      const verification = await this.resultVerification(
        this.database,
        match.winningSubmissionId
      );
      result = {
        matchId,
        reason: match.resultReason,
        winnerUserId: match.winnerUserId,
        winningSubmissionId: match.winningSubmissionId,
        finishedAt: match.finishedAt,
        verification,
        ratingChanges: changes
      };
    }

    return {
      id: match.id,
      currentUserId: userId,
      type: match.type,
      status: match.status,
      serverNow: match.serverNow,
      startsAt: match.startsAt,
      endsAt: match.endsAt,
      lobbyExpiresAt: match.lobbyExpiresAt,
      version: match.version,
      problem,
      participants,
      mySubmissions: submissions.map(toAdmittedSubmission),
      result
    };
  }

  async forfeit(matchId: string, userId: string): Promise<PersistedMatchResult> {
    return this.database.begin(async (transaction) => {
      let match = await this.lockMatch(transaction, matchId);
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
      match = await this.activateIfDue(transaction, match);
      if (match.status !== 'ACTIVE') {
        throw new StoreRuleError('MATCH_NOT_ACTIVE', 'The match is not active and cannot be forfeited.');
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
    readonly languageKey: 'python' | 'java' | 'javascript' | 'typescript' | 'lua' | 'cpp';
    readonly runtimeVersion: string;
    readonly sourceRef: string;
    readonly source: string;
    readonly sourceSha256: string;
    readonly requestHash: string;
    readonly idempotencyKey: string;
  }): Promise<AdmittedSubmission> {
    return this.database.begin(async (transaction) => {
      let match = await this.lockMatch(transaction, input.matchId);

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
      const [recentSubmissions] = await transaction<CountRow[]>`
        select count(*)::integer as count from devleague.submission
        where match_id = ${input.matchId} and user_id = ${input.userId}
          and eligible_received_at >= ${new Date(clock.receivedAt.getTime() - 60_000)}
      `;
      if ((recentSubmissions?.count ?? 0) >= positiveRateLimit(process.env.MATCH_SUBMIT_RATE_LIMIT_PER_MINUTE, 5)) {
        throw new StoreRuleError('SUBMISSION_RATE_LIMITED', 'Competitive submission rate limit exceeded.');
      }
      match = await this.activateIfDue(transaction, match, clock.receivedAt);
      if (match.status !== 'ACTIVE') {
        throw new StoreRuleError('MATCH_NOT_ACTIVE', 'The match is not accepting submissions.');
      }
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

  async admitBrowserVerifiedSubmission(input: {
    readonly id: string;
    readonly matchId: string;
    readonly userId: string;
    readonly languageKey: 'python' | 'javascript' | 'typescript' | 'lua' | 'cpp';
    readonly runtimeVersion: string;
    readonly source: string;
    readonly sourceSha256: string;
    readonly publicExampleIds: readonly string[];
    readonly requestHash: string;
    readonly idempotencyKey: string;
  }): Promise<AdmittedSubmission> {
    return this.database.begin(async (transaction) => {
      let match = await this.lockMatch(transaction, input.matchId);
      if (match.type !== 'UNRANKED_PUBLIC') {
        throw new StoreRuleError(
          'BROWSER_VERIFICATION_NOT_ALLOWED',
          'Browser verification is restricted to public unranked matches.'
        );
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

      const [problem] = await transaction<{ exampleIds: string[] }[]>`
        select coalesce(
          array_agg(tc.id::text order by tc.ordinal)
            filter (where tc.id is not null),
          array[]::text[]
        ) as example_ids
        from devleague.match m
        left join devleague.test_case tc
          on tc.problem_version_id = m.problem_version_id and tc.kind = 'PUBLIC'
        where m.id = ${input.matchId}
        group by m.id
      `;
      if (!problem || problem.exampleIds.length === 0 ||
          !sameOrderedValues(problem.exampleIds, input.publicExampleIds)) {
        throw new StoreRuleError(
          'PUBLIC_EXAMPLES_STALE',
          'The browser result does not cover the current public examples.'
        );
      }

      const [clock] = await transaction<{ receivedAt: Date }[]>`
        select clock_timestamp() as received_at
      `;
      if (!clock) throw new Error('PostgreSQL did not return its current clock.');
      const [recentSubmissions] = await transaction<CountRow[]>`
        select count(*)::integer as count from devleague.submission
        where match_id = ${input.matchId} and user_id = ${input.userId}
          and eligible_received_at >= ${new Date(clock.receivedAt.getTime() - 60_000)}
      `;
      if ((recentSubmissions?.count ?? 0) >= positiveRateLimit(process.env.MATCH_SUBMIT_RATE_LIMIT_PER_MINUTE, 5)) {
        throw new StoreRuleError('SUBMISSION_RATE_LIMITED', 'Casual submission rate limit exceeded.');
      }
      match = await this.activateIfDue(transaction, match, clock.receivedAt);
      if (match.status !== 'ACTIVE') {
        throw new StoreRuleError('MATCH_NOT_ACTIVE', 'The match is not accepting submissions.');
      }
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
          status, verdict, eligible_received_at, finished_at
        ) values (
          ${input.id}, ${input.matchId}, ${input.userId}, ${admissionSeq},
          ${input.languageKey}, ${input.runtimeVersion},
          ${`browser-wasm:public-examples:${input.publicExampleIds.length}`},
          ${input.source}, ${input.sourceSha256}, ${input.requestHash}, ${input.idempotencyKey},
          'FINISHED', 'ACCEPTED', ${clock.receivedAt}, ${clock.receivedAt}
        )
        returning id, match_id, user_id, admission_seq, request_hash,
                  status, verdict, eligible_received_at, finished_at
      `;
      if (!submission) throw new Error('Submission insert returned no row.');

      await this.appendOutbox(transaction, {
        aggregateId: input.matchId,
        eventType: 'submission.browser_examples_accepted',
        dedupeKey: `submission.browser_examples_accepted:${input.id}`,
        payload: {
          matchId: input.matchId,
          submissionId: input.id,
          userId: input.userId,
          admissionSeq,
          verification: 'BROWSER_PUBLIC_EXAMPLES'
        }
      });
      await this.resolveAcceptedCandidate(transaction, match);
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

      const result = await this.resolveAcceptedCandidate(transaction, match);
      if (result || match.status !== 'RESOLVING') return result;
      if (await this.countPending(transaction, match.id) > 0) return null;
      return this.finishMatch(transaction, match, {
        reason: 'DRAW_TIMEOUT', winnerUserId: null, winningSubmissionId: null
      });
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

  private async voidStaleResolvingMatch(
    matchId: string,
    resolutionGraceSeconds: number
  ): Promise<PersistedMatchResult | null> {
    return this.database.begin(async (transaction) => {
      const match = await this.lockMatch(transaction, matchId);
      if (match.status === 'FINISHED' || match.status === 'CANCELLED') return null;
      if (match.status !== 'RESOLVING') return null;

      const [clock] = await transaction<{ now: Date }[]>`select clock_timestamp() as now`;
      if (!clock || clock.now.getTime() < match.endsAt.getTime() + resolutionGraceSeconds * 1_000) {
        return null;
      }

      const resolved = await this.resolveAcceptedCandidate(transaction, match);
      if (resolved) return resolved;
      const pendingCount = await this.countPending(transaction, matchId);
      if (pendingCount === 0) {
        return this.finishMatch(transaction, match, {
          reason: 'DRAW_TIMEOUT', winnerUserId: null, winningSubmissionId: null
        });
      }

      await transaction`
        update devleague.submission
        set status = 'FINISHED', verdict = 'SYSTEM_ERROR',
            finished_at = clock_timestamp()
        where match_id = ${matchId} and status <> 'FINISHED'
      `;
      await transaction`
        update devleague.execution_job ej
        set status = 'FINISHED', claimed_at = coalesce(claimed_at, clock_timestamp()),
            finished_at = clock_timestamp(), verdict = 'SYSTEM_ERROR',
            provider_failure_category = 'MATCH_RESOLUTION_GRACE_EXCEEDED',
            updated_at = clock_timestamp()
        from devleague.submission s
        where ej.match_submission_id = s.id and s.match_id = ${matchId}
          and ej.status <> 'FINISHED'
      `;
      return this.finishMatch(transaction, match, {
        reason: 'VOID_SYSTEM', winnerUserId: null, winningSubmissionId: null
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
      verification: await this.resultVerification(transaction, result.winningSubmissionId),
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
      verification: await this.resultVerification(transaction, match.winningSubmissionId),
      ratingChanges: [...changes]
    };
  }

  private async resultVerification(
    sql: Database | Transaction,
    winningSubmissionId: string | null
  ): Promise<PersistedMatchResult['verification']> {
    if (!winningSubmissionId) return 'SERVER_RULE';
    const [submission] = await sql<{ sourceRef: string }[]>`
      select source_ref from devleague.submission where id = ${winningSubmissionId}
    `;
    return submission?.sourceRef.startsWith('browser-wasm:')
      ? 'BROWSER_PUBLIC_EXAMPLES'
      : 'AUTHORITATIVE_JUDGE';
  }

  private async lockMatch(transaction: Transaction, matchId: string): Promise<MatchRow> {
    const [match] = await transaction<MatchRow[]>`
      select id, type, status, starts_at, ends_at, duration_seconds, finished_at,
             winner_user_id, result_reason, winning_submission_id,
             next_submission_seq
      from devleague.match
      where id = ${matchId}
      for update
    `;
    if (!match) throw new StoreRuleError('MATCH_NOT_FOUND', 'Match does not exist.');
    return match;
  }

  private async activateIfDue(
    transaction: Transaction,
    match: MatchRow,
    serverNow?: Date
  ): Promise<MatchRow> {
    if (match.status !== 'COUNTDOWN') return match;
    const now = serverNow ?? (await transaction<{ now: Date }[]>`
      select clock_timestamp() as now
    `)[0]?.now;
    if (!now || now.getTime() < match.startsAt.getTime()) return match;
    const [readiness] = await transaction<CountRow[]>`
      select count(*)::integer as count from devleague.match_participant
      where match_id = ${match.id} and ready_at is not null
    `;
    if ((readiness?.count ?? 0) !== 2) return match;

    await transaction`
      update devleague.match
      set status = 'ACTIVE', version = version + 1,
          updated_at = clock_timestamp()
      where id = ${match.id} and status = 'COUNTDOWN'
    `;
    await this.appendOutbox(transaction, {
      aggregateId: match.id,
      eventType: 'match.started',
      dedupeKey: `match.started:${match.id}`,
      payload: { matchId: match.id, startsAt: match.startsAt.toISOString() }
    });
    return { ...match, status: 'ACTIVE' };
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

function positiveRateLimit(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sameOrderedValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
