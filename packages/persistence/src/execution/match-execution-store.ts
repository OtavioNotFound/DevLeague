import type {
  ClaimedExecutionJob,
  ExecutionJobPort,
  ExecutionResult
} from '@devleague/application';
import { CompetitiveStore } from '../postgres/competitive-store.js';
import type { Database } from '../postgres/database.js';
import { StoreRuleError } from '../postgres/store-errors.js';

export class MatchExecutionStore implements ExecutionJobPort {
  private readonly matches: CompetitiveStore;

  constructor(private readonly database: Database) {
    this.matches = new CompetitiveStore(database);
  }

  async recoverStale(staleAfterSeconds: number): Promise<number> {
    return this.database.begin(async (transaction) => {
      await transaction`
        update devleague.execution_job ej
        set status = 'FINISHED', finished_at = coalesce(ej.finished_at, s.finished_at),
            verdict = s.verdict, updated_at = clock_timestamp()
        from devleague.submission s
        where ej.match_submission_id = s.id
          and ej.status <> 'FINISHED' and s.status = 'FINISHED'
      `;
      const recovered = await transaction`
        update devleague.execution_job ej
        set status = 'QUEUED', claimed_at = null,
            available_at = clock_timestamp(), updated_at = clock_timestamp(),
            provider_failure_category = 'STALE_CLAIM_RECOVERED'
        where ej.match_submission_id is not null and ej.status = 'RUNNING'
          and ej.claimed_at < clock_timestamp() - (${staleAfterSeconds} * interval '1 second')
      `;
      await transaction`
        update devleague.submission s set status = 'QUEUED'
        from devleague.execution_job ej
        where ej.match_submission_id = s.id and ej.status = 'QUEUED'
          and s.status = 'RUNNING'
      `;
      return recovered.count;
    });
  }

  async claimNext(): Promise<ClaimedExecutionJob | null> {
    return this.database.begin(async (transaction) => {
      const [candidate] = await transaction<{
        jobId: string;
        attempt: number;
        submissionId: string;
        language: 'python' | 'java' | 'javascript' | 'typescript' | 'lua' | 'cpp';
        runtimeVersion: string;
        source: string;
        problemVersionId: string;
        cpuMs: number;
        wallMs: number;
        memoryKb: number;
        processes: number;
        outputBytes: number;
        fileBytes: number;
      }[]>`
        select ej.id as job_id, ej.attempt, s.id as submission_id,
               s.language_key as language, s.runtime_version, s.source_text as source,
               m.problem_version_id, pv.cpu_ms, pv.wall_ms, pv.memory_kb,
               pv.processes, pv.output_bytes, pv.file_bytes
        from devleague.execution_job ej
        join devleague.submission s on s.id = ej.match_submission_id
        join devleague.match m on m.id = s.match_id
        join devleague.problem_version pv on pv.id = m.problem_version_id
        where ej.match_submission_id is not null and ej.status = 'QUEUED'
          and ej.available_at <= clock_timestamp() and s.status <> 'FINISHED'
        order by ej.priority desc, ej.available_at, ej.created_at
        limit 1
        for update of ej skip locked
      `;
      if (!candidate) return null;
      const cases = await transaction<{
        id: string;
        stdin: string;
        expectedOutput: string;
      }[]>`
        select id, input_text as stdin, expected_output_text as expected_output
        from devleague.test_case
        where problem_version_id = ${candidate.problemVersionId} and kind = 'PRIVATE'
        order by ordinal
      `;
      if (cases.length === 0) {
        throw new StoreRuleError('TEST_CASES_MISSING', 'Competitive problem has no private cases.');
      }

      await transaction`
        update devleague.execution_job
        set status = 'RUNNING', attempt = attempt + 1,
            claimed_at = clock_timestamp(), updated_at = clock_timestamp()
        where id = ${candidate.jobId}
      `;
      await transaction`
        update devleague.submission set status = 'RUNNING'
        where id = ${candidate.submissionId} and status = 'QUEUED'
      `;
      return {
        jobId: candidate.jobId,
        attempt: candidate.attempt + 1,
        request: {
          correlationId: candidate.jobId,
          runtime: { language: candidate.language, version: candidate.runtimeVersion },
          source: candidate.source,
          cases: cases.map((testCase) => ({
            caseId: testCase.id,
            stdin: testCase.stdin,
            expectedOutput: testCase.expectedOutput
          })),
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
    const [job] = await this.database<{
      status: string;
      submissionId: string;
    }[]>`
      select status, match_submission_id as submission_id
      from devleague.execution_job where id = ${jobId} and match_submission_id is not null
    `;
    if (!job) throw new StoreRuleError('EXECUTION_JOB_NOT_FOUND', 'Execution job not found.');
    if (job.status === 'FINISHED') return;

    await this.matches.recordTerminalVerdict({
      submissionId: job.submissionId,
      verdict: result.verdict
    });
    await this.database`
      update devleague.execution_job
      set status = 'FINISHED', verdict = ${result.verdict},
          cpu_ms = ${result.usage.cpuMs ?? null}, wall_ms = ${result.usage.wallMs ?? null},
          peak_memory_kb = ${result.usage.peakMemoryKb ?? null},
          provider_failure_category = ${result.providerFailure?.category ?? null},
          finished_at = clock_timestamp(), updated_at = clock_timestamp()
      where id = ${jobId} and status <> 'FINISHED'
    `;
    await this.database`
      update devleague.outbox_event set published_at = clock_timestamp()
      where dedupe_key = ${`match.execution.requested:${job.submissionId}`}
        and published_at is null
    `;
  }

  async retry(
    jobId: string,
    category: string,
    delayMs: number
  ): Promise<'REQUEUED' | 'EXHAUSTED'> {
    const [job] = await this.database<{
      status: string;
      attempt: number;
      submissionId: string;
    }[]>`
      select status, attempt, match_submission_id as submission_id
      from devleague.execution_job where id = ${jobId} and match_submission_id is not null
    `;
    if (!job) throw new StoreRuleError('EXECUTION_JOB_NOT_FOUND', 'Execution job not found.');
    if (job.status === 'FINISHED') return 'EXHAUSTED';

    if (job.attempt >= 3) {
      await this.complete(jobId, {
        verdict: 'SYSTEM_ERROR', usage: {},
        providerFailure: { retryable: false, category }
      });
      return 'EXHAUSTED';
    }
    await this.database.begin(async (transaction) => {
      await transaction`
        update devleague.execution_job
        set status = 'QUEUED', claimed_at = null,
            available_at = clock_timestamp() + (${delayMs} * interval '1 millisecond'),
            provider_failure_category = ${category}, updated_at = clock_timestamp()
        where id = ${jobId} and status = 'RUNNING'
      `;
      await transaction`
        update devleague.submission set status = 'QUEUED'
        where id = ${job.submissionId} and status = 'RUNNING'
      `;
    });
    return 'REQUEUED';
  }
}
