import { createClient } from 'redis';

export async function createRedisClient(url: string) {
  if (!url) throw new Error('REDIS_URL is required.');
  const client = createClient({ url });
  client.on('error', () => undefined);
  await client.connect();
  return client;
}

export type DevLeagueRedisClient = Awaited<ReturnType<typeof createRedisClient>>;

export async function closeRedisClient(client: DevLeagueRedisClient): Promise<void> {
  if (client.isOpen) await client.close();
}
