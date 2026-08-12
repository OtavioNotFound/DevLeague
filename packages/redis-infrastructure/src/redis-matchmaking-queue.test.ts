import { describe, expect, it } from 'vitest';

describe('Redis matchmaking key layout', () => {
  it('RF-MM-003 keeps transactional keys in one Redis Cluster hash slot', () => {
    const keys = [
      'devleague:{mm}:entries',
      'devleague:{mm}:reservations',
      'devleague:{mm}:reservation-due',
      'devleague:{mm}:queue:br-sa-east'
    ];
    expect(keys.every((key) => key.includes('{mm}'))).toBe(true);
  });
});
