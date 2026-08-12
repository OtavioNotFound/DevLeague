import { randomUUID } from 'node:crypto';
import type {
  MatchmakingEntry,
  MatchmakingMode,
  MatchmakingPair,
  MatchmakingQueuePort
} from './matchmaking-port.js';

export class InMemoryMatchmakingAdapter implements MatchmakingQueuePort {
  private readonly entries = new Map<string, MatchmakingEntry>();
  private readonly reservations = new Map<string, MatchmakingPair>();

  upsert(entry: MatchmakingEntry): Promise<MatchmakingEntry> {
    const existing = this.entries.get(entry.userId);
    const stored = existing && existing.region === entry.region && existing.mode === entry.mode
      ? { ...entry, id: existing.id, enteredAt: existing.enteredAt }
      : entry;
    this.entries.set(entry.userId, stored);
    return Promise.resolve(stored);
  }

  get(userId: string): Promise<MatchmakingEntry | null> {
    const entry = this.entries.get(userId);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.entries.delete(userId);
      return Promise.resolve(null);
    }
    return Promise.resolve(entry);
  }

  remove(userId: string): Promise<boolean> {
    return Promise.resolve(this.entries.delete(userId));
  }

  heartbeat(userId: string, expiresAt: number): Promise<MatchmakingEntry | null> {
    const entry = this.entries.get(userId);
    if (!entry) return Promise.resolve(null);
    const updated = { ...entry, expiresAt };
    this.entries.set(userId, updated);
    return Promise.resolve(updated);
  }

  claimPair(region: string, mode: MatchmakingMode, now: number): Promise<MatchmakingPair | null> {
    const candidates = [...this.entries.values()]
      .filter((entry) => entry.region === region && entry.mode === mode && entry.expiresAt > now)
      .sort((left, right) => left.enteredAt - right.enteredAt || left.userId.localeCompare(right.userId));
    for (let firstIndex = 0; firstIndex < candidates.length; firstIndex += 1) {
      const first = candidates[firstIndex];
      if (!first) continue;
      for (let secondIndex = firstIndex + 1; secondIndex < candidates.length; secondIndex += 1) {
        const second = candidates[secondIndex];
        if (!second || !compatible(first, second, now)) continue;
        this.entries.delete(first.userId);
        this.entries.delete(second.userId);
        const pair: MatchmakingPair = {
          id: randomUUID(), region, mode, first, second,
          reservationExpiresAt: now + 30_000
        };
        this.reservations.set(pair.id, pair);
        return Promise.resolve(pair);
      }
    }
    return Promise.resolve(null);
  }

  completePair(pair: MatchmakingPair): Promise<void> {
    this.reservations.delete(pair.id);
    return Promise.resolve();
  }

  releasePair(pair: MatchmakingPair): Promise<void> {
    if (this.reservations.delete(pair.id)) {
      this.entries.set(pair.first.userId, pair.first);
      this.entries.set(pair.second.userId, pair.second);
    }
    return Promise.resolve();
  }

  recoverExpiredReservations(now: number): Promise<number> {
    let recovered = 0;
    for (const pair of this.reservations.values()) {
      if (pair.reservationExpiresAt > now) continue;
      this.reservations.delete(pair.id);
      if (pair.first.expiresAt > now) this.entries.set(pair.first.userId, pair.first);
      if (pair.second.expiresAt > now) this.entries.set(pair.second.userId, pair.second);
      recovered += 1;
    }
    return Promise.resolve(recovered);
  }
}

function compatible(first: MatchmakingEntry, second: MatchmakingEntry, now: number): boolean {
  const firstRange = ratingRange(now - first.enteredAt);
  const secondRange = ratingRange(now - second.enteredAt);
  return Math.abs(first.rating - second.rating) <= Math.min(firstRange, secondRange);
}

function ratingRange(waitMs: number): number {
  return Math.min(400, 100 + Math.floor(Math.max(0, waitMs) / 30_000) * 25);
}
