-- ============================================================================
-- INMrsds — FITUR IMPORT & DOWNLOAD TEMPLATE — Modul INM (Indikator Mutu
-- Nasional, 11 indikator legacy di public.indicator_entries).
--
-- Dijalankan SETELAH migration.sql DAN migration_import_export.sql (memakai
-- tabel import_history/import_error_log serta log_import_audit() dari sana).
-- Aman dijalankan berulang.
--
-- Beda dari 6 modul lain: satu tabel indicator_entries menampung 11 "bentuk
-- form" berbeda (kolom spesifik ada di jsonb `data`), sehingga dibuatkan
-- SATU fungsi RPC PER indikator (bukan satu fungsi generik) supaya masing-
-- masing bisa punya UNIQUE INDEX & ON CONFLICT DO UPDATE yang presisi sesuai
-- kunci alami indikator tsb (bagian 13 & 17: deteksi duplikasi + rollback).
--
-- Akses: mengikuti kebijakan RLS existing tabel indicator_entries (bagian
-- 4 migration.sql) — SEMUA staf yang login boleh input data unit manapun
-- (tidak ada role reviewer khusus untuk modul ini), tapi UPDATE lewat
-- import (baris duplikat yang dipilih "Perbarui") hanya berlaku bila baris
-- lama dibuat oleh actor yang sama atau actor adalah admin — persis seperti
-- kebijakan "entries_update_own_or_admin" yang sudah ada. Bila tidak
-- berwenang, baris itu dilewati (bukan meng-gagalkan seluruh batch).
-- ============================================================================

create extension if not exists pgcrypto;

alter table public.audit_logs drop constraint if exists audit_logs_type_check;
alter table public.audit_logs add constraint audit_logs_type_check
  check (type in ('block', 'login', 'input', 'mapping', 'ikp', 'risk', 'budaya', 'uimu', 'custom_indicator', 'kepuasan', 'import'));

-- ── UNIQUE INDEX — tangan (kunci: entry_date + unit_id + staff + room) ──
create unique index if not exists uniq_inm_tangan on public.indicator_entries
  (entry_date,
    unit_id,
    (data->>'staff'),
    (data->>'room'))
  where indicator_type = 'tangan';

-- ── UNIQUE INDEX — visite (kunci: entry_date + unit_id + rm) ──
create unique index if not exists uniq_inm_visite on public.indicator_entries
  (entry_date,
    unit_id,
    (data->>'rm'))
  where indicator_type = 'visite';

-- ── UNIQUE INDEX — identitas (kunci: entry_date + unit_id + rm + service) ──
create unique index if not exists uniq_inm_identitas on public.indicator_entries
  (entry_date,
    unit_id,
    (data->>'rm'),
    (data->>'service'))
  where indicator_type = 'identitas';

-- ── UNIQUE INDEX — apd (kunci: entry_date + unit_id + room + staff) ──
create unique index if not exists uniq_inm_apd on public.indicator_entries
  (entry_date,
    unit_id,
    (data->>'room'),
    (data->>'staff'))
  where indicator_type = 'apd';

-- ── UNIQUE INDEX — jatuh (kunci: entry_date + unit_id + rm) ──
create unique index if not exists uniq_inm_jatuh on public.indicator_entries
  (entry_date,
    unit_id,
    (data->>'rm'))
  where indicator_type = 'jatuh';

-- ── UNIQUE INDEX — sc (kunci: entry_date + unit_id + rm) ──
create unique index if not exists uniq_inm_sc on public.indicator_entries
  (entry_date,
    unit_id,
    (data->>'rm'))
  where indicator_type = 'sc';

-- ── UNIQUE INDEX — wtrj (kunci: entry_date + unit_id + rm) ──
create unique index if not exists uniq_inm_wtrj on public.indicator_entries
  (entry_date,
    unit_id,
    (data->>'rm'))
  where indicator_type = 'wtrj';

-- ── UNIQUE INDEX — op (kunci: entry_date + unit_id + rm) ──
create unique index if not exists uniq_inm_op on public.indicator_entries
  (entry_date,
    unit_id,
    (data->>'rm'))
  where indicator_type = 'op';

-- ── UNIQUE INDEX — lab (kunci: entry_date + unit_id + rm + exam) ──
create unique index if not exists uniq_inm_lab on public.indicator_entries
  (entry_date,
    unit_id,
    (data->>'rm'),
    (data->>'exam'))
  where indicator_type = 'lab';

-- ── UNIQUE INDEX — fornas (kunci: entry_date + unit_id) ──
create unique index if not exists uniq_inm_fornas on public.indicator_entries
  (entry_date,
    unit_id)
  where indicator_type = 'fornas';

-- ── UNIQUE INDEX — cp (kunci: entry_date + unit_id + rm) ──
create unique index if not exists uniq_inm_cp on public.indicator_entries
  (entry_date,
    unit_id,
    (data->>'rm'))
  where indicator_type = 'cp';

-- ============================================================================
-- RPC — INM TANGAN
-- ============================================================================
create or replace function public.inm_import_batch_tangan(p_payload jsonb, p_actor uuid)
returns table (success_count int, inserted_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_data jsonb;
  v_row_data jsonb;
  v_unit text;
  v_date date;
  v_new_id uuid;
  v_count int := 0;
  v_ids uuid[] := '{}';
begin
  if p_actor is distinct from auth.uid() then
    raise exception 'Actor tidak sesuai dengan pengguna yang sedang login.';
  end if;

  for v_item in select * from jsonb_array_elements(p_payload) loop
    v_data := v_item -> 'data';
    v_unit := v_data->>'unit_id';
    v_date := (v_data->>'entry_date')::date;
    v_row_data := v_data - 'unit_id' - 'entry_date';

    insert into public.indicator_entries (indicator_type, unit_id, entry_date, data, created_by)
    values ('tangan', v_unit, v_date, v_row_data, p_actor)
    on conflict (entry_date, unit_id, (data->>'staff'), (data->>'room')) where indicator_type = 'tangan'
    do update set data = excluded.data, updated_at = now()
      where public.indicator_entries.created_by = p_actor or public.is_admin()
    returning id into v_new_id;

    if v_new_id is not null then
      v_count := v_count + 1;
      v_ids := array_append(v_ids, v_new_id);
    end if;
  end loop;

  perform public.log_import_audit('inm_tangan', format('Import %s data INM (tangan)', v_count), p_actor);
  return query select v_count, v_ids;
end;
$$;

-- ============================================================================
-- RPC — INM VISITE
-- ============================================================================
create or replace function public.inm_import_batch_visite(p_payload jsonb, p_actor uuid)
returns table (success_count int, inserted_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_data jsonb;
  v_row_data jsonb;
  v_unit text;
  v_date date;
  v_new_id uuid;
  v_count int := 0;
  v_ids uuid[] := '{}';
begin
  if p_actor is distinct from auth.uid() then
    raise exception 'Actor tidak sesuai dengan pengguna yang sedang login.';
  end if;

  for v_item in select * from jsonb_array_elements(p_payload) loop
    v_data := v_item -> 'data';
    v_unit := v_data->>'unit_id';
    v_date := (v_data->>'entry_date')::date;
    v_row_data := v_data - 'unit_id' - 'entry_date';

    insert into public.indicator_entries (indicator_type, unit_id, entry_date, data, created_by)
    values ('visite', v_unit, v_date, v_row_data, p_actor)
    on conflict (entry_date, unit_id, (data->>'rm')) where indicator_type = 'visite'
    do update set data = excluded.data, updated_at = now()
      where public.indicator_entries.created_by = p_actor or public.is_admin()
    returning id into v_new_id;

    if v_new_id is not null then
      v_count := v_count + 1;
      v_ids := array_append(v_ids, v_new_id);
    end if;
  end loop;

  perform public.log_import_audit('inm_visite', format('Import %s data INM (visite)', v_count), p_actor);
  return query select v_count, v_ids;
end;
$$;

-- ============================================================================
-- RPC — INM IDENTITAS
-- ============================================================================
create or replace function public.inm_import_batch_identitas(p_payload jsonb, p_actor uuid)
returns table (success_count int, inserted_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_data jsonb;
  v_row_data jsonb;
  v_unit text;
  v_date date;
  v_new_id uuid;
  v_count int := 0;
  v_ids uuid[] := '{}';
begin
  if p_actor is distinct from auth.uid() then
    raise exception 'Actor tidak sesuai dengan pengguna yang sedang login.';
  end if;

  for v_item in select * from jsonb_array_elements(p_payload) loop
    v_data := v_item -> 'data';
    v_unit := v_data->>'unit_id';
    v_date := (v_data->>'entry_date')::date;
    v_row_data := v_data - 'unit_id' - 'entry_date';

    insert into public.indicator_entries (indicator_type, unit_id, entry_date, data, created_by)
    values ('identitas', v_unit, v_date, v_row_data, p_actor)
    on conflict (entry_date, unit_id, (data->>'rm'), (data->>'service')) where indicator_type = 'identitas'
    do update set data = excluded.data, updated_at = now()
      where public.indicator_entries.created_by = p_actor or public.is_admin()
    returning id into v_new_id;

    if v_new_id is not null then
      v_count := v_count + 1;
      v_ids := array_append(v_ids, v_new_id);
    end if;
  end loop;

  perform public.log_import_audit('inm_identitas', format('Import %s data INM (identitas)', v_count), p_actor);
  return query select v_count, v_ids;
end;
$$;

-- ============================================================================
-- RPC — INM APD
-- ============================================================================
create or replace function public.inm_import_batch_apd(p_payload jsonb, p_actor uuid)
returns table (success_count int, inserted_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_data jsonb;
  v_row_data jsonb;
  v_unit text;
  v_date date;
  v_new_id uuid;
  v_count int := 0;
  v_ids uuid[] := '{}';
begin
  if p_actor is distinct from auth.uid() then
    raise exception 'Actor tidak sesuai dengan pengguna yang sedang login.';
  end if;

  for v_item in select * from jsonb_array_elements(p_payload) loop
    v_data := v_item -> 'data';
    v_unit := v_data->>'unit_id';
    v_date := (v_data->>'entry_date')::date;
    v_row_data := v_data - 'unit_id' - 'entry_date';

    insert into public.indicator_entries (indicator_type, unit_id, entry_date, data, created_by)
    values ('apd', v_unit, v_date, v_row_data, p_actor)
    on conflict (entry_date, unit_id, (data->>'room'), (data->>'staff')) where indicator_type = 'apd'
    do update set data = excluded.data, updated_at = now()
      where public.indicator_entries.created_by = p_actor or public.is_admin()
    returning id into v_new_id;

    if v_new_id is not null then
      v_count := v_count + 1;
      v_ids := array_append(v_ids, v_new_id);
    end if;
  end loop;

  perform public.log_import_audit('inm_apd', format('Import %s data INM (apd)', v_count), p_actor);
  return query select v_count, v_ids;
end;
$$;

-- ============================================================================
-- RPC — INM JATUH
-- ============================================================================
create or replace function public.inm_import_batch_jatuh(p_payload jsonb, p_actor uuid)
returns table (success_count int, inserted_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_data jsonb;
  v_row_data jsonb;
  v_unit text;
  v_date date;
  v_new_id uuid;
  v_count int := 0;
  v_ids uuid[] := '{}';
begin
  if p_actor is distinct from auth.uid() then
    raise exception 'Actor tidak sesuai dengan pengguna yang sedang login.';
  end if;

  for v_item in select * from jsonb_array_elements(p_payload) loop
    v_data := v_item -> 'data';
    v_unit := v_data->>'unit_id';
    v_date := (v_data->>'entry_date')::date;
    v_row_data := v_data - 'unit_id' - 'entry_date';

    insert into public.indicator_entries (indicator_type, unit_id, entry_date, data, created_by)
    values ('jatuh', v_unit, v_date, v_row_data, p_actor)
    on conflict (entry_date, unit_id, (data->>'rm')) where indicator_type = 'jatuh'
    do update set data = excluded.data, updated_at = now()
      where public.indicator_entries.created_by = p_actor or public.is_admin()
    returning id into v_new_id;

    if v_new_id is not null then
      v_count := v_count + 1;
      v_ids := array_append(v_ids, v_new_id);
    end if;
  end loop;

  perform public.log_import_audit('inm_jatuh', format('Import %s data INM (jatuh)', v_count), p_actor);
  return query select v_count, v_ids;
end;
$$;

-- ============================================================================
-- RPC — INM SC
-- ============================================================================
create or replace function public.inm_import_batch_sc(p_payload jsonb, p_actor uuid)
returns table (success_count int, inserted_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_data jsonb;
  v_row_data jsonb;
  v_unit text;
  v_date date;
  v_new_id uuid;
  v_count int := 0;
  v_ids uuid[] := '{}';
begin
  if p_actor is distinct from auth.uid() then
    raise exception 'Actor tidak sesuai dengan pengguna yang sedang login.';
  end if;

  for v_item in select * from jsonb_array_elements(p_payload) loop
    v_data := v_item -> 'data';
    v_unit := v_data->>'unit_id';
    v_date := (v_data->>'entry_date')::date;
    v_row_data := v_data - 'unit_id' - 'entry_date';

    insert into public.indicator_entries (indicator_type, unit_id, entry_date, data, created_by)
    values ('sc', v_unit, v_date, v_row_data, p_actor)
    on conflict (entry_date, unit_id, (data->>'rm')) where indicator_type = 'sc'
    do update set data = excluded.data, updated_at = now()
      where public.indicator_entries.created_by = p_actor or public.is_admin()
    returning id into v_new_id;

    if v_new_id is not null then
      v_count := v_count + 1;
      v_ids := array_append(v_ids, v_new_id);
    end if;
  end loop;

  perform public.log_import_audit('inm_sc', format('Import %s data INM (sc)', v_count), p_actor);
  return query select v_count, v_ids;
end;
$$;

-- ============================================================================
-- RPC — INM WTRJ
-- ============================================================================
create or replace function public.inm_import_batch_wtrj(p_payload jsonb, p_actor uuid)
returns table (success_count int, inserted_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_data jsonb;
  v_row_data jsonb;
  v_unit text;
  v_date date;
  v_new_id uuid;
  v_count int := 0;
  v_ids uuid[] := '{}';
begin
  if p_actor is distinct from auth.uid() then
    raise exception 'Actor tidak sesuai dengan pengguna yang sedang login.';
  end if;

  for v_item in select * from jsonb_array_elements(p_payload) loop
    v_data := v_item -> 'data';
    v_unit := v_data->>'unit_id';
    v_date := (v_data->>'entry_date')::date;
    v_row_data := v_data - 'unit_id' - 'entry_date';

    insert into public.indicator_entries (indicator_type, unit_id, entry_date, data, created_by)
    values ('wtrj', v_unit, v_date, v_row_data, p_actor)
    on conflict (entry_date, unit_id, (data->>'rm')) where indicator_type = 'wtrj'
    do update set data = excluded.data, updated_at = now()
      where public.indicator_entries.created_by = p_actor or public.is_admin()
    returning id into v_new_id;

    if v_new_id is not null then
      v_count := v_count + 1;
      v_ids := array_append(v_ids, v_new_id);
    end if;
  end loop;

  perform public.log_import_audit('inm_wtrj', format('Import %s data INM (wtrj)', v_count), p_actor);
  return query select v_count, v_ids;
end;
$$;

-- ============================================================================
-- RPC — INM OP
-- ============================================================================
create or replace function public.inm_import_batch_op(p_payload jsonb, p_actor uuid)
returns table (success_count int, inserted_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_data jsonb;
  v_row_data jsonb;
  v_unit text;
  v_date date;
  v_new_id uuid;
  v_count int := 0;
  v_ids uuid[] := '{}';
begin
  if p_actor is distinct from auth.uid() then
    raise exception 'Actor tidak sesuai dengan pengguna yang sedang login.';
  end if;

  for v_item in select * from jsonb_array_elements(p_payload) loop
    v_data := v_item -> 'data';
    v_unit := v_data->>'unit_id';
    v_date := (v_data->>'entry_date')::date;
    v_row_data := v_data - 'unit_id' - 'entry_date';

    insert into public.indicator_entries (indicator_type, unit_id, entry_date, data, created_by)
    values ('op', v_unit, v_date, v_row_data, p_actor)
    on conflict (entry_date, unit_id, (data->>'rm')) where indicator_type = 'op'
    do update set data = excluded.data, updated_at = now()
      where public.indicator_entries.created_by = p_actor or public.is_admin()
    returning id into v_new_id;

    if v_new_id is not null then
      v_count := v_count + 1;
      v_ids := array_append(v_ids, v_new_id);
    end if;
  end loop;

  perform public.log_import_audit('inm_op', format('Import %s data INM (op)', v_count), p_actor);
  return query select v_count, v_ids;
end;
$$;

-- ============================================================================
-- RPC — INM LAB
-- ============================================================================
create or replace function public.inm_import_batch_lab(p_payload jsonb, p_actor uuid)
returns table (success_count int, inserted_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_data jsonb;
  v_row_data jsonb;
  v_unit text;
  v_date date;
  v_new_id uuid;
  v_count int := 0;
  v_ids uuid[] := '{}';
begin
  if p_actor is distinct from auth.uid() then
    raise exception 'Actor tidak sesuai dengan pengguna yang sedang login.';
  end if;

  for v_item in select * from jsonb_array_elements(p_payload) loop
    v_data := v_item -> 'data';
    v_unit := v_data->>'unit_id';
    v_date := (v_data->>'entry_date')::date;
    v_row_data := v_data - 'unit_id' - 'entry_date';

    insert into public.indicator_entries (indicator_type, unit_id, entry_date, data, created_by)
    values ('lab', v_unit, v_date, v_row_data, p_actor)
    on conflict (entry_date, unit_id, (data->>'rm'), (data->>'exam')) where indicator_type = 'lab'
    do update set data = excluded.data, updated_at = now()
      where public.indicator_entries.created_by = p_actor or public.is_admin()
    returning id into v_new_id;

    if v_new_id is not null then
      v_count := v_count + 1;
      v_ids := array_append(v_ids, v_new_id);
    end if;
  end loop;

  perform public.log_import_audit('inm_lab', format('Import %s data INM (lab)', v_count), p_actor);
  return query select v_count, v_ids;
end;
$$;

-- ============================================================================
-- RPC — INM FORNAS
-- ============================================================================
create or replace function public.inm_import_batch_fornas(p_payload jsonb, p_actor uuid)
returns table (success_count int, inserted_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_data jsonb;
  v_row_data jsonb;
  v_unit text;
  v_date date;
  v_new_id uuid;
  v_count int := 0;
  v_ids uuid[] := '{}';
begin
  if p_actor is distinct from auth.uid() then
    raise exception 'Actor tidak sesuai dengan pengguna yang sedang login.';
  end if;

  for v_item in select * from jsonb_array_elements(p_payload) loop
    v_data := v_item -> 'data';
    v_unit := v_data->>'unit_id';
    v_date := (v_data->>'entry_date')::date;
    v_row_data := v_data - 'unit_id' - 'entry_date';

    insert into public.indicator_entries (indicator_type, unit_id, entry_date, data, created_by)
    values ('fornas', v_unit, v_date, v_row_data, p_actor)
    on conflict (entry_date, unit_id) where indicator_type = 'fornas'
    do update set data = excluded.data, updated_at = now()
      where public.indicator_entries.created_by = p_actor or public.is_admin()
    returning id into v_new_id;

    if v_new_id is not null then
      v_count := v_count + 1;
      v_ids := array_append(v_ids, v_new_id);
    end if;
  end loop;

  perform public.log_import_audit('inm_fornas', format('Import %s data INM (fornas)', v_count), p_actor);
  return query select v_count, v_ids;
end;
$$;

-- ============================================================================
-- RPC — INM CP
-- ============================================================================
create or replace function public.inm_import_batch_cp(p_payload jsonb, p_actor uuid)
returns table (success_count int, inserted_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_data jsonb;
  v_row_data jsonb;
  v_unit text;
  v_date date;
  v_new_id uuid;
  v_count int := 0;
  v_ids uuid[] := '{}';
begin
  if p_actor is distinct from auth.uid() then
    raise exception 'Actor tidak sesuai dengan pengguna yang sedang login.';
  end if;

  for v_item in select * from jsonb_array_elements(p_payload) loop
    v_data := v_item -> 'data';
    v_unit := v_data->>'unit_id';
    v_date := (v_data->>'entry_date')::date;
    v_row_data := v_data - 'unit_id' - 'entry_date';

    insert into public.indicator_entries (indicator_type, unit_id, entry_date, data, created_by)
    values ('cp', v_unit, v_date, v_row_data, p_actor)
    on conflict (entry_date, unit_id, (data->>'rm')) where indicator_type = 'cp'
    do update set data = excluded.data, updated_at = now()
      where public.indicator_entries.created_by = p_actor or public.is_admin()
    returning id into v_new_id;

    if v_new_id is not null then
      v_count := v_count + 1;
      v_ids := array_append(v_ids, v_new_id);
    end if;
  end loop;

  perform public.log_import_audit('inm_cp', format('Import %s data INM (cp)', v_count), p_actor);
  return query select v_count, v_ids;
end;
$$;
