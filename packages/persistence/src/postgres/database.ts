import postgres from 'postgres';
import type { Sql } from 'postgres';

export type Database = Sql<Record<string, never>>;

export function createDatabase(connectionUrl: string, maxConnections = 10): Database {
  if (!connectionUrl) throw new Error('A PostgreSQL connection URL is required.');

  return postgres(connectionUrl, {
    max: maxConnections,
    idle_timeout: 20,
    connect_timeout: 10,
    transform: postgres.camel
  });
}

export async function closeDatabase(database: Database): Promise<void> {
  await database.end({ timeout: 5 });
}
