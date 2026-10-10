-- Alertas push del navegador: suscripciones con preferencias y registro de envíos.
-- Solo las usa el servidor con la service role: RLS activo y sin políticas.

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  -- { "minMagnitude": 6, "cyclones": true, "volcanoes": true, "disasters": true }
  prefs jsonb not null default '{}'::jsonb,
  locale text not null default 'es' check (locale in ('es', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_error text,
  failures integer not null default 0
);

create table if not exists public.push_sent (
  event_key text primary key,
  sent_at timestamptz not null default now()
);

create index if not exists push_sent_sent_at_idx on public.push_sent (sent_at);

alter table public.push_subscriptions enable row level security;
alter table public.push_sent enable row level security;
