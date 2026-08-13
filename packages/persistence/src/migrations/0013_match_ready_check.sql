alter table devleague.match
  add column lobby_expires_at timestamptz;

alter table devleague.match_participant
  add column ready_at timestamptz;

create index match_lobby_expiry_idx
  on devleague.match(lobby_expires_at)
  where status = 'COUNTDOWN';
