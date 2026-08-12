import { closeDatabase, createDatabase } from '../postgres/database.js';
import { migrate } from './migrate.js';

async function run(): Promise<void> {
  const connectionUrl = process.env.DATABASE_URL;
  if (!connectionUrl) throw new Error('DATABASE_URL is required to run migrations.');

  const database = createDatabase(connectionUrl, 1);
  try {
    const results = await migrate(database);
    for (const result of results) {
      process.stdout.write(`${result.applied ? 'applied' : 'verified'} ${result.version}\n`);
    }
  } finally {
    await closeDatabase(database);
  }
}

void run();
