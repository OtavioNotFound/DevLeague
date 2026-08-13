import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { CompetitiveStore } from '@devleague/persistence';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class MatchLifecycleService implements OnModuleInit, OnModuleDestroy {
  private running = false;
  private loop: Promise<void> | undefined;

  constructor(private readonly database: DatabaseService) {}

  onModuleInit(): void {
    if (process.env.MATCH_LIFECYCLE_ENABLED === 'false') return;
    this.running = true;
    this.loop = this.run();
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    await this.loop;
  }

  private async run(): Promise<void> {
    const store = new CompetitiveStore(this.database.connection);
    const pollMs = positiveInteger(process.env.MATCH_LIFECYCLE_POLL_MS, 500);
    const resolutionGraceSeconds = positiveInteger(process.env.MATCH_RESOLUTION_GRACE_SECONDS, 60);
    while (this.running) {
      try {
        const progress = await store.advanceLifecycle({ resolutionGraceSeconds });
        if (progress.activated > 0 || progress.reachedDeadline > 0 || progress.voidedAfterGrace > 0 || progress.cancelledLobbies > 0) {
          log('match.lifecycle.advanced', { ...progress });
        }
      } catch (error: unknown) {
        log('match.lifecycle.error', {
          errorType: error instanceof Error ? error.name : 'UnknownError'
        });
      }
      await delay(pollMs);
    }
  }
}

export function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function log(event: string, details: Readonly<Record<string, unknown>>): void {
  process.stdout.write(`${JSON.stringify({
    timestamp: new Date().toISOString(),
    level: event.endsWith('.error') ? 'error' : 'info',
    service: 'devleague-api',
    event,
    ...details
  })}\n`);
}
