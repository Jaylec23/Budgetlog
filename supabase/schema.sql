-- =========================================================
-- Shared Supabase setup for all your apps (Budgetlog, Plate Log…)
-- Paste into Supabase → SQL Editor → Run. Run it once per Supabase
-- project — every app that uses the project shares it.
--
-- One login (auth.users) works across every app.
-- Each app saves its data in its own row: (user_id, app).
--   Budgetlog → app = 'budgetlog'
--   Plate Log → app = 'platelog'   (set appId in that app's config)
-- Row-level security means people can only read or change their
-- own rows, in any app.
-- =========================================================

create table if not exists public.app_data (
  user_id    uuid not null references auth.users (id) on delete cascade,
  app        text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, app)
);

alter table public.app_data enable row level security;

create policy "Read own app data"   on public.app_data for select using (auth.uid() = user_id);
create policy "Create own app data" on public.app_data for insert with check (auth.uid() = user_id);
create policy "Update own app data" on public.app_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own app data" on public.app_data for delete using (auth.uid() = user_id);

-- Deleting someone's login (Supabase dashboard → Authentication → Users)
-- removes their data in every app automatically (on delete cascade).
