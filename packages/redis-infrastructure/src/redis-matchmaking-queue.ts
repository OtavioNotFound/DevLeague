import { randomUUID } from 'node:crypto';
import type {
  MatchmakingEntry,
  MatchmakingMode,
  MatchmakingPair,
  MatchmakingQueuePort
} from '@devleague/application';
import type { DevLeagueRedisClient } from './redis-client.js';

const ENTRIES = 'devleague:{mm}:entries:v2';
const RESERVATIONS = 'devleague:{mm}:reservations:v2';
const RESERVATION_DUE = 'devleague:{mm}:reservation-due:v2';

export class RedisMatchmakingQueue implements MatchmakingQueuePort {
  constructor(private readonly redis: DevLeagueRedisClient) {}

  async upsert(entry: MatchmakingEntry): Promise<MatchmakingEntry> {
    const existing = await this.get(entry.userId);
    if (existing && existing.mode !== entry.mode) {
      await this.redis.zRem(queueKey(existing.region, existing.mode), entry.userId);
    }
    const stored = existing && existing.region === entry.region && existing.mode === entry.mode
      ? { ...entry, id: existing.id, enteredAt: existing.enteredAt }
      : entry;
    await this.redis.multi()
      .hSet(ENTRIES, entry.userId, JSON.stringify(stored))
      .zAdd(queueKey(entry.region, entry.mode), [{ score: stored.enteredAt, value: entry.userId }])
      .exec();
    return stored;
  }

  async get(userId: string): Promise<MatchmakingEntry | null> {
    const serialized = await this.redis.hGet(ENTRIES, userId);
    if (!serialized) return null;
    const entry = parseEntry(serialized);
    if (entry.expiresAt <= Date.now()) {
      await this.remove(userId);
      return null;
    }
    return entry;
  }

  async remove(userId: string): Promise<boolean> {
    const serialized = await this.redis.hGet(ENTRIES, userId);
    if (!serialized) return false;
    const entry = parseEntry(serialized);
    await this.redis.multi()
      .hDel(ENTRIES, userId)
      .zRem(queueKey(entry.region, entry.mode), userId)
      .exec();
    return true;
  }

  async heartbeat(userId: string, expiresAt: number): Promise<MatchmakingEntry | null> {
    const entry = await this.get(userId);
    if (!entry) return null;
    const updated = { ...entry, expiresAt };
    await this.redis.hSet(ENTRIES, userId, JSON.stringify(updated));
    return updated;
  }

  async claimPair(region: string, mode: MatchmakingMode, now: number): Promise<MatchmakingPair | null> {
    const pairId = randomUUID();
    const reservationExpiresAt = now + 30_000;
    const result = await this.redis.sendCommand([
      'EVAL', CLAIM_PAIR_SCRIPT, '4', queueKey(region, mode), ENTRIES, RESERVATIONS,
      RESERVATION_DUE, pairId, region, mode, String(now), String(reservationExpiresAt)
    ]);
    if (!Array.isArray(result) || result.length !== 2) return null;
    const [firstSerialized, secondSerialized] = result;
    if (typeof firstSerialized !== 'string' || typeof secondSerialized !== 'string') return null;
    return {
      id: pairId,
      region,
      mode,
      first: parseEntry(firstSerialized),
      second: parseEntry(secondSerialized),
      reservationExpiresAt
    };
  }

  async completePair(pair: MatchmakingPair): Promise<void> {
    await this.redis.sendCommand([
      'EVAL', COMPLETE_PAIR_SCRIPT, '3', ENTRIES, RESERVATIONS, RESERVATION_DUE,
      pair.id, pair.first.userId, pair.second.userId
    ]);
  }

  async releasePair(pair: MatchmakingPair): Promise<void> {
    await this.redis.sendCommand([
      'EVAL', RELEASE_PAIR_SCRIPT, '4', queueKey(pair.region, pair.mode), ENTRIES,
      RESERVATIONS, RESERVATION_DUE, pair.id
    ]);
  }

  async recoverExpiredReservations(now: number): Promise<number> {
    const result = await this.redis.sendCommand([
      'EVAL', RECOVER_SCRIPT, '3', ENTRIES, RESERVATIONS, RESERVATION_DUE,
      String(now), 'devleague:{mm}:queue:'
    ]);
    return typeof result === 'number' ? result : Number(result ?? 0);
  }
}

function queueKey(region: string, mode: MatchmakingMode): string {
  return `devleague:{mm}:queue:${region}:${mode}`;
}

function parseEntry(serialized: string): MatchmakingEntry {
  const value: unknown = JSON.parse(serialized);
  if (!isEntry(value)) throw new Error('Redis contains an invalid matchmaking entry.');
  return value;
}

function isEntry(value: unknown): value is MatchmakingEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === 'string' && typeof entry.userId === 'string' &&
    typeof entry.rating === 'number' && typeof entry.region === 'string' &&
    (entry.mode === 'RANKED' || entry.mode === 'UNRANKED') &&
    typeof entry.enteredAt === 'number' && typeof entry.expiresAt === 'number';
}

const CLAIM_PAIR_SCRIPT = `
local users = redis.call('ZRANGE', KEYS[1], 0, 199)
local now = tonumber(ARGV[4])
for i = 1, #users do
  local firstJson = redis.call('HGET', KEYS[2], users[i])
  if firstJson then
    local first = cjson.decode(firstJson)
    if first.expiresAt <= now then
      redis.call('ZREM', KEYS[1], users[i])
      redis.call('HDEL', KEYS[2], users[i])
    else
      for j = i + 1, #users do
        local secondJson = redis.call('HGET', KEYS[2], users[j])
        if secondJson then
          local second = cjson.decode(secondJson)
          if second.expiresAt > now then
            local firstRange = math.min(400, 100 + math.floor(math.max(0, now-first.enteredAt)/30000)*25)
            local secondRange = math.min(400, 100 + math.floor(math.max(0, now-second.enteredAt)/30000)*25)
            if math.abs(first.rating-second.rating) <= math.min(firstRange, secondRange) then
              redis.call('ZREM', KEYS[1], users[i], users[j])
              local reservation = cjson.encode({id=ARGV[1], region=ARGV[2], mode=ARGV[3], first=first, second=second, reservationExpiresAt=tonumber(ARGV[5])})
              redis.call('HSET', KEYS[3], ARGV[1], reservation)
              redis.call('ZADD', KEYS[4], ARGV[5], ARGV[1])
              return {firstJson, secondJson}
            end
          end
        end
      end
    end
  end
end
return {}
`;

const COMPLETE_PAIR_SCRIPT = `
redis.call('HDEL', KEYS[1], ARGV[2], ARGV[3])
redis.call('HDEL', KEYS[2], ARGV[1])
redis.call('ZREM', KEYS[3], ARGV[1])
return 1
`;

const RELEASE_PAIR_SCRIPT = `
local reservation = redis.call('HGET', KEYS[3], ARGV[1])
if not reservation then return 0 end
local pair = cjson.decode(reservation)
if redis.call('HEXISTS', KEYS[2], pair.first.userId) == 1 then
  redis.call('ZADD', KEYS[1], pair.first.enteredAt, pair.first.userId)
end
if redis.call('HEXISTS', KEYS[2], pair.second.userId) == 1 then
  redis.call('ZADD', KEYS[1], pair.second.enteredAt, pair.second.userId)
end
redis.call('HDEL', KEYS[3], ARGV[1])
redis.call('ZREM', KEYS[4], ARGV[1])
return 1
`;

const RECOVER_SCRIPT = `
local ids = redis.call('ZRANGEBYSCORE', KEYS[3], '-inf', ARGV[1])
local recovered = 0
for _, id in ipairs(ids) do
  local reservation = redis.call('HGET', KEYS[2], id)
  if reservation then
    local pair = cjson.decode(reservation)
    if redis.call('HEXISTS', KEYS[1], pair.first.userId) == 1 and pair.first.expiresAt > tonumber(ARGV[1]) then
      redis.call('ZADD', ARGV[2] .. pair.region .. ':' .. pair.mode, pair.first.enteredAt, pair.first.userId)
    end
    if redis.call('HEXISTS', KEYS[1], pair.second.userId) == 1 and pair.second.expiresAt > tonumber(ARGV[1]) then
      redis.call('ZADD', ARGV[2] .. pair.region .. ':' .. pair.mode, pair.second.enteredAt, pair.second.userId)
    end
    redis.call('HDEL', KEYS[2], id)
    recovered = recovered + 1
  end
  redis.call('ZREM', KEYS[3], id)
end
return recovered
`;
