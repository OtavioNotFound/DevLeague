import type { MatchmakingPair, MatchmakingQueuePort } from './matchmaking-port.js';

export interface MatchCreationPort {
  createRankedMatch(pair: MatchmakingPair): Promise<string>;
}

export class MatchmakingCoordinator {
  constructor(
    private readonly queue: MatchmakingQueuePort,
    private readonly matches: MatchCreationPort
  ) {}

  async runOnce(region: string, now = Date.now()): Promise<string | null> {
    await this.queue.recoverExpiredReservations(now);
    const pair = await this.queue.claimPair(region, now);
    if (!pair) return null;
    try {
      const matchId = await this.matches.createRankedMatch(pair);
      await this.queue.completePair(pair);
      return matchId;
    } catch (error: unknown) {
      await this.queue.releasePair(pair);
      throw error;
    }
  }
}
