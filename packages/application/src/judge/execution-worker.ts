import type { CodeExecutionPort } from './code-execution-port.js';
import type { ExecutionJobPort } from './execution-job-port.js';

export class ExecutionWorker {
  constructor(
    private readonly jobs: ExecutionJobPort,
    private readonly executor: CodeExecutionPort
  ) {}

  recoverStale(staleAfterSeconds = 60): Promise<number> {
    return this.jobs.recoverStale(staleAfterSeconds);
  }

  async runOnce(): Promise<'IDLE' | 'COMPLETED' | 'REQUEUED' | 'EXHAUSTED'> {
    const job = await this.jobs.claimNext();
    if (!job) return 'IDLE';

    try {
      const result = await this.executor.execute(job.request);
      if (result.providerFailure?.retryable) {
        return this.jobs.retry(
          job.jobId,
          result.providerFailure.category,
          retryDelayMs(job.attempt)
        );
      }
      await this.jobs.complete(job.jobId, result);
      return 'COMPLETED';
    } catch {
      return this.jobs.retry(job.jobId, 'ADAPTER_UNHANDLED_ERROR', retryDelayMs(job.attempt));
    }
  }
}

function retryDelayMs(attempt: number): number {
  return Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt - 1));
}
