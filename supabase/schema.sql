-- CUTROOM STUDIO cloud storage: run in Supabase SQL Editor
-- Authentication is managed by Supabase Auth (Google provider).
-- These policies never permit anonymous access or access to another user's rows.
create table if not exists public.cutroom_accounts (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 200),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create table if not exists public.cutroom_projects (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 200),
  account_id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint cutroom_projects_owner_account_fk foreign key (user_id, account_id)
    references public.cutroom_accounts(user_id, id) on update cascade on delete restrict
);
create index if not exists cutroom_projects_account_idx
  on public.cutroom_projects(user_id, account_id, updated_at desc);

alter table public.cutroom_accounts enable row level security;
alter table public.cutroom_projects enable row level security;
alter table public.cutroom_accounts force row level security;
alter table public.cutroom_projects force row level security;

revoke all on public.cutroom_accounts from anon, public;
revoke all on public.cutroom_projects from anon, public;
grant select, insert, update, delete on public.cutroom_accounts to authenticated;
grant select, insert, update, delete on public.cutroom_projects to authenticated;

drop policy if exists "cutroom_accounts_select_own" on public.cutroom_accounts;
drop policy if exists "cutroom_accounts_insert_own" on public.cutroom_accounts;
drop policy if exists "cutroom_accounts_update_own" on public.cutroom_accounts;
drop policy if exists "cutroom_accounts_delete_own" on public.cutroom_accounts;
create policy "cutroom_accounts_select_own" on public.cutroom_accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "cutroom_accounts_insert_own" on public.cutroom_accounts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "cutroom_accounts_update_own" on public.cutroom_accounts
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "cutroom_accounts_delete_own" on public.cutroom_accounts
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "cutroom_projects_select_own" on public.cutroom_projects;
drop policy if exists "cutroom_projects_insert_own" on public.cutroom_projects;
drop policy if exists "cutroom_projects_update_own" on public.cutroom_projects;
drop policy if exists "cutroom_projects_delete_own" on public.cutroom_projects;
create policy "cutroom_projects_select_own" on public.cutroom_projects
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "cutroom_projects_insert_own" on public.cutroom_projects
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "cutroom_projects_update_own" on public.cutroom_projects
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "cutroom_projects_delete_own" on public.cutroom_projects
  for delete to authenticated using ((select auth.uid()) = user_id);
