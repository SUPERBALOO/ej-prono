alter table public.matches
  add column if not exists full_time_home_score integer,
  add column if not exists full_time_away_score integer,
  add column if not exists extra_time_home_score integer,
  add column if not exists extra_time_away_score integer,
  add column if not exists penalty_home_score integer,
  add column if not exists penalty_away_score integer,
  add column if not exists score_duration text,
  add column if not exists score_details jsonb;
