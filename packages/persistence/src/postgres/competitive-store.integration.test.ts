import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../migrations/migrate.js';
import { UserStore } from '../identity/user-store.js';
import { CatalogStore } from '../catalog/catalog-store.js';
import { PracticeStore } from '../practice/practice-store.js';
import { ExecutionJobStore } from '../execution/execution-job-store.js';
import { CompetitiveStore } from './competitive-store.js';
import { closeDatabase, createDatabase } from './database.js';
import type { Database } from './database.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integration = testDatabaseUrl ? describe : describe.skip;

integration('CompetitiveStore with PostgreSQL', () => {
  let database: Database;
  let store: CompetitiveStore;
  let users: UserStore;
  let catalog: CatalogStore;
  let practice: PracticeStore;

  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required.');
    database = createDatabase(testDatabaseUrl, 10);
    await migrate(database);
    store = new CompetitiveStore(database);
    users = new UserStore(database);
    catalog = new CatalogStore(database);
    practice = new PracticeStore(database);
  });

  beforeEach(async () => {
    await database.unsafe(`
      truncate table
        devleague.outbox_event,
        devleague.rating_history,
        devleague.submission,
        devleague.active_engagement,
        devleague.match_participant,
        devleague.match,
        devleague.problem_version,
        devleague.problem,
        devleague.rating_account,
        devleague.app_user
      restart identity cascade;
    `);
  });

  afterAll(async () => {
    if (database) await closeDatabase(database);
  });

  it('RNF-REL-001 serializes concurrent admission and resolves callbacks by admission_seq', async () => {
    const fixture = await createFixture(store);
    const [firstAdmission, secondAdmission] = await Promise.all([
      admit(store, fixture, fixture.firstUserId, randomUUID()),
      admit(store, fixture, fixture.secondUserId, randomUUID())
    ]);
    const ordered = [firstAdmission, secondAdmission].sort(
      (left, right) => left.admissionSeq - right.admissionSeq
    );
    const earlier = ordered[0];
    const later = ordered[1];
    if (!earlier || !later) throw new Error('Expected two admitted submissions.');

    expect([earlier.admissionSeq, later.admissionSeq]).toEqual([1, 2]);
    expect(await store.recordTerminalVerdict({
      submissionId: later.id,
      verdict: 'ACCEPTED'
    })).toBeNull();

    const result = await store.recordTerminalVerdict({
      submissionId: earlier.id,
      verdict: 'ACCEPTED'
    });
    expect(result).toMatchObject({
      matchId: fixture.matchId,
      winnerUserId: earlier.userId,
      winningSubmissionId: earlier.id,
      reason: 'ACCEPTED'
    });
    expect(result?.ratingChanges).toHaveLength(2);
  });

  it('RF-RATE-004 applies rating and match.finished outbox exactly once', async () => {
    const fixture = await createFixture(store);
    const submission = await admit(store, fixture, fixture.firstUserId, randomUUID());

    const firstResult = await store.recordTerminalVerdict({
      submissionId: submission.id,
      verdict: 'ACCEPTED'
    });
    const duplicateResult = await store.recordTerminalVerdict({
      submissionId: submission.id,
      verdict: 'ACCEPTED'
    });
    expect(duplicateResult).toEqual(firstResult);

    const [ratingHistory] = await database<{ count: number }[]>`
      select count(*)::integer as count
      from devleague.rating_history
      where match_id = ${fixture.matchId}
    `;
    const [finishedEvents] = await database<{ count: number }[]>`
      select count(*)::integer as count
      from devleague.outbox_event
      where dedupe_key = ${`match.finished:${fixture.matchId}`}
    `;
    expect(ratingHistory?.count).toBe(2);
    expect(finishedEvents?.count).toBe(1);
  });

  it('RN-MATCH-002 persists private results without rating history', async () => {
    const fixture = await createFixture(store, 'PRIVATE_UNRANKED');
    const submission = await admit(store, fixture, fixture.firstUserId, randomUUID());

    const result = await store.recordTerminalVerdict({
      submissionId: submission.id,
      verdict: 'ACCEPTED'
    });
    const [ratingHistory] = await database<{ count: number }[]>`
      select count(*)::integer as count
      from devleague.rating_history
      where match_id = ${fixture.matchId}
    `;

    expect(result?.ratingChanges).toEqual([]);
    expect(ratingHistory?.count).toBe(0);
  });

  it('RF-AUTH-001 bootstraps once per subject and enforces normalized username uniqueness', async () => {
    const created = await users.bootstrap({ authSubject: 'subject-1', username: 'Ana_Dev' });
    const retried = await users.bootstrap({ authSubject: 'subject-1', username: 'IgnoredName' });

    expect(retried).toEqual(created);
    await expect(users.bootstrap({ authSubject: 'subject-2', username: 'ana_dev' }))
      .rejects.toMatchObject({ code: 'USERNAME_TAKEN' });
  });

  it('RF-AUTH-003 records versioned alpha consent idempotently', async () => {
    await users.bootstrap({ authSubject: 'subject-1', username: 'AlphaUser' });
    await users.recordAlphaConsents({
      authSubject: 'subject-1',
      termsVersion: 'v0.1-alpha',
      privacyVersion: 'v0.1-alpha',
      source: 'WEB'
    });
    const retried = await users.recordAlphaConsents({
      authSubject: 'subject-1',
      termsVersion: 'v0.1-alpha',
      privacyVersion: 'v0.1-alpha',
      source: 'WEB'
    });
    const [records] = await database<{ count: number }[]>`
      select count(*)::integer as count from devleague.consent_record
    `;

    expect(records?.count).toBe(2);
    expect(retried).toMatchObject({
      acceptedTermsVersion: 'v0.1-alpha',
      acceptedPrivacyVersion: 'v0.1-alpha'
    });
  });

  it('RF-PROBLEM-002 returns public examples without leaking private cases', async () => {
    const user = await users.bootstrap({ authSubject: 'subject-catalog', username: 'CatalogUser' });
    const fixture = await createCatalogFixture(database);

    const detail = await catalog.getPublishedForPractice({
      problemId: fixture.problemId,
      userId: user.id
    });
    const privateSpec = await catalog.getExecutionSpec(fixture.versionId, 'PRIVATE');

    expect(detail).toMatchObject({
      id: fixture.problemId,
      versionId: fixture.versionId,
      examples: [{ stdin: '1\n', expectedOutput: '2\n' }]
    });
    expect(JSON.stringify(detail)).not.toContain('secret-input');
    expect(privateSpec?.cases).toMatchObject([
      { stdin: 'secret-input\n', expectedOutput: 'secret-output\n' }
    ]);
  });

  it('RF-PROBLEM-003 records exposure when a problem is opened', async () => {
    const user = await users.bootstrap({ authSubject: 'subject-exposure', username: 'ExposureUser' });
    const fixture = await createCatalogFixture(database);
    await catalog.getPublishedForPractice({ problemId: fixture.problemId, userId: user.id });

    const [exposures] = await database<{ count: number }[]>`
      select count(*)::integer as count
      from devleague.problem_exposure
      where user_id = ${user.id} and problem_version_id = ${fixture.versionId}
    `;
    expect(exposures?.count).toBe(1);
  });

  it('RF-JUDGE-003 admits, claims and completes Practice work idempotently', async () => {
    const user = await users.bootstrap({ authSubject: 'subject-practice', username: 'PracticeUser' });
    const fixture = await createCatalogFixture(database);
    const submissionId = randomUUID();
    const admitted = await practice.admit({
      id: submissionId,
      userId: user.id,
      problemVersionId: fixture.versionId,
      kind: 'SUBMIT',
      language: 'python',
      runtimeVersion: '3.13',
      source: 'print(2)',
      sourceSha256: sha256('print(2)'),
      requestHash: sha256('practice-request'),
      idempotencyKey: 'practice-request-1'
    });
    const retried = await practice.admit({
      id: randomUUID(),
      userId: user.id,
      problemVersionId: fixture.versionId,
      kind: 'SUBMIT',
      language: 'python',
      runtimeVersion: '3.13',
      source: 'print(2)',
      sourceSha256: sha256('print(2)'),
      requestHash: sha256('practice-request'),
      idempotencyKey: 'practice-request-1'
    });
    expect(retried.id).toBe(admitted.id);

    const job = await practice.claimNext();
    expect(job?.request).toMatchObject({
      network: 'DENY',
      cases: [{ stdin: 'secret-input\n', expectedOutput: 'secret-output\n' }]
    });
    if (!job) throw new Error('Expected a claimed execution job.');
    await practice.complete(job.jobId, {
      verdict: 'ACCEPTED', stdout: 'secret-output\n', usage: { cpuMs: 10 }
    });
    await practice.complete(job.jobId, {
      verdict: 'ACCEPTED', stdout: 'ignored duplicate', usage: { cpuMs: 99 }
    });

    const finished = await practice.findOwned(submissionId, user.id);
    const [event] = await database<{ published: boolean }[]>`
      select published_at is not null as published
      from devleague.outbox_event
      where dedupe_key = ${`practice.execution.requested:${submissionId}`}
    `;
    expect(finished).toMatchObject({ status: 'FINISHED', verdict: 'ACCEPTED' });
    expect(event?.published).toBe(true);
  });

  it('RF-JUDGE-007 routes a competitive Accepted through the worker into one match result', async () => {
    const fixture = await createFixture(store);
    await database`
      insert into devleague.test_case (
        id, problem_version_id, kind, ordinal, input_text, expected_output_text
      ) values (${randomUUID()}, ${fixture.problemVersionId}, 'PRIVATE', 1, '1\n', '1\n')
    `;
    const submission = await admit(store, fixture, fixture.firstUserId, randomUUID());
    const jobs = new ExecutionJobStore(database);
    const job = await jobs.claimNext();
    if (!job) throw new Error('Expected a competitive execution job.');
    expect(job.request.cases).toHaveLength(1);

    await jobs.complete(job.jobId, { verdict: 'ACCEPTED', usage: { cpuMs: 5 } });
    await jobs.complete(job.jobId, { verdict: 'ACCEPTED', usage: { cpuMs: 5 } });
    const snapshot = await store.getSnapshot(fixture.matchId, fixture.firstUserId);
    expect(snapshot?.result).toMatchObject({
      winnerUserId: fixture.firstUserId,
      winningSubmissionId: submission.id,
      reason: 'ACCEPTED'
    });
  });

  it('RN-TIME-004 rejects submissions before the server countdown finishes', async () => {
    const fixture = await createFixture(store, 'UNRANKED_PUBLIC', {
      autoReady: false
    });
    await store.markReady(fixture.matchId, fixture.firstUserId, 30);
    await store.markReady(fixture.matchId, fixture.secondUserId, 30);

    await expect(admit(store, fixture, fixture.firstUserId, randomUUID()))
      .rejects.toMatchObject({ code: 'MATCH_NOT_ACTIVE' });
    const snapshot = await store.getSnapshot(fixture.matchId, fixture.firstUserId);
    expect(snapshot?.status).toBe('COUNTDOWN');
  });

  it('RN-TIME-005 activates due matches and finishes an empty deadline as a draw', async () => {
    const fixture = await createFixture(store, 'UNRANKED_PUBLIC', {
      startsAt: new Date(Date.now() - 2_000),
      durationSeconds: 1
    });
    await database`
      update devleague.match
      set starts_at = clock_timestamp() - interval '2 seconds',
          ends_at = clock_timestamp() - interval '1 second'
      where id = ${fixture.matchId}
    `;

    const progress = await store.advanceLifecycle({ resolutionGraceSeconds: 60 });
    const snapshot = await store.getSnapshot(fixture.matchId, fixture.firstUserId);
    expect(progress).toMatchObject({ activated: 1, reachedDeadline: 1 });
    expect(snapshot).toMatchObject({ status: 'FINISHED', result: { reason: 'DRAW_TIMEOUT' } });
  });

  it('RF-JUDGE-007 voids a match whose pending judge work exceeds the technical grace', async () => {
    const fixture = await createFixture(store, 'RANKED_PUBLIC');
    const submission = await admit(store, fixture, fixture.firstUserId, randomUUID());
    await database`
      update devleague.match
      set starts_at = clock_timestamp() - interval '3 minutes',
          ends_at = clock_timestamp() - interval '2 minutes'
      where id = ${fixture.matchId}
    `;

    const progress = await store.advanceLifecycle({ resolutionGraceSeconds: 60 });
    const snapshot = await store.getSnapshot(fixture.matchId, fixture.firstUserId);
    const [storedSubmission] = await database<{ verdict: string; status: string }[]>`
      select verdict, status from devleague.submission where id = ${submission.id}
    `;
    expect(progress).toMatchObject({ reachedDeadline: 1, voidedAfterGrace: 1 });
    expect(snapshot).toMatchObject({ status: 'FINISHED', result: { reason: 'VOID_SYSTEM' } });
    expect(storedSubmission).toMatchObject({ status: 'FINISHED', verdict: 'SYSTEM_ERROR' });
  });

  it('finishes a resolving timeout as soon as the last pending verdict is not accepted', async () => {
    const fixture = await createFixture(store, 'UNRANKED_PUBLIC');
    const submission = await admit(store, fixture, fixture.firstUserId, randomUUID());
    await database`
      update devleague.match set ends_at = clock_timestamp() - interval '1 second'
      where id = ${fixture.matchId}
    `;
    expect(await store.reachDeadline(fixture.matchId)).toBeNull();

    const result = await store.recordTerminalVerdict({
      submissionId: submission.id,
      verdict: 'WRONG_ANSWER'
    });

    expect(result).toMatchObject({ reason: 'DRAW_TIMEOUT', winnerUserId: null });
  });

  it('hides the competitive problem until both participants are ready', async () => {
    const fixture = await createFixture(store, 'UNRANKED_PUBLIC', { autoReady: false });

    expect((await store.getSnapshot(fixture.matchId, fixture.firstUserId))?.problem).toBeNull();
    await store.markReady(fixture.matchId, fixture.firstUserId, 30);
    expect((await store.getSnapshot(fixture.matchId, fixture.firstUserId))?.problem).toBeNull();
    await store.markReady(fixture.matchId, fixture.secondUserId, 30);

    const snapshot = await store.getSnapshot(fixture.matchId, fixture.firstUserId);
    expect(snapshot?.problem?.versionId).toBe(fixture.problemVersionId);
    expect(snapshot?.lobbyExpiresAt).toBeNull();
    expect(snapshot?.participants.every((participant) => participant.ready)).toBe(true);
  });
});

interface Fixture {
  readonly matchId: string;
  readonly firstUserId: string;
  readonly secondUserId: string;
  readonly problemVersionId: string;
}

async function createFixture(
  store: CompetitiveStore,
  type: 'RANKED_PUBLIC' | 'UNRANKED_PUBLIC' | 'PRIVATE_UNRANKED' = 'RANKED_PUBLIC',
  options: {
    readonly startsAt?: Date;
    readonly durationSeconds?: number;
    readonly autoReady?: boolean;
  } = {}
): Promise<Fixture> {
  const fixture = {
    matchId: randomUUID(),
    firstUserId: randomUUID(),
    secondUserId: randomUUID(),
    problemVersionId: randomUUID()
  };
  const problemId = randomUUID();

  await Promise.all([
    store.provisionUser(fixture.firstUserId),
    store.provisionUser(fixture.secondUserId)
  ]);
  await store.provisionProblemVersion({
    problemId,
    versionId: fixture.problemVersionId,
    title: 'Test'
  });
  await store.createMatch({
    id: fixture.matchId,
    type,
    problemVersionId: fixture.problemVersionId,
    participantUserIds: [fixture.firstUserId, fixture.secondUserId],
    startsAt: options.startsAt ?? new Date(Date.now() - 1_000),
    ...(options.durationSeconds ? { durationSeconds: options.durationSeconds } : {})
  });
  if (options.autoReady !== false) {
    await store.markReady(fixture.matchId, fixture.firstUserId, 0);
    await store.markReady(fixture.matchId, fixture.secondUserId, 0);
  }
  return fixture;
}

async function admit(
  store: CompetitiveStore,
  fixture: Fixture,
  userId: string,
  submissionId: string
) {
  const requestHash = sha256(`${fixture.matchId}:${userId}:${submissionId}`);
  return store.admitSubmission({
    id: submissionId,
    matchId: fixture.matchId,
    userId,
    languageKey: 'python',
    runtimeVersion: '3.x',
    sourceRef: `submissions/${submissionId}`,
    source: 'print(1)',
    sourceSha256: sha256('print(1)'),
    requestHash,
    idempotencyKey: randomUUID()
  });
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function createCatalogFixture(database: Database): Promise<{
  readonly problemId: string;
  readonly versionId: string;
}> {
  const problemId = randomUUID();
  const versionId = randomUUID();
  await database`
    insert into devleague.problem (id, slug, status)
    values (${problemId}, ${`problem-${problemId}`}, 'PUBLISHED')
  `;
  await database`
    insert into devleague.problem_version (
      id, problem_id, version_number, title, statement_markdown,
      constraints_markdown, difficulty, practice_visible, competitive_eligible,
      published_at
    ) values (
      ${versionId}, ${problemId}, 1, 'Double', 'Double the input.',
      'Integer input.', 'EASY', true, true, clock_timestamp()
    )
  `;
  await database`
    insert into devleague.starter_code (problem_version_id, language_key, source)
    values (${versionId}, 'python', 'value = int(input())')
  `;
  await database`
    insert into devleague.test_case (
      id, problem_version_id, kind, ordinal, input_text, expected_output_text
    ) values
      (${randomUUID()}, ${versionId}, 'PUBLIC', 1, '1\n', '2\n'),
      (${randomUUID()}, ${versionId}, 'PRIVATE', 1, 'secret-input\n', 'secret-output\n')
  `;
  return { problemId, versionId };
}
