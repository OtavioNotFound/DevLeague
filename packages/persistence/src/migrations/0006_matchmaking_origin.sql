alter table devleague.match add column origin_key text;

create unique index match_origin_key_unique
  on devleague.match(origin_key)
  where origin_key is not null;
