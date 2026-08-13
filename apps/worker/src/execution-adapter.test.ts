import { describe, expect, it } from 'vitest';
import { assertFakeJudgeIsLocal, createExecutionAdapter } from './execution-adapter.js';

describe('fake judge safety', () => {
  it('RF-JUDGE-007 rejects fake execution against a remote database', () => {
    expect(() => assertFakeJudgeIsLocal({
      NODE_ENV: 'development',
      ALLOW_FAKE_JUDGE: 'true',
      DATABASE_URL: 'postgresql://user:secret@db.example.test/devleague'
    })).toThrow(/loopback PostgreSQL/);
  });

  it('RF-JUDGE-007 requires an explicit local opt-in', () => {
    expect(() => createExecutionAdapter({
      NODE_ENV: 'development',
      JUDGE_PROVIDER: 'fake',
      DATABASE_URL: 'postgresql://user:secret@localhost/devleague'
    })).toThrow(/ALLOW_FAKE_JUDGE/);
  });

  it('allows the fake adapter only for an explicitly opted-in local database', () => {
    expect(() => createExecutionAdapter({
      NODE_ENV: 'development',
      JUDGE_PROVIDER: 'fake',
      ALLOW_FAKE_JUDGE: 'true',
      DATABASE_URL: 'postgresql://user:secret@localhost/devleague'
    })).not.toThrow();
  });
});
