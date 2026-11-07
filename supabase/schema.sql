-- Tokyo Trip Planner: shared trip storage.
-- Run once in Supabase Dashboard → SQL Editor → New query → paste → Run.

create table if not exists public.trips (
  id          text primary key,                 -- 'main' (one shared trip)
  data        jsonb       not null,             -- the whole trip (TripData)
  version     integer     not null default 1,   -- bumped on every save; used to detect edit conflicts
  updated_at  timestamptz not null default now()
);

-- Row Level Security on, with no policies: the public (anon) key can't read or write this table.
-- Only the app's server (/api/trip, using the secret key) can, after checking the member's PIN.
alter table public.trips enable row level security;
