alter table public.push_subscriptions
  add column if not exists news_enabled boolean not null default false;

create index if not exists push_subscriptions_news_enabled_idx
  on public.push_subscriptions(news_enabled)
  where enabled = true and news_enabled = true;

create table if not exists public.news_notification_state (
  source text primary key,
  last_article_url text not null,
  updated_at timestamptz not null default now()
);

alter table public.news_notification_state enable row level security;
