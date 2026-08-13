import { randomUUID } from 'node:crypto';
import type {
  ClaimedExecutionJob,
  ExecutionJobPort,
  ExecutionResult
} from '@devleague/application';
import type { Database } from '../postgres/database.js';
import { StoreRuleError } from '../postgres/store-errors.js';
import type { LanguageKey } from '../catalog/catalog-store.js';

export type PracticeKind = 'RUN' | 'SUBMIT';

export interface PracticeSubmissionRecord {
  readonly id: string;
  readonly userId: string;
  readonly problemVersionId: string;
  readonly kind: PracticeKind;
  readonly language: LanguageKey;
  readonly runtimeVersion: string;
  readonly status: 'QUEUED' | 'RUNNING' | 'FINISHED';
  readonly verdict: ExecutionResult['verdict'] | null;
  readonly stdout: string | null;
  readonly stderr: string | null;
  readonly compileOutput: string | null;
  readonly createdAt: Date;
  readonly finishedAt: Date | null;
}

export interface RecentPracticeSubmissionRecord extends PracticeSubmissionRecord {
  readonly problemTitle: string;
}

interface PracticeSubmissionRow extends PracticeSubmissionRecord {
  requestHash: string;
}

export class PracticeStore implements ExecutionJobPort {
  constructor(private readonly database: Database) {}

  async admit(input: {
    readonly id: string;
    readonly userId: string;
    readonly problemVersionId: string;
    readonly kind: PracticeKind;
    readonly language: LanguageKey;
    readonly runtimeVersion: string;
    readonly source: string;
    readonly sourceSha256: string;
    readonly customStdin?: string;
    readonly requestHash: string;
    readonly idempotencyKey: string;
  }): Promise<PracticeSubmissionRecord> {
    return this.database.begin(async (transaction) => {
      const [user] = await transaction<{ status: string }[]>`
        select status from devleague.app_user where id = ${input.userId}
      `;
      if (!user || user.status !== 'ACTIVE') {
        throw new StoreRuleError('USER_NOT_ELIGIBLE', 'User is not active.');
      }

      const [problem] = await transaction<{ exists: boolean }[]>`
        select true as exists
        from devleague.problem_version pv
        join devleague.problem p on p.id = pv.problem_id
        join devleague.starter_code sc
          on sc.problem_version_id = pv.id and sc.language_key = ${input.language}
        where pv.id = ${input.problemVersionId}
          and p.status = 'PUBLISHED' and pv.practice_visible = true
      `;
      if (!problem) throw new StoreRuleError('PROBLEM_NOT_AVAILABLE', 'Problem is unavailable.');

      const [existing] = await transaction<PracticeSubmissionRow[]>`
        select id, user_id, problem_version_id, kind, language_key as language,
               runtime_version, status, verdict, stdout, stderr, compile_output,
               request_hash, created_at, finished_at
        from devleague.practice_submission
        where user_id = ${input.userId} and kind = ${input.kind}
          and idempotency_key = ${input.idempotencyKey}
      `;
      if (existing) {
        if (existing.requestHash !== input.requestHash) {
          throw new StoreRuleError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key payload differs.');
        }
        return existing;
      }

      const limit = input.kind === 'RUN'
        ? positiveRateLimit(process.env.PRACTICE_RUN_RATE_LIMIT_PER_MINUTE, 10)
        : positiveRateLimit(process.env.PRACTICE_SUBMIT_RATE_LIMIT_PER_MINUTE, 5);
      const [recentSubmissions] = await transaction<{ count: number }[]>`
        select count(*)::integer as count from devleague.practice_submission
        where user_id = ${input.userId} and kind = ${input.kind}
          and created_at >= clock_timestamp() - interval '1 minute'
      `;
      if ((recentSubmissions?.count ?? 0) >= limit) {
        throw new StoreRuleError('SUBMISSION_RATE_LIMITED', 'Practice submission rate limit exceeded.');
      }

      const [submission] = await transaction<PracticeSubmissionRow[]>`
        insert into devleague.practice_submission (
          id, user_id, problem_version_id, kind, language_key, runtime_version,
          source_text, source_sha256, custom_stdin, request_hash, idempotency_key
        ) values (
          ${input.id}, ${input.userId}, ${input.problemVersionId}, ${input.kind},
          ${input.language}, ${input.runtimeVersion}, ${input.source}, ${input.sourceSha256},
          ${input.customStdin ?? null}, ${input.requestHash}, ${input.idempotencyKey}
        )
        returning id, user_id, problem_version_id, kind, language_key as language,
                  runtime_version, status, verdict, stdout, stderr, compile_output,
                  request_hash, created_at, finished_at
      `;
      if (!submission) throw new Error('Practice submission insert returned no row.');

      const jobId = randomUUID();
      await transaction`
        insert into devleague.execution_job (
          id, practice_submission_id, priority
        ) values (${jobId}, ${input.id}, ${input.kind === 'SUBMIT' ? 5 : 3})
      `;
      await transaction`
        insert into devleague.outbox_event (
          id, aggregate_type, aggregate_id, event_type, schema_version, payload, dedupe_key
        ) values (
          ${randomUUID()}, 'PracticeSubmission', ${input.id},
          'practice.execution.requested', 1,
          cast(${JSON.stringify({ submissionId: input.id, jobId })} as jsonb),
          ${`practice.execution.requested:${input.id}`}
        )
      `;
      return submission;
    });
  }

  async findOwned(submissionId: string, userId: string): Promise<PracticeSubmissionRecord | null> {
    const [submission] = await this.database<PracticeSubmissionRow[]>`
      select id, user_id, problem_version_id, kind, language_key as language,
             runtime_version, status, verdict, stdout, stderr, compile_output,
             request_hash, created_at, finished_at
      from devleague.practice_submission
      where id = ${submissionId} and user_id = ${userId}
    `;
    return submission ?? null;
  }

  async listRecent(userId: string, limit = 10): Promise<readonly RecentPracticeSubmissionRecord[]> {
    return this.database<RecentPracticeSubmissionRecord[]>`
      select ps.id, ps.user_id, ps.problem_version_id, ps.kind,
             ps.language_key as language, ps.runtime_version, ps.status,
             ps.verdict, ps.stdout, ps.stderr, ps.compile_output,
             ps.created_at, ps.finished_at, pv.title as problem_title
      from devleague.practice_submission ps
      join devleague.problem_version pv on pv.id = ps.problem_version_id
      where ps.user_id = ${userId}
        and ps.status = 'FINISHED'
        and ps.verdict is not null
      order by ps.created_at desc
      limit ${Math.max(1, Math.min(limit, 20))}
    `;
  }

  async recoverStale(staleAfterSeconds: number): Promise<number> {
    return this.database.begin(async (transaction) => {
      const recovered = await transaction<{ practiceSubmissionId: string }[]>`
        update devleague.execution_job
        set status = 'QUEUED', claimed_at = null,
            available_at = clock_timestamp(), updated_at = clock_timestamp(),
            provider_failure_category = 'STALE_CLAIM_RECOVERED'
        where status = 'RUNNING'
          and claimed_at < clock_timestamp() - (${staleAfterSeconds} * interval '1 second')
        returning practice_submission_id
      `;
      if (recovered.length > 0) {
        await transaction`
          update devleague.practice_submission
          set status = 'QUEUED'
          where id in ${transaction(recovered.map((row) => row.practiceSubmissionId))}
            and status = 'RUNNING'
        `;
      }
      return recovered.length;
    });
  }

  async claimNext(): Promise<ClaimedExecutionJob | null> {
    return this.database.begin(async (transaction) => {
      const [candidate] = await transaction<{
        jobId: string;
        attempt: number;
        submissionId: string;
        kind: PracticeKind;
        language: LanguageKey;
        runtimeVersion: string;
        source: string;
        customStdin: string | null;
        problemVersionId: string;
        cpuMs: number;
        wallMs: number;
        memoryKb: number;
        processes: number;
        outputBytes: number;
        fileBytes: number;
      }[]>`
        select ej.id as job_id, ej.attempt, ps.id as submission_id, ps.kind,
               ps.language_key as language, ps.runtime_version, ps.source_text as source,
               ps.custom_stdin, ps.problem_version_id,
               pv.cpu_ms, pv.wall_ms, pv.memory_kb, pv.processes,
               pv.output_bytes, pv.file_bytes
        from devleague.execution_job ej
        join devleague.practice_submission ps on ps.id = ej.practice_submission_id
        join devleague.problem_version pv on pv.id = ps.problem_version_id
        where ej.status = 'QUEUED' and ej.available_at <= clock_timestamp()
        order by ej.priority desc, ej.available_at, ej.created_at
        limit 1
        for update of ej skip locked
      `;
      if (!candidate) return null;

      await transaction`
        update devleague.execution_job
        set status = 'RUNNING', attempt = attempt + 1,
            claimed_at = clock_timestamp(), updated_at = clock_timestamp()
        where id = ${candidate.jobId}
      `;
      await transaction`
        update devleague.practice_submission set status = 'RUNNING'
        where id = ${candidate.submissionId} and status = 'QUEUED'
      `;

      const kind = candidate.kind === 'SUBMIT' ? 'PRIVATE' : 'PUBLIC';
      const persistedCases = candidate.kind === 'RUN' && candidate.customStdin !== null
        ? []
        : await transaction<{ id: string; stdin: string; expectedOutput: string }[]>`
            select id, input_text as stdin, expected_output_text as expected_output
            from devleague.test_case
            where problem_version_id = ${candidate.problemVersionId} and kind = ${kind}
            order by ordinal
          `;
      const cases = candidate.customStdin !== null
        ? [{ caseId: `custom:${candidate.submissionId}`, stdin: candidate.customStdin }]
        : persistedCases.map((testCase) => ({
            caseId: testCase.id,
            stdin: testCase.stdin,
            expectedOutput: testCase.expectedOutput
          }));

      return {
        jobId: candidate.jobId,
        attempt: candidate.attempt + 1,
        request: {
          correlationId: candidate.jobId,
          runtime: { language: candidate.language, version: candidate.runtimeVersion },
          source: candidate.source,
          cases,
          limits: {
            cpuMs: candidate.cpuMs,
            wallMs: candidate.wallMs,
            memoryKb: candidate.memoryKb,
            processes: candidate.processes,
            outputBytes: candidate.outputBytes,
            fileBytes: candidate.fileBytes
          },
          network: 'DENY'
        }
      };
    });
  }

  async complete(jobId: string, result: ExecutionResult): Promise<void> {
    await this.database.begin(async (transaction) => {
      const [job] = await transaction<{
        status: 'QUEUED' | 'RUNNING' | 'FINISHED';
        submissionId: string;
      }[]>`
        select status, practice_submission_id as submission_id
        from devleague.execution_job where id = ${jobId}
        for update
      `;
      if (!job) throw new StoreRuleError('EXECUTION_JOB_NOT_FOUND', 'Execution job not found.');
      if (job.status === 'FINISHED') return;
      if (job.status !== 'RUNNING') {
        throw new StoreRuleError('EXECUTION_JOB_NOT_RUNNING', 'Execution job is not claimed.');
      }

      await transaction`
        update devleague.execution_job
        set status = 'FINISHED', finished_at = clock_timestamp(),
            provider_failure_category = ${result.providerFailure?.category ?? null},
            updated_at = clock_timestamp()
        where id = ${jobId}
      `;
      await transaction`
        update devleague.practice_submission
        set status = 'FINISHED', verdict = ${result.verdict},
            stdout = ${truncateOutput(result.stdout)},
            stderr = ${truncateOutput(result.stderr)},
            compile_output = ${truncateOutput(result.compileOutput)},
            cpu_ms = ${result.usage.cpuMs ?? null},
            wall_ms = ${result.usage.wallMs ?? null},
            peak_memory_kb = ${result.usage.peakMemoryKb ?? null},
            finished_at = clock_timestamp()
        where id = ${job.submissionId}
      `;
      await transaction`
        update devleague.outbox_event set published_at = clock_timestamp()
        where dedupe_key = ${`practice.execution.requested:${job.submissionId}`}
          and published_at is null
      `;
    });
  }

  async retry(
    jobId: string,
    category: string,
    delayMs: number
  ): Promise<'REQUEUED' | 'EXHAUSTED'> {
    return this.database.begin(async (transaction) => {
      const [job] = await transaction<{
        status: 'QUEUED' | 'RUNNING' | 'FINISHED';
        attempt: number;
        submissionId: string;
      }[]>`
        select status, attempt, practice_submission_id as submission_id
        from devleague.execution_job where id = ${jobId}
        for update
      `;
      if (!job) throw new StoreRuleError('EXECUTION_JOB_NOT_FOUND', 'Execution job not found.');
      if (job.status === 'FINISHED') return 'EXHAUSTED';

      if (job.attempt >= 3) {
        await transaction`
          update devleague.execution_job
          set status = 'FINISHED', finished_at = clock_timestamp(),
              provider_failure_category = ${category}, updated_at = clock_timestamp()
          where id = ${jobId}
        `;
        await transaction`
          update devleague.practice_submission
          set status = 'FINISHED', verdict = 'SYSTEM_ERROR', finished_at = clock_timestamp()
          where id = ${job.submissionId}
        `;
        await transaction`
          update devleague.outbox_event set published_at = clock_timestamp()
          where dedupe_key = ${`practice.execution.requested:${job.submissionId}`}
            and published_at is null
        `;
        return 'EXHAUSTED';
      }

      await transaction`
        update devleague.execution_job
        set status = 'QUEUED', claimed_at = null,
            available_at = clock_timestamp() + (${delayMs} * interval '1 millisecond'),
            provider_failure_category = ${category}, updated_at = clock_timestamp()
        where id = ${jobId}
      `;
      await transaction`
        update devleague.practice_submission set status = 'QUEUED'
        where id = ${job.submissionId}
      `;
      return 'REQUEUED';
    });
  }
}

function truncateOutput(value: string | undefined): string | null {
  if (value === undefined) return null;
  return Buffer.from(value, 'utf8').subarray(0, 64 * 1024).toString('utf8');
}

function positiveRateLimit(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
