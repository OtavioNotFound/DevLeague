alter table devleague.rating_account
  alter column current_rating set default 0,
  alter column peak_rating set default 0;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'devleague.match'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%type%'
  loop
    execute format('alter table devleague.match drop constraint %I', constraint_name);
  end loop;
end $$;

alter table devleague.match
  add constraint match_type_supported_check
    check (type in ('RANKED_PUBLIC', 'UNRANKED_PUBLIC', 'PRIVATE_UNRANKED')),
  add constraint match_rating_policy_check
    check (
      (type = 'RANKED_PUBLIC' and rating_policy_version is not null)
      or (type in ('UNRANKED_PUBLIC', 'PRIVATE_UNRANKED') and rating_policy_version is null)
    );

-- Alpha reset: every participant starts the public ranked ladder from zero.
delete from devleague.rating_history;

update devleague.rating_account
set current_rating = 0,
    peak_rating = 0,
    games = 0,
    wins = 0,
    losses = 0,
    draws = 0,
    algorithm_version = 'elo-v1',
    updated_at = clock_timestamp();
