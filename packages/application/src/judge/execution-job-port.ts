import type { ExecutionRequest, ExecutionResult } from './code-execution-port.js';

export interface ClaimedExecutionJob {
  readonly jobId: string;
  readonly attempt: number;
  readonly request: ExecutionRequest;
}

export interface ExecutionJobPort {
  recoverStale(staleAfterSeconds: number): Promise<number>;
  claimNext(): Promise<ClaimedExecutionJob | null>;
  complete(jobId: string, result: ExecutionResult): Promise<void>;
  retry(jobId: string, category: string, delayMs: number): Promise<'REQUEUED' | 'EXHAUSTED'>;
}
