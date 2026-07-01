do $$
declare
  constraint_record record;
  index_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.matches'::regclass
      and contype = 'u'
      and array_length(conkey, 1) = 1
      and conkey[1] = (
        select attnum
        from pg_attribute
        where attrelid = 'public.matches'::regclass
          and attname = 'api_match_id'
      )
  loop
    execute format(
      'alter table public.matches drop constraint %I',
      constraint_record.conname
    );
  end loop;

  for index_record in
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'matches'
      and indexdef ilike '%unique%'
      and indexdef ilike '%api_match_id%'
      and indexdef not ilike '%concours_id%'
  loop
    execute format(
      'drop index if exists public.%I',
      index_record.indexname
    );
  end loop;
end $$;

alter table public.matches
  drop constraint if exists matches_concours_api_match_unique;

alter table public.matches
  add constraint matches_concours_api_match_unique
  unique (concours_id, api_match_id);
