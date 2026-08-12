alter table devleague.problem
  add column slug text,
  add column updated_at timestamptz not null default clock_timestamp();

update devleague.problem
set slug = 'problem-' || replace(id::text, '-', '')
where slug is null;

alter table devleague.problem alter column slug set not null;
alter table devleague.problem add constraint problem_slug_unique unique (slug);

alter table devleague.problem_version
  add column statement_markdown text not null default '',
  add column constraints_markdown text not null default '',
  add column difficulty text not null default 'EASY'
    check (difficulty in ('EASY', 'MEDIUM', 'HARD')),
  add column practice_visible boolean not null default false,
  add column comparator text not null default 'TRIM_FINAL_NEWLINES'
    check (comparator in ('EXACT', 'TRIM_FINAL_NEWLINES', 'TOKENS')),
  add column cpu_ms integer not null default 1000 check (cpu_ms > 0),
  add column wall_ms integer not null default 3000 check (wall_ms >= cpu_ms),
  add column memory_kb integer not null default 262144 check (memory_kb > 0),
  add column processes integer not null default 8 check (processes > 0),
  add column output_bytes integer not null default 65536 check (output_bytes > 0),
  add column file_bytes integer not null default 1048576 check (file_bytes > 0),
  add column published_at timestamptz;

create table devleague.problem_category (
  key text primary key,
  label text not null
);

create table devleague.problem_category_link (
  problem_id uuid not null references devleague.problem(id) on delete cascade,
  category_key text not null references devleague.problem_category(key),
  primary key (problem_id, category_key)
);

create table devleague.starter_code (
  problem_version_id uuid not null references devleague.problem_version(id) on delete cascade,
  language_key text not null check (language_key in ('python', 'java', 'javascript', 'cpp')),
  source text not null,
  primary key (problem_version_id, language_key)
);

create table devleague.test_case (
  id uuid primary key,
  problem_version_id uuid not null references devleague.problem_version(id) on delete cascade,
  kind text not null check (kind in ('PUBLIC', 'PRIVATE')),
  ordinal integer not null check (ordinal > 0),
  input_text text not null,
  expected_output_text text not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (problem_version_id, kind, ordinal)
);

create table devleague.problem_exposure (
  id uuid primary key,
  user_id uuid not null references devleague.app_user(id) on delete cascade,
  problem_version_id uuid not null references devleague.problem_version(id),
  context text not null check (context in ('PRACTICE', 'MATCH')),
  match_id uuid references devleague.match(id),
  exposed_at timestamptz not null default clock_timestamp(),
  check (
    (context = 'PRACTICE' and match_id is null)
    or (context = 'MATCH' and match_id is not null)
  )
);

create index problem_catalog_idx
  on devleague.problem_version(practice_visible, difficulty, id)
  where practice_visible = true;

create index problem_exposure_user_idx
  on devleague.problem_exposure(user_id, exposed_at desc);
