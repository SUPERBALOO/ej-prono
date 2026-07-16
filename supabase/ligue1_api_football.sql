-- Preparation Ligue 1 avec API-Football / API-Sports.
-- A executer une fois dans Supabase avant de creer/importer le concours Ligue 1.

alter table public.competitions
  add column if not exists api_provider text not null default 'football-data',
  add column if not exists api_league_id integer,
  add column if not exists api_season integer,
  add column if not exists country text,
  add column if not exists logo_url text;

create table if not exists public.competition_team_rankings (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  season integer not null,
  team_name text not null,
  previous_rank integer not null,
  strength_points numeric,
  home_bonus_points numeric not null default 60,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id, season, team_name)
);

do $$
begin
  if not exists (
    select 1
    from public.competitions
    where nom = 'Ligue 1 2026-2027'
  ) then
    insert into public.competitions (
      nom,
      sport,
      api_competition_id,
      api_provider,
      api_league_id,
      api_season,
      country,
      actif
    )
    values (
      'Ligue 1 2026-2027',
      'football',
      '61',
      'api-football',
      61,
      2026,
      'France',
      true
    );
  else
    update public.competitions
    set api_competition_id = '61',
        sport = 'football',
        api_provider = 'api-football',
        api_league_id = 61,
        api_season = 2026,
        country = 'France',
        actif = true
    where nom = 'Ligue 1 2026-2027';
  end if;
end $$;

-- Optionnel mais conseille :
-- renseigner ici le classement N-1 si tu veux controler les cotes de depart.
-- Si cette table reste vide, l'application tentera de recuperer le classement
-- 2025 via API-Football lors de l'import des matchs Ligue 1 2026.
--
-- Exemple :
--
-- with ligue1 as (
--   select id from public.competitions where nom = 'Ligue 1 2026-2027'
-- )
-- insert into public.competition_team_rankings (
--   competition_id,
--   season,
--   team_name,
--   previous_rank,
--   strength_points,
--   home_bonus_points
-- )
-- select
--   ligue1.id,
--   2026,
--   data.team_name,
--   data.previous_rank,
--   data.strength_points,
--   60
-- from ligue1
-- cross join (
--   values
--     ('Paris Saint Germain', 1, 1850),
--     ('Lens', 2, 1815),
--     ('Troyes', 17, 1290),
--     ('Le Mans', 18, 1255)
-- ) as data(team_name, previous_rank, strength_points)
-- on conflict (competition_id, season, team_name)
-- do update set
--   previous_rank = excluded.previous_rank,
--   strength_points = excluded.strength_points,
--   home_bonus_points = excluded.home_bonus_points,
--   active = true,
--   updated_at = now();
