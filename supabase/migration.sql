-- ============================================================================
-- CareLivia PMK / Mutu Rumah Sakit — Supabase schema migration
-- Project: inmrsds (cqafepyaertswirexzfx)
--
-- Run this whole file once in Supabase Dashboard → SQL Editor → New query.
-- It's written to be safe to re-run (IF NOT EXISTS / idempotent DO blocks).
-- ============================================================================

-- Needed for gen_random_uuid(); already enabled on Supabase by default, but
-- harmless to assert.
create extension if not exists pgcrypto;

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- One row per authenticated user, 1:1 with auth.users. Created automatically
-- by the handle_new_user() trigger below whenever someone signs up.
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text,
  unit_id      text check (
    unit_id is null or unit_id in (
      'IGD', 'Rawat Jalan', 'Rawat Inap', 'ICU', 'Kamar Operasi',
      'VK', 'Laboratorium', 'Radiologi', 'Farmasi'
    )
  ),
  role         text not null default 'user' check (role in ('user', 'admin')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is
  'One row per user, extending auth.users with unit assignment and role.';

-- Replaces the old per-unit Firestore collections with one table. The
-- indicator-specific fields (staff, observer, room, m1..m5, rm, doctor,
-- t1/t2, etc.) live in the jsonb `data` column so the schema doesn't need
-- to change every time a new indicator type or field is added.
create table if not exists public.indicator_entries (
  id             uuid primary key default gen_random_uuid(),
  indicator_type text not null check (
    indicator_type in (
      'tangan', 'visite', 'identitas', 'apd', 'jatuh',
      'sc', 'wtrj', 'op', 'lab', 'fornas', 'cp'
    )
  ),
  unit_id        text not null check (
    unit_id in (
      'IGD', 'Rawat Jalan', 'Rawat Inap', 'ICU', 'Kamar Operasi',
      'VK', 'Laboratorium', 'Radiologi', 'Farmasi'
    )
  ),
  entry_date     date not null,
  data           jsonb not null default '{}'::jsonb,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.indicator_entries is
  'All patient-safety indicator observations across every unit (tangan, visite, identitas, apd, jatuh, sc, wtrj, op, lab, fornas, cp).';
comment on column public.indicator_entries.data is
  'Indicator-specific fields (staff, observer, room, rm, m1..m5, t1/t2, etc.), shape depends on indicator_type.';

create table if not exists public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  type       text not null check (type in ('block', 'login', 'input', 'mapping')),
  msg        text not null,
  badge      text,
  ts         text,
  user_id    uuid references auth.users (id) on delete set null,
  unit_id    text,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is
  'App-wide audit trail (logins, data entry, access blocks, unit mapping changes).';

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

create index if not exists idx_profiles_unit_id
  on public.profiles (unit_id);

create index if not exists idx_indicator_entries_unit_type
  on public.indicator_entries (unit_id, indicator_type);

create index if not exists idx_indicator_entries_type_date
  on public.indicator_entries (indicator_type, entry_date desc);

create index if not exists idx_indicator_entries_unit_type_date
  on public.indicator_entries (unit_id, indicator_type, entry_date desc);

create index if not exists idx_indicator_entries_created_by
  on public.indicator_entries (created_by);

-- Speeds up any future querying/filtering into the jsonb payload
-- (e.g. WHERE data->>'rm' = '...').
create index if not exists idx_indicator_entries_data_gin
  on public.indicator_entries using gin (data);

create index if not exists idx_audit_logs_created_at
  on public.audit_logs (created_at desc);

create index if not exists idx_audit_logs_user_id
  on public.audit_logs (user_id);

create index if not exists idx_audit_logs_type
  on public.audit_logs (type);

-- ============================================================================
-- 3. TRIGGERS — keep updated_at fresh, auto-create profile on signup
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_indicator_entries_updated_at on public.indicator_entries;
create trigger trg_indicator_entries_updated_at
  before update on public.indicator_entries
  for each row execute function public.set_updated_at();

-- Auto-creates a `profiles` row whenever a new user signs up (email/password
-- or Google OAuth). Reads display_name / unit_id from the signup metadata
-- that AuthContext.tsx passes via supabase.auth.signUp({ options: { data } }).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, unit_id, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'unit_id', ''),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

-- security definer so this can be safely called from inside the profiles
-- table's own RLS policies below without infinite recursion.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ── profiles ────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- Normal signup creates the row via the SECURITY DEFINER trigger above, not
-- a direct client insert — this policy just covers admin tooling.
drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin"
  on public.profiles for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- ── indicator_entries ──────────────────────────────────────────────────
-- By design the dashboard shows cross-unit views ("Semua Unit", compliance
-- timelines), so every signed-in staff member can READ all units' data.
-- Writes are restricted to the entry's own creator (or an admin).
alter table public.indicator_entries enable row level security;

drop policy if exists "entries_select_authenticated" on public.indicator_entries;
create policy "entries_select_authenticated"
  on public.indicator_entries for select
  to authenticated
  using (true);

drop policy if exists "entries_insert_own" on public.indicator_entries;
create policy "entries_insert_own"
  on public.indicator_entries for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "entries_update_own_or_admin" on public.indicator_entries;
create policy "entries_update_own_or_admin"
  on public.indicator_entries for update
  to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

drop policy if exists "entries_delete_own_or_admin" on public.indicator_entries;
create policy "entries_delete_own_or_admin"
  on public.indicator_entries for delete
  to authenticated
  using (created_by = auth.uid() or public.is_admin());

-- ── audit_logs ─────────────────────────────────────────────────────────
alter table public.audit_logs enable row level security;

drop policy if exists "audit_select_authenticated" on public.audit_logs;
create policy "audit_select_authenticated"
  on public.audit_logs for select
  to authenticated
  using (true);

drop policy if exists "audit_insert_authenticated" on public.audit_logs;
create policy "audit_insert_authenticated"
  on public.audit_logs for insert
  to authenticated
  with check (true);

drop policy if exists "audit_delete_admin_only" on public.audit_logs;
create policy "audit_delete_admin_only"
  on public.audit_logs for delete
  to authenticated
  using (public.is_admin());

-- ============================================================================
-- 5. REALTIME — lets subscribeToAllIndicators()/subscribeToAuditLogs() in
--    src/lib/supabaseData.ts receive live postgres_changes events.
-- ============================================================================

do $$
begin
  alter publication supabase_realtime add table public.indicator_entries;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.audit_logs;
exception when duplicate_object then null;
end $$;

-- ============================================================================
-- 6. ONE-TIME SETUP — run manually after the app has at least one user
-- ============================================================================

-- Promote your own account to admin (needed to clear audit logs, edit/
-- delete other users' entries, etc.). Replace the email, then run just
-- this one line separately after you've signed up in the app:
--
--   update public.profiles set role = 'admin' where email = 'you@example.com';
