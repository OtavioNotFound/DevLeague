import { describe, expect, it } from 'vitest';
import { InMemoryMatchmakingAdapter } from './in-memory-matchmaking-adapter.js';
import { MatchmakingCoordinator } from './matchmaking-coordinator.js';

describe('matchmaking', () => {
  it('RF-MM-002 pairs compatible ratings and completes one reservation', async () => {
    const queue = new InMemoryMatchmakingAdapter();
    const now = Date.now();
    await queue.upsert({
      id: 'entry-1', userId: 'user-1', rating: 1200, region: 'br-sa-east',
      enteredAt: now, expiresAt: now + 60_000
    });
    await queue.upsert({
      id: 'entry-2', userId: 'user-2', rating: 1275, region: 'br-sa-east',
      enteredAt: now, expiresAt: now + 60_000
    });
    const coordinator = new MatchmakingCoordinator(queue, {
      createRankedMatch: () => Promise.resolve('match-1')
    });

    await expect(coordinator.runOnce('br-sa-east', now)).resolves.toBe('match-1');
    await expect(queue.get('user-1')).resolves.toBeNull();
  });

  it('RF-MM-003 releases the reservation if durable match creation fails', async () => {
    const queue = new InMemoryMatchmakingAdapter();
    const now = Date.now();
    for (const userId of ['user-1', 'user-2']) {
      await queue.upsert({
        id: `entry-${userId}`, userId, rating: 1200, region: 'br-sa-east',
        enteredAt: now, expiresAt: now + 60_000
      });
    }
    const coordinator = new MatchmakingCoordinator(queue, {
      createRankedMatch: () => Promise.reject(new Error('PostgreSQL unavailable'))
    });

    await expect(coordinator.runOnce('br-sa-east', now)).rejects.toThrow();
    await expect(queue.get('user-1')).resolves.toMatchObject({ userId: 'user-1' });
  });
});
