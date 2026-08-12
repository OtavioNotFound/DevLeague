import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { MatchmakingCoordinator } from '@devleague/application';
import { RankedMatchFactory } from '@devleague/persistence';
import { DatabaseService } from '../database/database.service.js';
import { RedisService } from '../redis/redis.service.js';

@Injectable()
export class MatchmakingLoopService implements OnModuleInit, OnModuleDestroy {
  private running = false;
  private loop: Promise<void> | undefined;

  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService
  ) {}

  onModuleInit(): void {
    if (process.env.MATCHMAKING_ENABLED !== 'true' || process.env.MATCHMAKING_EMBEDDED !== 'true') return;
    this.running = true;
    this.loop = this.run();
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    await this.loop;
  }

  private async run(): Promise<void> {
    const coordinator = new MatchmakingCoordinator(
      await this.redis.matchmakingQueue(),
      new RankedMatchFactory(this.database.connection)
    );
    const region = process.env.MATCHMAKING_REGION ?? 'br-sa-east';
    const pollMs = positiveInteger(process.env.MATCHMAKER_POLL_MS, 500);
    while (this.running) {
      try {
        let matchId: string | null = null;
        for (const mode of ['RANKED', 'UNRANKED'] as const) {
          matchId = await coordinator.runOnce(region, mode);
          if (matchId) {
            log('match.created', { matchId, region, mode });
            break;
          }
        }
        if (!matchId) await delay(pollMs);
      } catch (error: unknown) {
        log('matchmaking.error', { errorType: error instanceof Error ? error.name : 'UnknownError' });
        await delay(Math.max(pollMs, 2_000));
      }
    }
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
    timestamp: new Date().toISOString(), level: 'info', service: 'devleague-api', event, ...details
  })}\n`);
}
