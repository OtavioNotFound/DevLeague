alter table devleague.submission
  add column source_text text not null default '';

alter table devleague.execution_job
  alter column practice_submission_id drop not null,
  add column match_submission_id uuid unique
    references devleague.submission(id) on delete cascade,
  add column verdict text check (verdict in (
    'ACCEPTED', 'WRONG_ANSWER', 'COMPILE_ERROR', 'RUNTIME_ERROR',
    'TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED',
    'OUTPUT_LIMIT_EXCEEDED', 'SYSTEM_ERROR', 'CANCELLED'
  )),
  add column cpu_ms integer check (cpu_ms is null or cpu_ms >= 0),
  add column wall_ms integer check (wall_ms is null or wall_ms >= 0),
  add column peak_memory_kb integer check (peak_memory_kb is null or peak_memory_kb >= 0),
  add constraint execution_job_exactly_one_submission check (
    (practice_submission_id is not null and match_submission_id is null)
    or (practice_submission_id is null and match_submission_id is not null)
  );

create index execution_job_match_idx
  on devleague.execution_job(match_submission_id)
  where match_submission_id is not null;
