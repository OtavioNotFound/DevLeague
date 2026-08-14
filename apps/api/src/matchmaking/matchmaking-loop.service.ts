import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { MatchmakingCoordinator } from '@devleague/application';
import { RankedMatchFactory } from '@devleague/persistence';
import { DatabaseService } from '../database/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import { MatchmakingWakeSignalService } from './matchmaking-wake-signal.service.js';

const MINIMUM_RECOVERY_INTERVAL_MS = 30_000;
const MAXIMUM_RETRY_INTERVAL_MS = 60_000;

@Injectable()
export class MatchmakingLoopService implements OnModuleInit, OnModuleDestroy {
  private running = false;
  private loop: Promise<void> | undefined;

  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
    private readonly wakeSignal: MatchmakingWakeSignalService
  ) {}

  onModuleInit(): void {
    if (process.env.MATCHMAKING_ENABLED !== 'true' ||
        process.env.MATCHMAKING_EMBEDDED !== 'true' ||
        !hasEnabledExecutionMode()) return;
    this.running = true;
    this.loop = this.run();
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    this.wakeSignal.wake();
    await this.loop;
  }

  private async run(): Promise<void> {
    const coordinator = new MatchmakingCoordinator(
      await this.redis.matchmakingQueue(),
      new RankedMatchFactory(this.database.connection)
    );
    const region = process.env.MATCHMAKING_REGION ?? 'br-sa-east';
    const recoveryIntervalMs = matchmakingRecoveryInterval(process.env);
    let consecutiveFailures = 0;
    while (this.running) {
      const wakeSnapshot = this.wakeSignal.snapshot();
      try {
        let matchId: string | null = null;
        const modes = process.env.RANKED_MATCHMAKING_ENABLED === 'true' &&
          process.env.COMPETITIVE_EXECUTION_ENABLED === 'true'
          ? (['RANKED', 'UNRANKED'] as const)
          : (['UNRANKED'] as const);
        for (const mode of modes) {
          matchId = await coordinator.runOnce(region, mode);
          if (matchId) {
            log('match.created', { matchId, region, mode });
            break;
          }
        }
        consecutiveFailures = 0;
        if (!matchId) {
          await this.wakeSignal.waitForChange(wakeSnapshot, recoveryIntervalMs);
        }
      } catch (error: unknown) {
        consecutiveFailures += 1;
        const retryMs = matchmakingRetryDelay(consecutiveFailures);
        log('matchmaking.error', {
          errorType: error instanceof Error ? error.name : 'UnknownError',
          retryMs
        });
        await delay(retryMs);
      }
    }
  }
}

export function matchmakingRecoveryInterval(
  environment: Readonly<Record<string, string | undefined>> = process.env
): number {
  return Math.max(
    positiveInteger(environment.MATCHMAKER_RECOVERY_MS ?? environment.MATCHMAKER_POLL_MS, 30_000),
    MINIMUM_RECOVERY_INTERVAL_MS
  );
}

export function matchmakingRetryDelay(consecutiveFailures: number): number {
  const exponent = Math.max(0, Math.min(consecutiveFailures - 1, 5));
  return Math.min(2_000 * (2 ** exponent), MAXIMUM_RETRY_INTERVAL_MS);
}

export function hasEnabledExecutionMode(
  environment: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return environment.COMPETITIVE_EXECUTION_ENABLED === 'true' ||
    environment.ALPHA_BROWSER_MATCHES_UNRANKED === 'true';
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
    timestamp: new Date().toISOString(), level: 'info', service: 'devleague-api', event, ...details
  })}\n`);
}
