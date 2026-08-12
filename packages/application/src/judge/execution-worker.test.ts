import { describe, expect, it } from 'vitest';
import { DeterministicFakeCodeExecutionAdapter } from './deterministic-fake-adapter.js';
import { ExecutionWorker } from './execution-worker.js';
import type { ClaimedExecutionJob, ExecutionJobPort } from './execution-job-port.js';
import type { ExecutionResult } from './code-execution-port.js';

const request = {
  correlationId: 'job-1',
  runtime: { language: 'python' as const, version: '3.13' },
  source: 'print(1)',
  cases: [{ caseId: 'case-1', stdin: '', expectedOutput: '1\n' }],
  limits: {
    cpuMs: 1000, wallMs: 3000, memoryKb: 262144,
    processes: 8, outputBytes: 65536, fileBytes: 1048576
  },
  network: 'DENY' as const
};

class MemoryJobs implements ExecutionJobPort {
  completed: ExecutionResult | null = null;
  retries = 0;
  constructor(private job: ClaimedExecutionJob | null) {}
  recoverStale(): Promise<number> { return Promise.resolve(0); }
  claimNext(): Promise<ClaimedExecutionJob | null> {
    const claimed = this.job;
    this.job = null;
    return Promise.resolve(claimed);
  }
  complete(_jobId: string, result: ExecutionResult): Promise<void> {
    this.completed = result;
    return Promise.resolve();
  }
  retry(): Promise<'REQUEUED'> {
    this.retries += 1;
    return Promise.resolve('REQUEUED');
  }
}

describe('ExecutionWorker', () => {
  it('RF-JUDGE-005 completes a normalized result', async () => {
    const result: ExecutionResult = { verdict: 'ACCEPTED', usage: { cpuMs: 10 } };
    const jobs = new MemoryJobs({ jobId: 'job-1', attempt: 1, request });
    const worker = new ExecutionWorker(
      jobs,
      new DeterministicFakeCodeExecutionAdapter(new Map([['job-1', result]]))
    );

    await expect(worker.runOnce()).resolves.toBe('COMPLETED');
    expect(jobs.completed).toEqual(result);
  });

  it('RF-JUDGE-007 retries provider failures instead of producing Wrong Answer', async () => {
    const failure: ExecutionResult = {
      verdict: 'SYSTEM_ERROR', usage: {},
      providerFailure: { retryable: true, category: 'PROVIDER_TIMEOUT' }
    };
    const jobs = new MemoryJobs({ jobId: 'job-1', attempt: 1, request });
    const worker = new ExecutionWorker(
      jobs,
      new DeterministicFakeCodeExecutionAdapter(new Map([['job-1', failure]]))
    );

    await expect(worker.runOnce()).resolves.toBe('REQUEUED');
    expect(jobs.completed).toBeNull();
    expect(jobs.retries).toBe(1);
  });
});
