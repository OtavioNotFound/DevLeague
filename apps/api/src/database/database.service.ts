import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import {
  closeDatabase,
  createDatabase,
  type Database
} from '@devleague/persistence';

export type DatabaseReadiness =
  | { readonly ready: true }
  | { readonly ready: false; readonly reason: 'configuration_missing' | 'connection_failed' };

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly database: Database | undefined;

  constructor() {
    const connectionUrl = process.env.DATABASE_URL;
    this.database = connectionUrl ? createDatabase(connectionUrl) : undefined;
  }

  get connection(): Database {
    if (!this.database) {
      throw new Error('DATABASE_URL is required for database-backed operations.');
    }
    return this.database;
  }

  async checkReadiness(): Promise<DatabaseReadiness> {
    if (!this.database) return { ready: false, reason: 'configuration_missing' };

    try {
      await this.database`select 1`;
      return { ready: true };
    } catch {
      return { ready: false, reason: 'connection_failed' };
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.database) await closeDatabase(this.database);
  }
}
