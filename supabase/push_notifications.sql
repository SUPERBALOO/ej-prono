create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

create index if not exists push_subscriptions_enabled_idx
  on public.push_subscriptions(enabled);

create table if not exists public.push_reminder_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  reminder_type text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, match_id, reminder_type)
);

create index if not exists push_reminder_logs_match_id_idx
  on public.push_reminder_logs(match_id);

alter table public.push_subscriptions enable row level security;
alter table public.push_reminder_logs enable row level security;

drop policy if exists "Users can read own push subscriptions"
  on public.push_subscriptions;

create policy "Users can read own push subscriptions"
  on public.push_subscriptions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read own reminder logs"
  on public.push_reminder_logs;

create policy "Users can read own reminder logs"
  on public.push_reminder_logs
  for select
  using (auth.uid() = user_id);
