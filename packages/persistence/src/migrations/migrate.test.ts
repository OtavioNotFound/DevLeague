import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('competitive core migration', () => {
  it('RNF-REL-001 encodes the database invariants required for exactly-once results', async () => {
    const sql = await readFile(new URL('./0001_competitive_core.sql', import.meta.url), 'utf8');

    expect(sql).toContain('unique (match_id, admission_seq)');
    expect(sql).toContain('unique (user_id, match_id)');
    expect(sql).toContain('dedupe_key text not null unique');
    expect(sql).toContain('foreign key (match_id, user_id)');
    expect(sql).toContain("type in ('RANKED_PUBLIC', 'PRIVATE_UNRANKED')");
  });

  it('RNF-PRIV-002 keeps source code out of the outbox schema', async () => {
    const sql = await readFile(new URL('./0001_competitive_core.sql', import.meta.url), 'utf8');
    const outboxDefinition = sql.slice(sql.indexOf('create table devleague.outbox_event'));

    expect(outboxDefinition).not.toContain('source_ref');
    expect(outboxDefinition).not.toContain('source_code');
  });
});

describe('identity and consent migration', () => {
  it('RF-AUTH-001 enforces case-insensitive username uniqueness', async () => {
    const sql = await readFile(new URL('./0002_identity_and_consent.sql', import.meta.url), 'utf8');

    expect(sql).toContain('username_normalized text not null unique');
    expect(sql).toContain('app_user_auth_subject_unique');
  });

  it('RF-AUTH-003 stores versioned 18+ consent evidence without overwriting it', async () => {
    const sql = await readFile(new URL('./0002_identity_and_consent.sql', import.meta.url), 'utf8');

    expect(sql).toContain("age_declaration text not null check (age_declaration = 'OVER_18')");
    expect(sql).toContain('unique (user_id, document_type, document_version)');
  });
});

describe('problem catalog migration', () => {
  it('RF-PROBLEM-002 separates public and private cases from public content', async () => {
    const sql = await readFile(new URL('./0003_problem_catalog.sql', import.meta.url), 'utf8');

    expect(sql).toContain("kind text not null check (kind in ('PUBLIC', 'PRIVATE'))");
    expect(sql).toContain('create table devleague.starter_code');
    expect(sql).toContain('practice_visible boolean not null');
  });

  it('RF-PROBLEM-003 records user exposure by immutable problem version', async () => {
    const sql = await readFile(new URL('./0003_problem_catalog.sql', import.meta.url), 'utf8');

    expect(sql).toContain('create table devleague.problem_exposure');
    expect(sql).toContain('problem_version_id uuid not null');
  });
});

describe('practice execution migration', () => {
  it('RF-JUDGE-003 persists idempotent async work and claim order', async () => {
    const sql = await readFile(new URL('./0004_practice_execution.sql', import.meta.url), 'utf8');

    expect(sql).toContain('unique (user_id, kind, idempotency_key)');
    expect(sql).toContain('create table devleague.execution_job');
    expect(sql).toContain('execution_job_claim_idx');
  });

  it('RNF-PRIV-002 keeps source outside execution jobs and outbox payloads', async () => {
    const sql = await readFile(new URL('./0004_practice_execution.sql', import.meta.url), 'utf8');
    const jobDefinition = sql.slice(sql.indexOf('create table devleague.execution_job'));

    expect(jobDefinition).not.toContain('source_text');
  });
});

describe('match execution migration', () => {
  it('RF-JUDGE-003 routes competitive submissions through the same durable queue', async () => {
    const sql = await readFile(new URL('./0005_match_execution.sql', import.meta.url), 'utf8');

    expect(sql).toContain('match_submission_id uuid unique');
    expect(sql).toContain('execution_job_exactly_one_submission');
    expect(sql).toContain('source_text text not null');
  });
});

describe('initial catalog safety migration', () => {
  it('RN-PROB-007 removes solved starters and disables uncalibrated competitive versions', async () => {
    const sql = await readFile(new URL('./0012_content_safety.sql', import.meta.url), 'utf8');

    expect(sql).toContain('set competitive_eligible = false');
    expect(sql).toContain('Escreva sua solução aqui');
    expect(sql).not.toContain('print(a + b)');
  });
});

describe('matchmaking origin migration', () => {
  it('RF-MM-002 makes pair-to-match creation idempotent', async () => {
    const sql = await readFile(new URL('./0006_matchmaking_origin.sql', import.meta.url), 'utf8');
    expect(sql).toContain('match_origin_key_unique');
  });
});

describe('competitive lobby migration', () => {
  it('requires explicit readiness without exposing a second source of match state', async () => {
    const sql = await readFile(new URL('./0013_match_ready_check.sql', import.meta.url), 'utf8');

    expect(sql).toContain('lobby_expires_at timestamptz');
    expect(sql).toContain('ready_at timestamptz');
    expect(sql).toContain('match_lobby_expiry_idx');
  });
});

describe('zero-based ranked rating migration', () => {
  it('starts the alpha ladder at zero and resets existing accounts consistently', async () => {
    const sql = await readFile(new URL('./0010_zero_based_ranked_rating.sql', import.meta.url), 'utf8');

    expect(sql).toContain('alter column current_rating set default 0');
    expect(sql).toContain("'UNRANKED_PUBLIC'");
    expect(sql).toContain('delete from devleague.rating_history');
    expect(sql).toContain('set current_rating = 0');
    expect(sql).toContain('games = 0');
  });
});
