create schema if not exists devleague;

create table if not exists devleague.schema_migration (
  version text primary key,
  checksum text not null,
  applied_at timestamptz not null default clock_timestamp()
);

create table devleague.app_user (
  id uuid primary key,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'SUSPENDED', 'DELETED')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table devleague.rating_account (
  user_id uuid primary key references devleague.app_user(id),
  current_rating integer not null default 1200 check (current_rating >= 0),
  peak_rating integer not null default 1200 check (peak_rating >= 0),
  games integer not null default 0 check (games >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  algorithm_version text not null default 'elo-v1',
  updated_at timestamptz not null default clock_timestamp()
);

create table devleague.problem (
  id uuid primary key,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'PUBLISHED', 'DISABLED')),
  created_at timestamptz not null default clock_timestamp()
);

create table devleague.problem_version (
  id uuid primary key,
  problem_id uuid not null references devleague.problem(id),
  version_number integer not null check (version_number > 0),
  title text not null,
  competitive_eligible boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  unique (problem_id, version_number)
);

create table devleague.match (
  id uuid primary key,
  type text not null check (type in ('RANKED_PUBLIC', 'PRIVATE_UNRANKED')),
  status text not null check (status in (
    'COUNTDOWN', 'ACTIVE', 'RESOLVING', 'FINISHED', 'CANCELLED'
  )),
  problem_version_id uuid not null references devleague.problem_version(id),
  duration_seconds integer not null check (duration_seconds > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  finished_at timestamptz,
  winner_user_id uuid references devleague.app_user(id),
  result_reason text check (result_reason in (
    'ACCEPTED', 'FORFEIT', 'DRAW_TIMEOUT', 'VOID_SYSTEM'
  )),
  winning_submission_id uuid,
  next_submission_seq integer not null default 1 check (next_submission_seq > 0),
  rating_policy_version text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (ends_at > starts_at),
  check (
    (status = 'FINISHED' and finished_at is not null and result_reason is not null)
    or (status <> 'FINISHED' and finished_at is null and result_reason is null)
  ),
  check (
    (type = 'RANKED_PUBLIC' and rating_policy_version is not null)
    or (type = 'PRIVATE_UNRANKED' and rating_policy_version is null)
  )
);

create table devleague.match_participant (
  match_id uuid not null references devleague.match(id) on delete cascade,
  user_id uuid not null references devleague.app_user(id),
  slot smallint not null check (slot in (1, 2)),
  rating_snapshot integer check (rating_snapshot >= 0),
  result text check (result in ('WIN', 'LOSS', 'DRAW', 'VOID')),
  joined_at timestamptz not null default clock_timestamp(),
  primary key (match_id, user_id),
  unique (match_id, slot)
);

create table devleague.active_engagement (
  user_id uuid primary key references devleague.app_user(id),
  match_id uuid not null references devleague.match(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp()
);

create table devleague.submission (
  id uuid primary key,
  match_id uuid not null,
  user_id uuid not null,
  admission_seq integer not null check (admission_seq > 0),
  language_key text not null check (language_key in ('python', 'java', 'javascript', 'cpp')),
  runtime_version text not null,
  source_ref text not null,
  source_sha256 text not null check (length(source_sha256) = 64),
  request_hash text not null check (length(request_hash) = 64),
  idempotency_key text not null,
  status text not null default 'QUEUED'
    check (status in ('QUEUED', 'RUNNING', 'FINISHED')),
  verdict text check (verdict in (
    'ACCEPTED', 'WRONG_ANSWER', 'COMPILE_ERROR', 'RUNTIME_ERROR',
    'TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED',
    'OUTPUT_LIMIT_EXCEEDED', 'SYSTEM_ERROR', 'CANCELLED'
  )),
  eligible_received_at timestamptz not null,
  finished_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (match_id, user_id)
    references devleague.match_participant(match_id, user_id),
  unique (match_id, admission_seq),
  unique (match_id, user_id, idempotency_key),
  check (
    (status = 'FINISHED' and verdict is not null and finished_at is not null)
    or (status <> 'FINISHED' and verdict is null and finished_at is null)
  )
);

alter table devleague.match
  add constraint match_winning_submission_fk
  foreign key (winning_submission_id) references devleague.submission(id);

create table devleague.rating_history (
  id uuid primary key,
  user_id uuid not null references devleague.app_user(id),
  match_id uuid not null references devleague.match(id),
  rating_before integer not null check (rating_before >= 0),
  expected_score double precision not null check (expected_score between 0 and 1),
  actual_score double precision not null check (actual_score between 0 and 1),
  delta integer not null,
  rating_after integer not null check (rating_after >= 0),
  algorithm_version text not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (user_id, match_id)
);

create table devleague.outbox_event (
  id uuid primary key,
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  schema_version integer not null check (schema_version > 0),
  payload jsonb not null,
  dedupe_key text not null unique,
  created_at timestamptz not null default clock_timestamp(),
  published_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0)
);

create index match_status_ends_at_idx
  on devleague.match(status, ends_at)
  where status in ('ACTIVE', 'RESOLVING');

create index submission_pending_idx
  on devleague.submission(match_id, admission_seq)
  where status <> 'FINISHED';

create index outbox_unpublished_idx
  on devleague.outbox_event(created_at)
  where published_at is null;
