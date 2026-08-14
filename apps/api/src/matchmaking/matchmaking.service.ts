import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  ServiceUnavailableException
} from '@nestjs/common';
import type { MatchmakingEntry, MatchmakingMode, MatchmakingQueuePort } from '@devleague/application';
import type { AuthPrincipal } from '../auth/auth-principal.js';
import { RedisService } from '../redis/redis.service.js';
import { UsersService } from '../users/users.service.js';
import { MatchmakingWakeSignalService } from './matchmaking-wake-signal.service.js';

@Injectable()
export class MatchmakingService {
  private readonly region = process.env.MATCHMAKING_REGION ?? 'br-sa-east';
  private readonly ttlMs = 30_000;

  constructor(
    private readonly redis: RedisService,
    private readonly users: UsersService,
    private readonly wakeSignal: MatchmakingWakeSignalService
  ) {}

  async upsert(principal: AuthPrincipal, mode: MatchmakingMode): Promise<MatchmakingEntry> {
    if (process.env.MATCHMAKING_ENABLED !== 'true') {
      throw new ServiceUnavailableException({ code: 'MATCHMAKING_DISABLED' });
    }
    if (!isMatchmakingExecutionEnabled(mode)) {
      throw new ServiceUnavailableException({ code: 'COMPETITIVE_EXECUTION_DISABLED' });
    }
    if (!isMatchmakingModeEnabled(mode)) {
      throw new ServiceUnavailableException({ code: 'RANKED_DISABLED' });
    }
    const me = await this.users.requireEligible(principal);
    if (me.activeMatchId) {
      throw new ConflictException({
        code: 'MATCH_ALREADY_ACTIVE',
        matchId: me.activeMatchId
      });
    }
    const now = Date.now();
    const entry = await this.withQueue((queue) => queue.upsert(
      {
        id: randomUUID(),
        userId: me.id,
        rating: me.rating,
        region: this.region,
        mode,
        enteredAt: now,
        expiresAt: now + this.ttlMs
      }
    ));
    this.wakeSignal.wake();
    return entry;
  }

  async get(principal: AuthPrincipal): Promise<MatchmakingEntry | null> {
    const me = await this.users.requireEligible(principal);
    return this.withQueue((queue) => queue.get(me.id));
  }

  async remove(principal: AuthPrincipal): Promise<void> {
    const me = await this.users.requireEligible(principal);
    await this.withQueue((queue) => queue.remove(me.id));
  }

  async heartbeat(principal: AuthPrincipal): Promise<MatchmakingEntry | null> {
    const me = await this.users.requireEligible(principal);
    return this.withQueue((queue) => queue.heartbeat(me.id, Date.now() + this.ttlMs));
  }

  private async withQueue<T>(operation: (queue: MatchmakingQueuePort) => Promise<T>): Promise<T> {
    try {
      return await operation(await this.redis.matchmakingQueue());
    } catch {
      throw new ServiceUnavailableException({ code: 'MATCHMAKING_UNAVAILABLE' });
    }
  }
}

export function isMatchmakingModeEnabled(
  mode: MatchmakingMode,
  environment: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return mode === 'UNRANKED' || environment.RANKED_MATCHMAKING_ENABLED === 'true';
}

export function isCompetitiveExecutionEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return environment.COMPETITIVE_EXECUTION_ENABLED === 'true';
}

export function isCasualBrowserExecutionEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return environment.ALPHA_BROWSER_MATCHES_UNRANKED === 'true';
}

export function isMatchmakingExecutionEnabled(
  mode: MatchmakingMode,
  environment: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return isCompetitiveExecutionEnabled(environment) ||
    (mode === 'UNRANKED' && isCasualBrowserExecutionEnabled(environment));
}
