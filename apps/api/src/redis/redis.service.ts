import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import {
  closeRedisClient,
  createRedisClient,
  RedisMatchmakingQueue,
  type DevLeagueRedisClient
} from '@devleague/redis-infrastructure';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly clientPromise: Promise<DevLeagueRedisClient> | undefined;

  constructor() {
    const url = process.env.REDIS_URL;
    this.clientPromise = url ? createRedisClient(url) : undefined;
  }

  async matchmakingQueue(): Promise<RedisMatchmakingQueue> {
    if (!this.clientPromise) throw new Error('REDIS_URL is required for matchmaking.');
    return new RedisMatchmakingQueue(await this.clientPromise);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.clientPromise) await closeRedisClient(await this.clientPromise);
  }
}
