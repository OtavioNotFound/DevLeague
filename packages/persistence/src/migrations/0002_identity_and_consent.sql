alter table devleague.app_user
  add column auth_subject text,
  add column deleted_at timestamptz;

create unique index app_user_auth_subject_unique
  on devleague.app_user(auth_subject)
  where auth_subject is not null;

create table devleague.profile (
  user_id uuid primary key references devleague.app_user(id) on delete cascade,
  username text not null,
  username_normalized text not null unique,
  avatar_ref text,
  preferred_languages text[] not null default '{}',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (char_length(username) between 3 and 24),
  check (username_normalized = lower(username_normalized)),
  check (
    preferred_languages <@ array['python', 'java', 'javascript', 'cpp']::text[]
  )
);

create table devleague.consent_record (
  id uuid primary key,
  user_id uuid not null references devleague.app_user(id) on delete cascade,
  document_type text not null check (document_type in ('TERMS', 'PRIVACY')),
  document_version text not null,
  age_declaration text not null check (age_declaration = 'OVER_18'),
  source text not null check (source in ('WEB', 'ASSISTED_ALPHA')),
  accepted_at timestamptz not null default clock_timestamp(),
  unique (user_id, document_type, document_version)
);

create index consent_record_user_idx
  on devleague.consent_record(user_id, accepted_at desc);
