import postgres from 'postgres';
import type { Sql } from 'postgres';

export type Database = Sql<Record<string, never>>;

export function createDatabase(connectionUrl: string, maxConnections = 10): Database {
  if (!connectionUrl) throw new Error('A PostgreSQL connection URL is required.');
  assertSafeDatabaseTarget(connectionUrl);

  return postgres(connectionUrl, {
    max: maxConnections,
    idle_timeout: 20,
    connect_timeout: 10,
    transform: postgres.camel
  });
}

export function assertSafeDatabaseTarget(
  connectionUrl: string,
  environment: Readonly<Record<string, string | undefined>> = process.env
): void {
  if (environment.NODE_ENV === 'production' || environment.ALLOW_REMOTE_DATABASE === 'true') return;

  let hostname: string;
  try {
    hostname = new URL(connectionUrl).hostname.toLowerCase();
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1') {
    return;
  }

  throw new Error(
    'Remote PostgreSQL is blocked outside production. Use a local database or set ALLOW_REMOTE_DATABASE=true explicitly.'
  );
}

export async function closeDatabase(database: Database): Promise<void> {
  await database.end({ timeout: 5 });
}
