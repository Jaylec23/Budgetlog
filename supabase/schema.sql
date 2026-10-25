-- =========================================================
-- Budgetlog storage — already applied to "Jaylec23's Project"
-- (the same Supabase project as Plate Log) on 2026-10-25.
-- Kept here as a record / for setting up a fresh project.
--
-- One login (auth.users) is shared by every app in the project.
-- Plate Log keeps its data in its own `docs` table.
-- Budgetlog (and future trackers) save one JSON document per
-- person per app in `app_data`: (user_id, app = 'budgetlog').
-- Row-level security: people can only read or change their own rows.
-- =========================================================

create table if not exists public.app_data (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  app        text not null check (char_length(app) between 1 and 40),
  data       jsonb not null default '{}'::jsonb check (octet_length(data::text) < 5000000),
  updated_at timestamptz not null default now(),
  primary key (user_id, app)
);

alter table public.app_data enable row level security;

create policy "app_data_select_own" on public.app_data for select to authenticated using ((select auth.uid()) = user_id);
create policy "app_data_insert_own" on public.app_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "app_data_update_own" on public.app_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "app_data_delete_own" on public.app_data for delete to authenticated using ((select auth.uid()) = user_id);

-- Deleting someone's login (Dashboard → Authentication → Users)
-- removes their data in every app automatically (on delete cascade).
