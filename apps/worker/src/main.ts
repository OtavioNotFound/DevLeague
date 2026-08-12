import {
  DeterministicFakeCodeExecutionAdapter,
  ExecutionWorker,
  type CodeExecutionPort
} from '@devleague/application';
import { closeDatabase, createDatabase, ExecutionJobStore } from '@devleague/persistence';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required by the execution worker.');

  const database = createDatabase(databaseUrl);
  const jobs = new ExecutionJobStore(database);
  const worker = new ExecutionWorker(jobs, createExecutionAdapter());
  const pollMs = readPositiveInteger(process.env.WORKER_POLL_MS, 250);
  let running = true;
  const stop = (): void => { running = false; };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    const recovered = await worker.recoverStale(60);
    log('worker.started', { recovered });
    while (running) {
      const outcome = await worker.runOnce();
      if (outcome === 'IDLE') await delay(pollMs);
    }
  } finally {
    await closeDatabase(database);
    log('worker.stopped');
  }
}

function createExecutionAdapter(): CodeExecutionPort {
  const provider = process.env.JUDGE_PROVIDER;
  if (provider === 'fake' && process.env.NODE_ENV !== 'production') {
    const fallback = process.env.FAKE_JUDGE_DEFAULT === 'accepted' ? 'ACCEPTED' : 'SYSTEM_ERROR';
    return new DeterministicFakeCodeExecutionAdapter(new Map(), fallback);
  }
  throw new Error(
    'No execution provider configured. Only JUDGE_PROVIDER=fake outside production is available.'
  );
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function log(event: string, details: Readonly<Record<string, unknown>> = {}): void {
  process.stdout.write(`${JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    service: 'devleague-worker',
    event,
    ...details
  })}\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'error',
    service: 'devleague-worker',
    event: 'worker.fatal',
    errorType: error instanceof Error ? error.name : 'UnknownError'
  })}\n`);
  process.exitCode = 1;
});
