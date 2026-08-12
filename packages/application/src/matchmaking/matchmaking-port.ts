export interface MatchmakingEntry {
  readonly id: string;
  readonly userId: string;
  readonly rating: number;
  readonly region: string;
  readonly enteredAt: number;
  readonly expiresAt: number;
}

export interface MatchmakingPair {
  readonly id: string;
  readonly region: string;
  readonly first: MatchmakingEntry;
  readonly second: MatchmakingEntry;
  readonly reservationExpiresAt: number;
}

export interface MatchmakingQueuePort {
  upsert(entry: MatchmakingEntry): Promise<MatchmakingEntry>;
  get(userId: string): Promise<MatchmakingEntry | null>;
  remove(userId: string): Promise<boolean>;
  heartbeat(userId: string, expiresAt: number): Promise<MatchmakingEntry | null>;
  claimPair(region: string, now: number): Promise<MatchmakingPair | null>;
  completePair(pair: MatchmakingPair): Promise<void>;
  releasePair(pair: MatchmakingPair): Promise<void>;
  recoverExpiredReservations(now: number): Promise<number>;
}
