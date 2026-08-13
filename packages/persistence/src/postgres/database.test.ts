import { describe, expect, it } from 'vitest';
import { assertSafeDatabaseTarget } from './database.js';

describe('database target safety', () => {
  it('blocks a remote database during local development by default', () => {
    expect(() => assertSafeDatabaseTarget(
      'postgresql://user:secret@db.example.test/devleague',
      { NODE_ENV: 'development' }
    )).toThrow(/Remote PostgreSQL is blocked/);
  });

  it('allows loopback databases and explicit remote opt-in', () => {
    expect(() => assertSafeDatabaseTarget(
      'postgresql://user:secret@127.0.0.1/devleague',
      { NODE_ENV: 'development' }
    )).not.toThrow();
    expect(() => assertSafeDatabaseTarget(
      'postgresql://user:secret@db.example.test/devleague',
      { NODE_ENV: 'development', ALLOW_REMOTE_DATABASE: 'true' }
    )).not.toThrow();
  });

  it('allows managed databases in production', () => {
    expect(() => assertSafeDatabaseTarget(
      'postgresql://user:secret@db.example.test/devleague',
      { NODE_ENV: 'production' }
    )).not.toThrow();
  });
});
