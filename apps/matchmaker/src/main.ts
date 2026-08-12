import { MatchmakingCoordinator } from '@devleague/application';
import { closeDatabase, createDatabase, RankedMatchFactory } from '@devleague/persistence';
import {
  closeRedisClient,
  createRedisClient,
  RedisMatchmakingQueue
} from '@devleague/redis-infrastructure';

async function main(): Promise<void> {
  if (process.env.MATCHMAKING_ENABLED !== 'true') {
    throw new Error('MATCHMAKING_ENABLED=true is required to start the matchmaker.');
  }
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;
  if (!databaseUrl || !redisUrl) throw new Error('DATABASE_URL and REDIS_URL are required.');

  const database = createDatabase(databaseUrl);
  const redis = await createRedisClient(redisUrl);
  const coordinator = new MatchmakingCoordinator(
    new RedisMatchmakingQueue(redis),
    new RankedMatchFactory(database)
  );
  const region = process.env.MATCHMAKING_REGION ?? 'br-sa-east';
  const pollMs = positiveInteger(process.env.MATCHMAKER_POLL_MS, 100);
  let running = true;
  const stop = (): void => { running = false; };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    while (running) {
      const matchId = await coordinator.runOnce(region);
      if (matchId) log('match.created', { matchId, region });
      else await delay(pollMs);
    }
  } finally {
    await Promise.all([closeDatabase(database), closeRedisClient(redis)]);
  }
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function log(event: string, details: Readonly<Record<string, unknown>>): void {
  process.stdout.write(`${JSON.stringify({
    timestamp: new Date().toISOString(), level: 'info',
    service: 'devleague-matchmaker', event, ...details
  })}\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify({
    timestamp: new Date().toISOString(), level: 'error',
    service: 'devleague-matchmaker', event: 'matchmaker.fatal',
    errorType: error instanceof Error ? error.name : 'UnknownError'
  })}\n`);
  process.exitCode = 1;
});
