-- ============================================================================
-- INMrsds — FITUR IMPORT & DOWNLOAD TEMPLATE DATA (Reusable Import Engine)
-- Migration tambahan, dijalankan SETELAH migration.sql, migration_risk.sql,
-- migration_ikp.sql, migration_budaya.sql, migration_kepuasan.sql,
-- migration_usulan_indikator.sql, migration_custom_indicators.sql (semua
-- modul di atas HARUS sudah terpasang lebih dulu — migration ini memakai
-- tabel & fungsi role helper dari masing-masing).
--
-- Aman dijalankan berulang (IF NOT EXISTS / idempotent DO blocks). TIDAK
-- mengubah struktur tabel modul yang sudah ada, kecuali penambahan nilai
-- baru pada audit_logs.type check-constraint (bagian 0).
--
-- Isi:
--   1. import_history        — riwayat setiap proses import (bagian 18)
--   2. import_error_log      — detail error per baris, ditautkan ke history
--   3. is_import_reviewer()  — helper akses generik lintas modul
--   4. RLS import_history / import_error_log
--   5. Fungsi RPC batch-insert TRANSAKSIONAL per modul (bagian 17, 41):
--        risk_import_batch, ikp_import_batch, budaya_import_batch,
--        kepuasan_import_batch, uimu_import_batch, custom_indicator_import_batch
--      Setiap fungsi = satu transaksi Postgres: kalau ada baris gagal di
--      tengah proses (constraint DB, dsb), SELURUH batch di-ROLLBACK
--      otomatis (poin 17: "Tidak ada data yang disimpan sebagian").
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 0. PERLUASAN audit_logs — nilai type 'import' untuk mencatat aktivitas
--    import ke feed AuditTrailPanel yang sudah ada di tiap modul.
-- ============================================================================
alter table public.audit_logs drop constraint if exists audit_logs_type_check;
alter table public.audit_logs add constraint audit_logs_type_check
  check (type in ('block', 'login', 'input', 'mapping', 'ikp', 'risk', 'budaya', 'uimu', 'custom_indicator', 'kepuasan', 'import'));

-- ============================================================================
-- 1. RIWAYAT IMPORT (bagian 18)
-- ============================================================================
create table if not exists public.import_history (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users (id) on delete set null,
  module          text not null check (module in ('risk', 'ikp', 'budaya', 'kepuasan', 'uimu', 'custom_indicator')),
  file_name       text not null,
  file_size       bigint,
  total_rows      int not null default 0,
  success_rows    int not null default 0,
  error_rows      int not null default 0,
  duplicate_rows  int not null default 0,
  status          text not null default 'PROCESSING' check (status in ('PROCESSING', 'SUCCESS', 'PARTIAL', 'FAILED', 'CANCELLED')),
  error_message   text,
  created_at      timestamptz not null default now()
);

comment on table public.import_history is
  'Riwayat setiap proses import per modul (menu "Riwayat Import" di Import Center) — siapa, kapan, modul apa, file apa, berapa data/berhasil/error/duplikat (bagian 18).';

create index if not exists idx_import_history_module on public.import_history (module, created_at desc);
create index if not exists idx_import_history_user on public.import_history (user_id);

-- ============================================================================
-- 2. DETAIL ERROR PER BARIS (audit; unduhan Error Report dibuat di klien
--    dari hasil validasi langsung, tabel ini untuk jejak/riwayat saja)
-- ============================================================================
create table if not exists public.import_error_log (
  id                 uuid primary key default gen_random_uuid(),
  import_history_id  uuid not null references public.import_history (id) on delete cascade,
  module             text not null,
  excel_row          int not null,
  column_name        text,
  cell_value         text,
  error_message      text not null,
  created_at         timestamptz not null default now()
);

create index if not exists idx_import_error_log_history on public.import_error_log (import_history_id);

-- ============================================================================
-- 3. AUDIT TRAIL — tulis satu baris audit_logs setiap kali import selesai,
--    dipanggil dari aplikasi (runImport.ts) lewat logImportAudit(), reuse
--    tabel audit_logs yang sama seperti modul lain (tidak ada tabel baru).
-- ============================================================================
create or replace function public.log_import_audit(
  p_module text, p_msg text, p_user_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_logs (type, msg, user_id, entity_type)
  values ('import', p_msg, p_user_id, p_module);
$$;

-- ============================================================================
-- 4. AKSES GENERIK LINTAS MODUL — dipakai RLS import_history/import_error_log
--    dan sebagai guard di dalam setiap fungsi *_import_batch di bawah.
-- ============================================================================
create or replace function public.is_import_reviewer(p_module text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if public.is_admin() then
    return true;
  end if;
  return case p_module
    when 'risk' then public.is_risk_reviewer()
    when 'ikp' then public.is_ikp_reviewer()
    when 'budaya' then public.is_budaya_reviewer()
    when 'kepuasan' then public.is_kepuasan_reviewer()
    when 'uimu' then public.is_uimu_reviewer()
    when 'custom_indicator' then public.is_custom_indicator_manager()
    else false
  end;
end;
$$;

-- ============================================================================
-- 5. ROW LEVEL SECURITY — import_history / import_error_log
-- ============================================================================
alter table public.import_history enable row level security;

drop policy if exists "import_history_select" on public.import_history;
create policy "import_history_select"
  on public.import_history for select
  to authenticated
  using (user_id = auth.uid() or public.is_import_reviewer(module));

drop policy if exists "import_history_insert" on public.import_history;
create policy "import_history_insert"
  on public.import_history for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_import_reviewer(module));

alter table public.import_error_log enable row level security;

drop policy if exists "import_error_log_select" on public.import_error_log;
create policy "import_error_log_select"
  on public.import_error_log for select
  to authenticated
  using (
    exists (
      select 1 from public.import_history h
      where h.id = import_history_id
        and (h.user_id = auth.uid() or public.is_import_reviewer(h.module))
    )
  );

drop policy if exists "import_error_log_insert" on public.import_error_log;
create policy "import_error_log_insert"
  on public.import_error_log for insert
  to authenticated
  with check (
    exists (
      select 1 from public.import_history h
      where h.id = import_history_id and h.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. RPC — RISIKO (public.risks + public.risk_assessments opsional)
-- ============================================================================
-- Dedup key aplikasi (klien): unit_lokasi + risiko + risk_year (risk_code
-- SELALU auto-generate oleh trigger generate_risk_code(), tidak diimport).
create or replace function public.risk_import_batch(p_payload jsonb, p_actor uuid)
returns table (success_count int, inserted_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_data jsonb;
  v_new_id uuid;
  v_count int := 0;
  v_ids uuid[] := '{}';
begin
  if not public.is_import_reviewer('risk') then
    raise exception 'Tidak memiliki izin import untuk modul Manajemen Risiko.';
  end if;

  for v_item in select * from jsonb_array_elements(p_payload) loop
    v_data := v_item -> 'data';

    insert into public.risks (
      risk_year, unit_lokasi, category, subcategory, risiko, sebab_insiden, efek_dampak,
      proses_terdampak, dokumen_spo_terkait, kontrol_existing, bukti_pendukung,
      status, risk_owner_name, created_by
    ) values (
      coalesce((v_data->>'risk_year')::int, extract(year from now())::int),
      v_data->>'unit_lokasi', v_data->>'category', v_data->>'subcategory',
      v_data->>'risiko', v_data->>'sebab_insiden', v_data->>'efek_dampak',
      v_data->>'proses_terdampak', v_data->>'dokumen_spo_terkait', v_data->>'kontrol_existing', v_data->>'bukti_pendukung',
      coalesce(v_data->>'status', 'identifikasi'), v_data->>'risk_owner_name', p_actor
    )
    returning id into v_new_id;

    if (v_data->>'probabilitas') is not null and (v_data->>'dampak') is not null and (v_data->>'controllability') is not null then
      insert into public.risk_assessments (risk_id, probabilitas, dampak, controllability, analyzed_by)
      values (v_new_id, (v_data->>'probabilitas')::int, (v_data->>'dampak')::int, (v_data->>'controllability')::int, p_actor);
    end if;

    v_count := v_count + 1;
    v_ids := array_append(v_ids, v_new_id);
  end loop;

  perform public.log_import_audit('risk', format('Import %s data Risiko', v_count), p_actor);
  return query select v_count, v_ids;
end;
$$;

-- ============================================================================
-- 7. RPC — IKP (public.ikp_incidents)
-- ============================================================================
create or replace function public.ikp_import_batch(p_payload jsonb, p_actor uuid)
returns table (success_count int, inserted_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_data jsonb;
  v_new_id uuid;
  v_count int := 0;
  v_ids uuid[] := '{}';
  v_report_number text;
begin
  if not public.is_import_reviewer('ikp') then
    raise exception 'Tidak memiliki izin import untuk modul IKP.';
  end if;

  for v_item in select * from jsonb_array_elements(p_payload) loop
    v_data := v_item -> 'data';
    v_report_number := nullif(v_data->>'report_number', '');

    insert into public.ikp_incidents (
      report_number, report_kind, status, report_date, reporter_name, reporter_unit, reporter_profession,
      is_anonymous, patient_age_group, patient_gender, incident_date, incident_summary, chronology,
      incident_type, incident_location, patient_service_unit, causing_unit, patient_impact,
      immediate_action, severity_grade, created_by
    ) values (
      v_report_number, coalesce(v_data->>'report_kind', 'insiden'), coalesce(v_data->>'status', 'dilaporkan'),
      coalesce((v_data->>'report_date')::date, current_date), v_data->>'reporter_name', v_data->>'reporter_unit', v_data->>'reporter_profession',
      coalesce((v_data->>'is_anonymous')::boolean, false), v_data->>'patient_age_group', v_data->>'patient_gender',
      (v_data->>'incident_date')::date, v_data->>'incident_summary', v_data->>'chronology',
      v_data->>'incident_type', v_data->>'incident_location', v_data->>'patient_service_unit', v_data->>'causing_unit', v_data->>'patient_impact',
      v_data->>'immediate_action', v_data->>'severity_grade', p_actor
    )
    returning id into v_new_id;

    v_count := v_count + 1;
    v_ids := array_append(v_ids, v_new_id);
  end loop;

  perform public.log_import_audit('ikp', format('Import %s data IKP', v_count), p_actor);
  return query select v_count, v_ids;
end;
$$;

-- ============================================================================
-- 8. RPC — SURVEI BUDAYA KESELAMATAN (public.budaya_period_results, hasil
--    agregat lama — source = 'imported', sesuai comment yang SUDAH ADA di
--    migration_budaya.sql bagian 4: "source=imported dipakai oleh IMPORT
--    HASIL SURVEY LAMA", jadi kolom ini memang didesain untuk fitur ini).
-- ============================================================================
create or replace function public.budaya_import_batch(p_payload jsonb, p_actor uuid)
returns table (success_count int, inserted_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_data jsonb;
  v_new_id uuid;
  v_count int := 0;
  v_ids uuid[] := '{}';
  v_unit_text text;
begin
  if not public.is_import_reviewer('budaya') then
    raise exception 'Tidak memiliki izin import untuk modul Survei Budaya Keselamatan Pasien.';
  end if;

  for v_item in select * from jsonb_array_elements(p_payload) loop
    v_data := v_item -> 'data';
    -- unit_id pada budaya_period_results bertipe TEXT (uuid budaya_units sebagai
    -- teks, atau sentinel '__overall__') — TIDAK di-cast ke uuid (bagian 4 desain existing).
    v_unit_text := coalesce(nullif(v_data->>'unit_id', ''), '__overall__');

    insert into public.budaya_period_results (
      survey_id, unit_id, total_respondents, overall_score, overall_category, response_rate, source
    ) values (
      (v_data->>'survey_id')::uuid,
      v_unit_text,
      coalesce((v_data->>'total_respondents')::int, 0),
      (v_data->>'overall_score')::numeric,
      v_data->>'overall_category',
      (v_data->>'response_rate')::numeric,
      'imported'
    )
    on conflict (survey_id, unit_id) do update set
      total_respondents = excluded.total_respondents,
      overall_score = excluded.overall_score,
      overall_category = excluded.overall_category,
      response_rate = excluded.response_rate,
      source = 'imported',
      computed_at = now()
    returning id into v_new_id;

    v_count := v_count + 1;
    v_ids := array_append(v_ids, v_new_id);
  end loop;

  perform public.log_import_audit('budaya', format('Import %s hasil Survei Budaya', v_count), p_actor);
  return query select v_count, v_ids;
end;
$$;

-- Catatan: kolom unit_id pada budaya_period_results bertipe TEXT (menyimpan
-- uuid budaya_units sebagai teks atau sentinel '__overall__'), sesuai desain
-- existing di migration_budaya.sql bagian 4 — fungsi di atas menyesuaikan.

-- ============================================================================
-- 9. RPC — SURVEI KEPUASAN PASIEN (public.kepuasan_responses, source='import',
--    kolom source & is_valid SUDAH DIDESAIN untuk fitur ini di migration_kepuasan.sql).
-- ============================================================================
create or replace function public.kepuasan_import_batch(p_payload jsonb, p_actor uuid)
returns table (success_count int, inserted_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_data jsonb;
  v_new_id uuid;
  v_count int := 0;
  v_ids uuid[] := '{}';
begin
  if not public.is_import_reviewer('kepuasan') then
    raise exception 'Tidak memiliki izin import untuk modul Survei Kepuasan Pasien.';
  end if;

  for v_item in select * from jsonb_array_elements(p_payload) loop
    v_data := v_item -> 'data';

    insert into public.kepuasan_responses (
      response_code, survey_id, unit_id, respondent_name,
      u1_persyaratan, u2_prosedur, u3_waktu, u4_biaya, u5_produk_layanan,
      u6_kompetensi_pelaksana, u7_perilaku_pelaksana, u8_penanganan_pengaduan, u9_sarana_prasarana,
      kritik_saran, source, is_valid
    ) values (
      public.kepuasan_next_response_code(), (v_data->>'survey_id')::uuid, v_data->>'unit_id', v_data->>'respondent_name',
      (v_data->>'u1_persyaratan')::smallint, (v_data->>'u2_prosedur')::smallint, (v_data->>'u3_waktu')::smallint,
      (v_data->>'u4_biaya')::smallint, (v_data->>'u5_produk_layanan')::smallint, (v_data->>'u6_kompetensi_pelaksana')::smallint,
      (v_data->>'u7_perilaku_pelaksana')::smallint, (v_data->>'u8_penanganan_pengaduan')::smallint, (v_data->>'u9_sarana_prasarana')::smallint,
      v_data->>'kritik_saran', 'import', true
    )
    returning id into v_new_id;

    v_count := v_count + 1;
    v_ids := array_append(v_ids, v_new_id);
  end loop;

  perform public.log_import_audit('kepuasan', format('Import %s respons Survei Kepuasan', v_count), p_actor);
  return query select v_count, v_ids;
end;
$$;

-- ============================================================================
-- 10. RPC — UIMU (public.uimu_proposals)
-- ============================================================================
create or replace function public.uimu_import_batch(p_payload jsonb, p_actor uuid)
returns table (success_count int, inserted_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_data jsonb;
  v_new_id uuid;
  v_count int := 0;
  v_ids uuid[] := '{}';
begin
  if not public.is_import_reviewer('uimu') then
    raise exception 'Tidak memiliki izin import untuk modul UIMU.';
  end if;

  for v_item in select * from jsonb_array_elements(p_payload) loop
    v_data := v_item -> 'data';

    insert into public.uimu_proposals (
      period_year, status, unit_id, indicator_name, indicator_category, quality_dimension,
      operational_definition, numerator, denominator, formula, unit_of_measure,
      target_value, target_operator, pic_name, decree_number, established_date, created_by
    ) values (
      coalesce((v_data->>'period_year')::int, extract(year from now())::int),
      coalesce(v_data->>'status', 'draft'),
      (v_data->>'unit_id')::uuid, v_data->>'indicator_name', v_data->>'indicator_category', v_data->>'quality_dimension',
      v_data->>'operational_definition', v_data->>'numerator', v_data->>'denominator', v_data->>'formula', v_data->>'unit_of_measure',
      v_data->>'target_value', v_data->>'target_operator', v_data->>'pic_name',
      v_data->>'decree_number', (v_data->>'established_date')::date, p_actor
    )
    returning id into v_new_id;

    v_count := v_count + 1;
    v_ids := array_append(v_ids, v_new_id);
  end loop;

  perform public.log_import_audit('uimu', format('Import %s usulan indikator UIMU', v_count), p_actor);
  return query select v_count, v_ids;
end;
$$;

-- ============================================================================
-- 11. RPC — CUSTOM INDICATORS (public.custom_indicator_measurements)
--     indicator_id & indicator_version_id SUDAH DIRESOLVE di klien (lihat
--     resolveReference pada configs/customIndicator.ts) sebelum sampai ke
--     sini — fungsi ini menghitung ulang value/achievement_status dari
--     formula versi terkait, sesuai snapshot yang dijelaskan di komentar
--     tabel custom_indicator_measurements (migration_custom_indicators.sql).
-- ============================================================================
create or replace function public.custom_indicator_import_batch(p_payload jsonb, p_actor uuid)
returns table (success_count int, inserted_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_data jsonb;
  v_new_id uuid;
  v_count int := 0;
  v_ids uuid[] := '{}';
  v_version record;
  v_numerator numeric;
  v_denominator numeric;
  v_value numeric;
  v_status text;
begin
  if not public.is_import_reviewer('custom_indicator') then
    raise exception 'Tidak memiliki izin import untuk modul Master Indikator Mutu Custom.';
  end if;

  for v_item in select * from jsonb_array_elements(p_payload) loop
    v_data := v_item -> 'data';

    select * into v_version from public.custom_indicator_versions where id = (v_data->>'indicator_version_id')::uuid;
    if not found then
      raise exception 'Versi indikator tidak ditemukan untuk salah satu baris import.';
    end if;

    v_numerator := (v_data->>'numerator')::numeric;
    v_denominator := (v_data->>'denominator')::numeric;

    v_value := case v_version.formula_type
      when 'percentage' then case when coalesce(v_denominator, 0) <> 0 then round((v_numerator / v_denominator) * v_version.formula_multiplier, 2) else null end
      when 'rate' then case when coalesce(v_denominator, 0) <> 0 then round((v_numerator / v_denominator) * v_version.formula_multiplier, 2) else null end
      when 'sum' then v_numerator
      when 'count' then v_numerator
      when 'average' then v_numerator
      else coalesce(v_numerator, v_denominator)
    end;

    v_status := case
      when v_version.target_value is null or v_value is null then null
      when v_version.target_operator = 'gte' and v_value >= v_version.target_value then 'tercapai'
      when v_version.target_operator = 'lte' and v_value <= v_version.target_value then 'tercapai'
      when v_version.target_operator = 'gt' and v_value > v_version.target_value then 'tercapai'
      when v_version.target_operator = 'lt' and v_value < v_version.target_value then 'tercapai'
      when v_version.target_operator = 'eq' and v_value = v_version.target_value then 'tercapai'
      when v_version.target_operator is not null then 'tidak_tercapai'
      else null
    end;

    insert into public.custom_indicator_measurements (
      indicator_id, indicator_version_id, unit_id, measurement_date, period, observation_seq,
      numerator, denominator, value, target_value, target_operator, achievement_status, notes, created_by
    ) values (
      (v_data->>'indicator_id')::uuid, v_version.id, v_data->>'unit_id',
      coalesce((v_data->>'measurement_date')::date, current_date), v_data->>'period', 1,
      v_numerator, v_denominator, v_value, v_version.target_value, v_version.target_operator, v_status,
      v_data->>'notes', p_actor
    )
    on conflict (indicator_id, indicator_version_id, unit_id, period, observation_seq) do update set
      numerator = excluded.numerator, denominator = excluded.denominator, value = excluded.value,
      target_value = excluded.target_value, target_operator = excluded.target_operator,
      achievement_status = excluded.achievement_status, notes = excluded.notes, updated_at = now()
    returning id into v_new_id;

    v_count := v_count + 1;
    v_ids := array_append(v_ids, v_new_id);
  end loop;

  perform public.log_import_audit('custom_indicator', format('Import %s data pengukuran indikator custom', v_count), p_actor);
  return query select v_count, v_ids;
end;
$$;

-- ============================================================================
-- 12. SETUP MANUAL — tidak ada peran baru; akses import mengikuti peran
--     reviewer masing-masing modul yang SUDAH ADA (risk_roles/ikp_roles/
--     budaya_roles/kepuasan_roles/uimu_roles/custom_indicator_roles, atau
--     role='admin'). Tidak perlu langkah tambahan setelah migration ini
--     dijalankan.
-- ============================================================================
