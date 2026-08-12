import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeRedisClient, createRedisClient, type DevLeagueRedisClient } from './redis-client.js';
import { RedisMatchmakingQueue } from './redis-matchmaking-queue.js';

const testRedisUrl = process.env.TEST_REDIS_URL;
const integration = testRedisUrl ? describe : describe.skip;

integration('RedisMatchmakingQueue with Redis', () => {
  let redis: DevLeagueRedisClient;
  let queue: RedisMatchmakingQueue;
  const users: string[] = [];

  beforeAll(async () => {
    if (!testRedisUrl) throw new Error('TEST_REDIS_URL is required.');
    redis = await createRedisClient(testRedisUrl);
    queue = new RedisMatchmakingQueue(redis);
  });

  afterAll(async () => {
    if (redis) {
      await Promise.all(users.map((userId) => queue.remove(userId)));
      await closeRedisClient(redis);
    }
  });

  it('RF-MM-002 atomically reserves one compatible pair', async () => {
    const now = Date.now();
    const firstUserId = randomUUID();
    const secondUserId = randomUUID();
    users.push(firstUserId, secondUserId);
    await queue.upsert({
      id: randomUUID(), userId: firstUserId, rating: 1200,
      region: 'test-isolated', mode: 'RANKED', enteredAt: now, expiresAt: now + 60_000
    });
    await queue.upsert({
      id: randomUUID(), userId: secondUserId, rating: 1250,
      region: 'test-isolated', mode: 'RANKED', enteredAt: now, expiresAt: now + 60_000
    });

    const pair = await queue.claimPair('test-isolated', 'RANKED', now);
    expect(pair).not.toBeNull();
    expect(await queue.claimPair('test-isolated', 'RANKED', now)).toBeNull();
    if (pair) await queue.releasePair(pair);
    expect(await queue.get(firstUserId)).not.toBeNull();
  });
});
