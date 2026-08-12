import { describe, expect, it } from 'vitest';
import { InMemoryMatchmakingAdapter } from './in-memory-matchmaking-adapter.js';
import { MatchmakingCoordinator } from './matchmaking-coordinator.js';

describe('matchmaking', () => {
  it('RF-MM-002 pairs compatible ratings and completes one reservation', async () => {
    const queue = new InMemoryMatchmakingAdapter();
    const now = Date.now();
    await queue.upsert({
      id: 'entry-1', userId: 'user-1', rating: 0, region: 'br-sa-east', mode: 'RANKED',
      enteredAt: now, expiresAt: now + 60_000
    });
    await queue.upsert({
      id: 'entry-2', userId: 'user-2', rating: 75, region: 'br-sa-east', mode: 'RANKED',
      enteredAt: now, expiresAt: now + 60_000
    });
    const coordinator = new MatchmakingCoordinator(queue, {
      createMatch: () => Promise.resolve('match-1')
    });

    await expect(coordinator.runOnce('br-sa-east', 'RANKED', now)).resolves.toBe('match-1');
    await expect(queue.get('user-1')).resolves.toBeNull();
  });

  it('RF-MM-003 releases the reservation if durable match creation fails', async () => {
    const queue = new InMemoryMatchmakingAdapter();
    const now = Date.now();
    for (const userId of ['user-1', 'user-2']) {
      await queue.upsert({
        id: `entry-${userId}`, userId, rating: 0, region: 'br-sa-east', mode: 'UNRANKED',
        enteredAt: now, expiresAt: now + 60_000
      });
    }
    const coordinator = new MatchmakingCoordinator(queue, {
      createMatch: () => Promise.reject(new Error('PostgreSQL unavailable'))
    });

    await expect(coordinator.runOnce('br-sa-east', 'UNRANKED', now)).rejects.toThrow();
    await expect(queue.get('user-1')).resolves.toMatchObject({ userId: 'user-1' });
  });

  it('does not pair ranked players with unranked players', async () => {
    const queue = new InMemoryMatchmakingAdapter();
    const now = Date.now();
    await queue.upsert({ id: 'ranked', userId: 'user-1', rating: 0, region: 'br-sa-east', mode: 'RANKED', enteredAt: now, expiresAt: now + 60_000 });
    await queue.upsert({ id: 'unranked', userId: 'user-2', rating: 0, region: 'br-sa-east', mode: 'UNRANKED', enteredAt: now, expiresAt: now + 60_000 });

    await expect(queue.claimPair('br-sa-east', 'RANKED', now)).resolves.toBeNull();
    await expect(queue.claimPair('br-sa-east', 'UNRANKED', now)).resolves.toBeNull();
  });
});
