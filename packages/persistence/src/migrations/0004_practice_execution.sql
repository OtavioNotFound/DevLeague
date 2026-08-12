create table devleague.practice_submission (
  id uuid primary key,
  user_id uuid not null references devleague.app_user(id),
  problem_version_id uuid not null references devleague.problem_version(id),
  kind text not null check (kind in ('RUN', 'SUBMIT')),
  language_key text not null check (language_key in ('python', 'java', 'javascript', 'cpp')),
  runtime_version text not null,
  source_text text not null,
  source_sha256 text not null check (length(source_sha256) = 64),
  custom_stdin text,
  request_hash text not null check (length(request_hash) = 64),
  idempotency_key text not null,
  status text not null default 'QUEUED'
    check (status in ('QUEUED', 'RUNNING', 'FINISHED')),
  verdict text check (verdict in (
    'ACCEPTED', 'WRONG_ANSWER', 'COMPILE_ERROR', 'RUNTIME_ERROR',
    'TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED',
    'OUTPUT_LIMIT_EXCEEDED', 'SYSTEM_ERROR', 'CANCELLED'
  )),
  stdout text,
  stderr text,
  compile_output text,
  cpu_ms integer check (cpu_ms is null or cpu_ms >= 0),
  wall_ms integer check (wall_ms is null or wall_ms >= 0),
  peak_memory_kb integer check (peak_memory_kb is null or peak_memory_kb >= 0),
  created_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  unique (user_id, kind, idempotency_key),
  check ((kind = 'RUN') or custom_stdin is null),
  check (
    (status = 'FINISHED' and verdict is not null and finished_at is not null)
    or (status <> 'FINISHED' and verdict is null and finished_at is null)
  )
);

create table devleague.execution_job (
  id uuid primary key,
  practice_submission_id uuid not null unique
    references devleague.practice_submission(id) on delete cascade,
  status text not null default 'QUEUED'
    check (status in ('QUEUED', 'RUNNING', 'FINISHED')),
  priority smallint not null check (priority between 1 and 10),
  attempt integer not null default 0 check (attempt >= 0),
  available_at timestamptz not null default clock_timestamp(),
  claimed_at timestamptz,
  finished_at timestamptz,
  provider_key text,
  provider_failure_category text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (
    (status = 'QUEUED' and claimed_at is null and finished_at is null)
    or (status = 'RUNNING' and claimed_at is not null and finished_at is null)
    or (status = 'FINISHED' and claimed_at is not null and finished_at is not null)
  )
);

create index execution_job_claim_idx
  on devleague.execution_job(priority desc, available_at, created_at)
  where status = 'QUEUED';

create index practice_submission_owner_idx
  on devleague.practice_submission(user_id, created_at desc);
