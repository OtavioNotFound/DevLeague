import type {
  ClaimedExecutionJob,
  ExecutionJobPort,
  ExecutionResult
} from '@devleague/application';
import type { Database } from '../postgres/database.js';
import { PracticeStore } from '../practice/practice-store.js';
import { MatchExecutionStore } from './match-execution-store.js';

export class ExecutionJobStore implements ExecutionJobPort {
  private readonly matches: MatchExecutionStore;
  private readonly practice: PracticeStore;

  constructor(private readonly database: Database) {
    this.matches = new MatchExecutionStore(database);
    this.practice = new PracticeStore(database);
  }

  async recoverStale(staleAfterSeconds: number): Promise<number> {
    const matchCount = await this.matches.recoverStale(staleAfterSeconds);
    const practiceCount = await this.practice.recoverStale(staleAfterSeconds);
    return matchCount + practiceCount;
  }

  async claimNext(): Promise<ClaimedExecutionJob | null> {
    return await this.matches.claimNext() ?? this.practice.claimNext();
  }

  async complete(jobId: string, result: ExecutionResult): Promise<void> {
    if (await this.isMatchJob(jobId)) return this.matches.complete(jobId, result);
    return this.practice.complete(jobId, result);
  }

  async retry(
    jobId: string,
    category: string,
    delayMs: number
  ): Promise<'REQUEUED' | 'EXHAUSTED'> {
    if (await this.isMatchJob(jobId)) return this.matches.retry(jobId, category, delayMs);
    return this.practice.retry(jobId, category, delayMs);
  }

  private async isMatchJob(jobId: string): Promise<boolean> {
    const [job] = await this.database<{ isMatch: boolean }[]>`
      select match_submission_id is not null as is_match
      from devleague.execution_job where id = ${jobId}
    `;
    return job?.isMatch ?? false;
  }
}
