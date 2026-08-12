import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database } from '../postgres/database.js';

export interface AppliedMigration {
  readonly version: string;
  readonly checksum: string;
  readonly applied: boolean;
}

export async function migrate(database: Database): Promise<readonly AppliedMigration[]> {
  await database.unsafe(`
    create schema if not exists devleague;
    create table if not exists devleague.schema_migration (
      version text primary key,
      checksum text not null,
      applied_at timestamptz not null default clock_timestamp()
    );
  `);

  const migrationsDirectory = dirname(fileURLToPath(import.meta.url));
  const filenames = (await readdir(migrationsDirectory))
    .filter((filename) => /^\d+_.+\.sql$/.test(filename))
    .sort();
  const results: AppliedMigration[] = [];

  for (const filename of filenames) {
    const sqlText = await readFile(join(migrationsDirectory, filename), 'utf8');
    const checksum = createHash('sha256').update(sqlText).digest('hex');
    const [existing] = await database<{ checksum: string }[]>`
      select checksum
      from devleague.schema_migration
      where version = ${filename}
    `;

    if (existing) {
      if (existing.checksum !== checksum) {
        throw new Error(`Applied migration ${filename} has a different checksum.`);
      }
      results.push({ version: filename, checksum, applied: false });
      continue;
    }

    await database.begin(async (transaction) => {
      await transaction.unsafe(sqlText);
      await transaction`
        insert into devleague.schema_migration (version, checksum)
        values (${filename}, ${checksum})
      `;
    });
    results.push({ version: filename, checksum, applied: true });
  }

  return results;
}
