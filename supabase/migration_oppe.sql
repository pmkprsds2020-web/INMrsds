-- ============================================================================
-- INMrsds — Modul OPPE (Ongoing Professional Practice Evaluation /
-- Evaluasi Praktik Profesional Berkelanjutan)
--
-- Migration tambahan. Dijalankan SETELAH supabase/migration.sql. Sebaiknya
-- juga setelah migration_usulan_indikator.sql (master unit uimu_units dipakai
-- ulang sebagai master Unit OPPE) dan migration_import_export.sql (riwayat
-- import). Bila keduanya belum dijalankan, bagian terkait dilewati otomatis
-- (dibungkus DO-block bersyarat) dan migration ini tetap berhasil.
--
-- Aman dijalankan berulang (IF NOT EXISTS / ON CONFLICT / DROP ... IF EXISTS).
-- TIDAK mengubah/menghapus data existing. Perubahan pada objek existing
-- hanya ADDITIVE:
--   - profiles.oppe_roles (kolom baru)
--   - audit_logs_type_check (+ nilai 'oppe')
--   - import_history_module_check & is_import_reviewer() (+ modul 'oppe')
--
-- Seed indikator & 12 template diambil dari file referensi
-- "OPPE BARU By dr.Sri RSASM.xlsx" (bagian 12). Data DEMO (10 dokter fiktif)
-- TIDAK ada di file ini — lihat supabase/seed_oppe_demo.sql (opsional).
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 0. PERLUASAN ADDITIVE PADA TABEL EXISTING
-- ============================================================================

-- 0.a — Peran tambahan khusus modul OPPE (pola sama dengan uimu_roles dll.):
--   'komite_medik' -> Komite Medik / Subkomite Mutu Profesi / Komite Mutu:
--                     lihat semua OPPE, review, approval, finalisasi, FPPE,
--                     kelola master indikator & template.
--   'evaluator'    -> Ketua KSM / evaluator: mengisi evaluasi yang ditugaskan.
--   'dokter'       -> Dokter/staf medis: melihat hasil OPPE miliknya
--                     (dihubungkan lewat oppe_doctors.user_id).
--   role = 'admin' (kolom existing) otomatis full access.
alter table public.profiles
  add column if not exists oppe_roles text[] not null default '{}'::text[];

comment on column public.profiles.oppe_roles is
  'Peran tambahan modul OPPE: komite_medik, evaluator, dokter. Tidak memengaruhi role dasar maupun peran modul lain.';

-- 0.b — audit_logs (feed Notifikasi & Audit Trail aplikasi) menerima type 'oppe'.
alter table public.audit_logs drop constraint if exists audit_logs_type_check;
alter table public.audit_logs add constraint audit_logs_type_check
  check (type in ('block', 'login', 'input', 'mapping', 'ikp', 'risk', 'budaya', 'uimu', 'custom_indicator', 'kepuasan', 'import', 'oppe'));

-- ============================================================================
-- 1. HELPER PERAN
-- ============================================================================
create or replace function public.has_oppe_role(role_name text)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (role = 'admin' or role_name = any(oppe_roles))
  );
$$;

create or replace function public.is_oppe_committee()
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (role = 'admin' or 'komite_medik' = any(oppe_roles))
  );
$$;

create or replace function public.is_oppe_evaluator()
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (role = 'admin' or oppe_roles && array['komite_medik', 'evaluator'])
  );
$$;

create or replace function public.oppe_has_access()
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (role = 'admin' or oppe_roles && array['komite_medik', 'evaluator', 'dokter'])
  );
$$;

-- ============================================================================
-- 2. MASTER DATA (dinamis — tidak ada KSM/profesi yang di-hard-code di aplikasi)
-- ============================================================================

-- 2.a KSM
create table if not exists public.oppe_ksm (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.oppe_ksm is 'Master Kelompok Staf Medis (KSM) untuk modul OPPE. Dikelola dari menu OPPE > Pengaturan > Master.';

-- 2.b Profesi / Spesialisasi / Jenis Layanan — satu tabel generik.
--     Unit TIDAK dibuat ulang: memakai master unit existing public.uimu_units.
create table if not exists public.oppe_master_options (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('profession', 'specialty', 'service_type')),
  code        text,
  name        text not null,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (kind, name)
);
comment on table public.oppe_master_options is 'Master pilihan dinamis OPPE: profesi, spesialisasi, jenis layanan.';

-- 2.c Kategori indikator + bobot (A 30% / B 20% / C 50% default; configurable)
create table if not exists public.oppe_indicator_categories (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  weight      numeric(6,2) not null default 0 check (weight >= 0 and weight <= 100),
  description text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.oppe_indicator_categories is 'Kategori indikator OPPE dan bobotnya. Total bobot kategori aktif divalidasi = 100% (aplikasi + fungsi oppe_category_weight_total()).';

-- 2.d Master indikator
create table if not exists public.oppe_indicators (
  id                     uuid primary key default gen_random_uuid(),
  code                   text not null unique,
  category_id            uuid not null references public.oppe_indicator_categories (id) on delete restrict,
  ksm_id                 uuid references public.oppe_ksm (id) on delete set null,
  profession             text,
  unit_id                uuid,                       -- referensi lunak ke uimu_units(id) (FK ditambahkan bila tabel ada, lihat bagian 9)
  name                   text not null,
  description            text,
  indicator_type         text check (indicator_type is null or indicator_type in ('struktur', 'proses', 'outcome')),
  operational_definition text,
  numerator              text,
  denominator            text,
  unit_label             text,                       -- satuan: %, kasus, SKP, kali, kategori
  data_type              text not null default 'percent' check (data_type in ('percent', 'number', 'count', 'skp', 'boolean', 'grade', 'pass', 'category')),
  target_text            text,                       -- teks target asli (mis. "≥ 95%", "0 Keluhan")
  target_operator        text not null default 'gte' check (target_operator in ('gte', 'lte', 'eq', 'zero', 'pct100', 'min', 'max', 'score', 'category')),
  target_value           numeric,
  min_value              numeric,
  max_value              numeric,
  trigger_text           text,                       -- teks trigger asli (mis. "< 90% tepat waktu")
  trigger_operator       text not null default 'none' check (trigger_operator in ('lt', 'lte', 'gt', 'gte', 'eq', 'neq', 'lt_target', 'gt_target', 'not_pass', 'none')),
  trigger_value          numeric,
  options                text[] not null default '{}'::text[],
  pass_values            text[] not null default '{}'::text[],
  attention_values       text[] not null default '{}'::text[],
  is_critical            boolean not null default false,
  source_data            text,
  measurement_method     text,
  frequency              text,
  evaluation_period      text,
  weight                 numeric(6,2) not null default 1 check (weight > 0),
  score_met              numeric,                    -- null = pakai default oppe_settings
  score_attention        numeric,
  score_trigger          numeric,
  quality_indicator_id   uuid,                       -- opsional: custom_indicators(id) sebagai sumber data (poin 38)
  quality_indicator_name text,
  reference_note         text,                       -- catatan sumber/penyesuaian dari Excel
  is_active              boolean not null default true,
  created_by             uuid references auth.users (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
comment on table public.oppe_indicators is 'Master indikator OPPE (Perilaku Profesional / Pengembangan Profesional / Kinerja Klinis per KSM). Aturan target/trigger/skor disalin (snapshot) ke oppe_evaluation_items saat evaluasi dibuat.';

-- 2.e Template indikator per KSM/profesi
create table if not exists public.oppe_templates (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  profession  text,
  ksm_id      uuid references public.oppe_ksm (id) on delete set null,
  description text,
  is_active   boolean not null default true,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.oppe_template_indicators (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.oppe_templates (id) on delete cascade,
  indicator_id uuid not null references public.oppe_indicators (id) on delete cascade,
  sequence     int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (template_id, indicator_id)
);

-- 2.f Pengaturan (satu baris) — skor, kategori hasil, teks rekomendasi, ambang
create table if not exists public.oppe_settings (
  id                              text primary key default 'default' check (id = 'default'),
  score_met                       numeric not null default 100,
  score_attention                 numeric not null default 70,
  score_trigger                   numeric not null default 0,
  result_categories               jsonb not null default '[]'::jsonb,
  recommendation_critical_trigger text,
  recommendation_multiple_trigger text,
  recommendation_decline          text,
  significant_drop                numeric not null default 10,
  stable_band                     numeric not null default 2,
  fppe_trigger_count_threshold    int not null default 3,
  due_reminder_days               int not null default 14,
  require_complete_before_submit  boolean not null default true,
  hospital_name                   text,
  updated_by                      uuid references auth.users (id) on delete set null,
  updated_at                      timestamptz not null default now()
);

alter table public.oppe_settings add column if not exists hospital_name text;

-- ============================================================================
-- 3. DOKTER / STAF MEDIS
-- ============================================================================
create table if not exists public.oppe_doctors (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid unique references auth.users (id) on delete set null,  -- akun login dokter (untuk akses "OPPE saya")
  name                text not null,
  nik_nip             text,
  str_number          text,
  str_expiry          date,
  sip_number          text,
  sip_expiry          date,
  title               text,                        -- gelar, mis. Sp.An
  profession          text,
  specialty           text,
  ksm_id              uuid references public.oppe_ksm (id) on delete set null,
  unit_id             uuid,                        -- referensi lunak ke uimu_units(id)
  unit_name           text,                        -- snapshot nama unit
  status              text not null default 'aktif' check (status in ('aktif', 'nonaktif')),
  practice_start_date date,
  email               text,
  phone               text,
  credentials         text,
  notes               text,
  is_demo             boolean not null default false,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table public.oppe_doctors is 'Master dokter/staf medis yang dievaluasi OPPE. is_demo=true menandai data contoh dari seed_oppe_demo.sql.';

-- ============================================================================
-- 4. EVALUASI
-- ============================================================================
create table if not exists public.oppe_evaluations (
  id                       uuid primary key default gen_random_uuid(),
  evaluation_number        text unique,             -- OPPE/{TAHUN}/000001 (trigger)
  doctor_id                uuid not null references public.oppe_doctors (id) on delete restrict,
  ksm_id                   uuid references public.oppe_ksm (id) on delete set null,
  unit_id                  uuid,
  unit_name                text,
  profession               text,
  specialty                text,
  template_id              uuid references public.oppe_templates (id) on delete set null,
  period_type              text not null check (period_type in ('semester_1', 'semester_2', 'tahunan', 'custom')),
  year                     int not null check (year between 2000 and 2100),
  semester                 int check (semester is null or semester in (1, 2)),
  period_start             date,
  period_end               date,
  evaluator_id             uuid references auth.users (id) on delete set null,
  evaluator_name           text,
  evaluation_date          date,
  due_date                 date,
  status                   text not null default 'draft' check (status in ('draft', 'in_progress', 'submitted', 'reviewed', 'approved', 'finalized')),

  -- hasil perhitungan (diisi engine src/lib/oppeScoring.ts)
  score_professional       numeric(6,2),
  score_development        numeric(6,2),
  score_clinical           numeric(6,2),
  weighted_score           numeric(6,2),
  final_score              numeric(6,2),
  category_scores          jsonb not null default '[]'::jsonb,
  final_category           text,
  final_category_label     text,
  met_count                int not null default 0,
  attention_count          int not null default 0,
  trigger_count            int not null default 0,
  no_data_count            int not null default 0,
  critical_trigger_count   int not null default 0,
  critical_indicators      text,
  requires_fppe            boolean not null default false,
  trend                    text check (trend is null or trend in ('naik', 'stabil', 'turun')),
  previous_score           numeric(6,2),
  conclusion               text,
  recommendation           text,
  recommendation_override  text,                    -- rekomendasi final Komite Medik (bila mengubah rekomendasi otomatis)
  notes                    text,                    -- catatan pembinaan / rencana tindak lanjut

  -- workflow
  reviewed_by              uuid references auth.users (id) on delete set null,
  reviewed_at              timestamptz,
  review_notes             text,
  approved_by              uuid references auth.users (id) on delete set null,
  approved_at              timestamptz,
  finalized_by             uuid references auth.users (id) on delete set null,
  finalized_at             timestamptz,
  reopen_reason            text,
  reopened_by              uuid references auth.users (id) on delete set null,
  reopened_at              timestamptz,
  needs_recalc             boolean not null default false,   -- true setelah import; aplikasi menghitung ulang
  is_demo                  boolean not null default false,

  created_by               uuid references auth.users (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check (period_type <> 'custom' or (period_start is not null and period_end is not null and period_end >= period_start))
);
comment on table public.oppe_evaluations is 'Satu evaluasi OPPE per dokter per periode. Lifecycle: draft -> in_progress -> submitted -> reviewed -> approved -> finalized (reopen wajib alasan).';

-- Cegah duplikasi evaluasi: dokter + tahun + jenis periode (+ tanggal mulai untuk custom)
create unique index if not exists uniq_oppe_evaluation_period
  on public.oppe_evaluations (doctor_id, year, period_type, coalesce(period_start, date '1900-01-01'));

create table if not exists public.oppe_evaluation_items (
  id                  uuid primary key default gen_random_uuid(),
  evaluation_id       uuid not null references public.oppe_evaluations (id) on delete cascade,
  indicator_id        uuid references public.oppe_indicators (id) on delete set null,
  sequence            int not null default 0,
  category_id         uuid references public.oppe_indicator_categories (id) on delete set null,
  category_code       text not null,
  code                text,
  name                text not null,
  -- snapshot aturan penilaian
  data_type           text not null check (data_type in ('percent', 'number', 'count', 'skp', 'boolean', 'grade', 'pass', 'category')),
  unit_label          text,
  target_text         text,
  target_operator     text not null check (target_operator in ('gte', 'lte', 'eq', 'zero', 'pct100', 'min', 'max', 'score', 'category')),
  target_value        numeric,
  trigger_text        text,
  trigger_operator    text not null check (trigger_operator in ('lt', 'lte', 'gt', 'gte', 'eq', 'neq', 'lt_target', 'gt_target', 'not_pass', 'none')),
  trigger_value       numeric,
  options             text[] not null default '{}'::text[],
  pass_values         text[] not null default '{}'::text[],
  attention_values    text[] not null default '{}'::text[],
  is_critical         boolean not null default false,
  weight              numeric(6,2) not null default 1,
  score_met           numeric,
  score_attention     numeric,
  score_trigger       numeric,
  -- hasil
  realization_text    text,
  realization_number  numeric,
  achievement         numeric(8,2),
  score               numeric(6,2),
  weighted_score      numeric(6,2),
  status              text not null default 'no_data' check (status in ('met', 'attention', 'trigger', 'no_data')),
  is_trigger          boolean not null default false,
  status_reason       text,
  notes               text,
  source_data         text,
  evidence_url        text,                         -- link rekam medis / laporan audit / dokumen
  evidence_path       text,                         -- path di bucket storage 'oppe-evidence'
  quality_indicator_id uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index if not exists uniq_oppe_item_indicator
  on public.oppe_evaluation_items (evaluation_id, indicator_id) where indicator_id is not null;

-- ============================================================================
-- 5. FPPE
-- ============================================================================
create table if not exists public.oppe_fppe (
  id                     uuid primary key default gen_random_uuid(),
  fppe_number            text unique,              -- FPPE/{TAHUN}/0001 (trigger)
  evaluation_id          uuid references public.oppe_evaluations (id) on delete set null,
  doctor_id              uuid not null references public.oppe_doctors (id) on delete restrict,
  ksm_id                 uuid references public.oppe_ksm (id) on delete set null,
  trigger_indicator_id   uuid references public.oppe_indicators (id) on delete set null,
  trigger_item_id        uuid references public.oppe_evaluation_items (id) on delete set null,
  trigger_indicator_name text,
  reason                 text,
  area                   text,
  start_date             date,
  end_date               date,
  evaluator_id           uuid references auth.users (id) on delete set null,
  evaluator_name         text,
  plan                   text,
  result                 text,
  recommendation         text,
  status                 text not null default 'draft' check (status in ('draft', 'direncanakan', 'berjalan', 'selesai', 'tidak_dilanjutkan')),
  is_demo                boolean not null default false,
  created_by             uuid references auth.users (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

-- ============================================================================
-- 6. AUDIT TRAIL OPPE (append-only — tidak bisa diubah/dihapus)
-- ============================================================================
create table if not exists public.oppe_audit_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users (id) on delete set null,
  user_name     text,
  evaluation_id uuid,                               -- sengaja TANPA FK: log tetap ada walau evaluasi dihapus
  entity_type   text not null default 'oppe_evaluations',
  entity_id     uuid,
  action        text not null check (action in ('create', 'update', 'delete', 'import', 'export', 'submit', 'review', 'approve', 'finalize', 'reopen', 'fppe_created', 'fppe_updated', 'settings_updated')),
  old_data      jsonb,
  new_data      jsonb,
  reason        text,
  created_at    timestamptz not null default now()
);

-- ============================================================================
-- 7. INDEXES
-- ============================================================================
create index if not exists idx_oppe_doctors_ksm on public.oppe_doctors (ksm_id);
create index if not exists idx_oppe_doctors_status on public.oppe_doctors (status);
create index if not exists idx_oppe_doctors_user on public.oppe_doctors (user_id);
create index if not exists idx_oppe_indicators_category on public.oppe_indicators (category_id);
create index if not exists idx_oppe_indicators_ksm on public.oppe_indicators (ksm_id);
create index if not exists idx_oppe_indicators_active on public.oppe_indicators (is_active);
create index if not exists idx_oppe_templates_ksm on public.oppe_templates (ksm_id);
create index if not exists idx_oppe_template_ind_template on public.oppe_template_indicators (template_id, sequence);
create index if not exists idx_oppe_template_ind_indicator on public.oppe_template_indicators (indicator_id);
create index if not exists idx_oppe_eval_doctor on public.oppe_evaluations (doctor_id);
create index if not exists idx_oppe_eval_ksm on public.oppe_evaluations (ksm_id);
create index if not exists idx_oppe_eval_year_period on public.oppe_evaluations (year, period_type);
create index if not exists idx_oppe_eval_status on public.oppe_evaluations (status);
create index if not exists idx_oppe_eval_evaluator on public.oppe_evaluations (evaluator_id);
create index if not exists idx_oppe_eval_category on public.oppe_evaluations (final_category);
create index if not exists idx_oppe_eval_updated on public.oppe_evaluations (updated_at desc);
create index if not exists idx_oppe_items_evaluation on public.oppe_evaluation_items (evaluation_id, sequence);
create index if not exists idx_oppe_items_indicator on public.oppe_evaluation_items (indicator_id);
create index if not exists idx_oppe_items_status on public.oppe_evaluation_items (status);
create index if not exists idx_oppe_fppe_doctor on public.oppe_fppe (doctor_id);
create index if not exists idx_oppe_fppe_evaluation on public.oppe_fppe (evaluation_id);
create index if not exists idx_oppe_fppe_status on public.oppe_fppe (status);
create index if not exists idx_oppe_audit_evaluation on public.oppe_audit_logs (evaluation_id, created_at desc);
create index if not exists idx_oppe_audit_created on public.oppe_audit_logs (created_at desc);
create index if not exists idx_oppe_audit_user on public.oppe_audit_logs (user_id);

-- ============================================================================
-- 8. TRIGGERS — updated_at, penomoran otomatis, kunci data finalized,
--    audit log immutable
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array['oppe_ksm', 'oppe_master_options', 'oppe_indicator_categories', 'oppe_indicators',
                           'oppe_templates', 'oppe_doctors', 'oppe_evaluations', 'oppe_evaluation_items', 'oppe_fppe']
  loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$s', t);
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

create table if not exists public.oppe_counters (
  kind        text not null,
  year        int not null,
  last_number int not null default 0,
  primary key (kind, year)
);

create or replace function public.oppe_next_number(p_kind text, p_year int)
returns int
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  insert into public.oppe_counters (kind, year, last_number) values (p_kind, p_year, 1)
  on conflict (kind, year) do update set last_number = public.oppe_counters.last_number + 1
  returning last_number into n;
  return n;
end;
$$;

create or replace function public.oppe_evaluation_number()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.evaluation_number is null or new.evaluation_number = '' then
    new.evaluation_number := 'OPPE/' || new.year::text || '/' || lpad(public.oppe_next_number('evaluation', new.year)::text, 6, '0');
  end if;
  if new.semester is null and new.period_type in ('semester_1', 'semester_2') then
    new.semester := case new.period_type when 'semester_1' then 1 else 2 end;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_oppe_evaluation_number on public.oppe_evaluations;
create trigger trg_oppe_evaluation_number before insert on public.oppe_evaluations
  for each row execute function public.oppe_evaluation_number();

create or replace function public.oppe_fppe_number()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare y int := extract(year from coalesce(new.start_date, current_date))::int;
begin
  if new.fppe_number is null or new.fppe_number = '' then
    new.fppe_number := 'FPPE/' || y::text || '/' || lpad(public.oppe_next_number('fppe', y)::text, 4, '0');
  end if;
  return new;
end;
$$;
drop trigger if exists trg_oppe_fppe_number on public.oppe_fppe;
create trigger trg_oppe_fppe_number before insert on public.oppe_fppe
  for each row execute function public.oppe_fppe_number();

-- 8.a Kunci evaluasi FINALIZED + gerbang workflow di level database.
--     auth.uid() null = koneksi server/SQL editor (service) -> tidak dibatasi.
create or replace function public.oppe_guard_evaluation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if old.status = 'finalized' then
    if not (new.status = 'in_progress'
            and coalesce(btrim(new.reopen_reason), '') <> ''
            and new.reopen_reason is distinct from old.reopen_reason
            and public.is_oppe_committee()) then
      raise exception 'Evaluasi OPPE sudah FINAL dan tidak dapat diubah. Gunakan "Buka Kembali" (Reopen) dengan alasan.'
        using errcode = 'P0001';
    end if;
  end if;

  if new.status is distinct from old.status
     and new.status in ('reviewed', 'approved', 'finalized')
     and not public.is_oppe_committee() then
    raise exception 'Hanya Komite Medik/Mutu yang dapat melakukan review, approval, dan finalisasi OPPE.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;
drop trigger if exists trg_oppe_guard_evaluation on public.oppe_evaluations;
create trigger trg_oppe_guard_evaluation before update on public.oppe_evaluations
  for each row execute function public.oppe_guard_evaluation();

create or replace function public.oppe_guard_items()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_status text;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  select status into v_status from public.oppe_evaluations
   where id = coalesce(new.evaluation_id, old.evaluation_id);
  if v_status = 'finalized' then
    raise exception 'Item evaluasi OPPE yang sudah FINAL tidak dapat diubah.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_oppe_guard_items on public.oppe_evaluation_items;
create trigger trg_oppe_guard_items before insert or update or delete on public.oppe_evaluation_items
  for each row execute function public.oppe_guard_items();

-- 8.b Audit trail tidak boleh diubah / dihapus (oleh siapa pun, termasuk admin).
create or replace function public.oppe_audit_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Audit trail OPPE bersifat permanen dan tidak dapat diubah/dihapus.' using errcode = 'P0001';
end;
$$;
drop trigger if exists trg_oppe_audit_immutable on public.oppe_audit_logs;
create trigger trg_oppe_audit_immutable before update or delete on public.oppe_audit_logs
  for each row execute function public.oppe_audit_immutable();

-- 8.c Validasi total bobot kategori (dipakai halaman Pengaturan)
create or replace function public.oppe_category_weight_total()
returns numeric
language sql stable security definer set search_path = public
as $$
  select coalesce(sum(weight), 0) from public.oppe_indicator_categories where is_active;
$$;

-- ============================================================================
-- 9. FK OPSIONAL KE MASTER UNIT EXISTING (uimu_units) — bila tabelnya ada
-- ============================================================================
do $$
begin
  if to_regclass('public.uimu_units') is not null then
    if not exists (select 1 from pg_constraint where conname = 'oppe_doctors_unit_fk') then
      alter table public.oppe_doctors add constraint oppe_doctors_unit_fk
        foreign key (unit_id) references public.uimu_units (id) on delete set null;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'oppe_evaluations_unit_fk') then
      alter table public.oppe_evaluations add constraint oppe_evaluations_unit_fk
        foreign key (unit_id) references public.uimu_units (id) on delete set null;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'oppe_indicators_unit_fk') then
      alter table public.oppe_indicators add constraint oppe_indicators_unit_fk
        foreign key (unit_id) references public.uimu_units (id) on delete set null;
    end if;
  end if;
end $$;

-- ============================================================================
-- 10. ROW LEVEL SECURITY
-- ============================================================================

-- Fungsi bantu (security definer agar tidak terjadi rekursi RLS antar tabel)
create or replace function public.oppe_is_own_doctor(p_doctor_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (select 1 from public.oppe_doctors d where d.id = p_doctor_id and d.user_id = auth.uid() and auth.uid() is not null);
$$;

create or replace function public.oppe_can_read_evaluation(p_evaluation_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.oppe_evaluations e
    where e.id = p_evaluation_id
      and (
        public.is_oppe_committee()
        or e.evaluator_id = auth.uid()
        or e.created_by = auth.uid()
        -- dokter hanya melihat hasil yang sudah disetujui/final
        or (e.status in ('approved', 'finalized') and public.oppe_is_own_doctor(e.doctor_id))
      )
  );
$$;

create or replace function public.oppe_can_edit_evaluation(p_evaluation_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.oppe_evaluations e
    where e.id = p_evaluation_id
      and e.status <> 'finalized'
      and (
        public.is_oppe_committee()
        or (e.evaluator_id = auth.uid() and e.status in ('draft', 'in_progress'))
      )
  );
$$;

-- ── Master: dibaca semua pengguna OPPE; ditulis Komite Medik/Admin ──────────
do $$
declare t text;
begin
  foreach t in array array['oppe_ksm', 'oppe_master_options', 'oppe_indicator_categories', 'oppe_indicators',
                           'oppe_templates', 'oppe_template_indicators']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.oppe_has_access())', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_oppe_committee()) with check (public.is_oppe_committee())', t || '_write', t);
  end loop;
end $$;

-- ── Pengaturan: dibaca pengguna OPPE; diubah ADMIN saja ─────────────────────
alter table public.oppe_settings enable row level security;
drop policy if exists "oppe_settings_select" on public.oppe_settings;
create policy "oppe_settings_select" on public.oppe_settings for select to authenticated using (public.oppe_has_access());
drop policy if exists "oppe_settings_write" on public.oppe_settings;
create policy "oppe_settings_write" on public.oppe_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── Dokter: evaluator/komite melihat semua; dokter hanya barisnya sendiri ──
alter table public.oppe_doctors enable row level security;
drop policy if exists "oppe_doctors_select" on public.oppe_doctors;
create policy "oppe_doctors_select" on public.oppe_doctors for select to authenticated
  using (public.is_oppe_evaluator() or user_id = auth.uid());
drop policy if exists "oppe_doctors_write" on public.oppe_doctors;
create policy "oppe_doctors_write" on public.oppe_doctors for all to authenticated
  using (public.is_oppe_committee()) with check (public.is_oppe_committee());

-- ── Evaluasi ────────────────────────────────────────────────────────────
alter table public.oppe_evaluations enable row level security;

drop policy if exists "oppe_evaluations_select" on public.oppe_evaluations;
create policy "oppe_evaluations_select" on public.oppe_evaluations for select to authenticated
  using (
    public.is_oppe_committee()
    or evaluator_id = auth.uid()
    or created_by = auth.uid()
    or (status in ('approved', 'finalized') and public.oppe_is_own_doctor(doctor_id))
  );

drop policy if exists "oppe_evaluations_insert" on public.oppe_evaluations;
create policy "oppe_evaluations_insert" on public.oppe_evaluations for insert to authenticated
  with check (
    public.is_oppe_committee()
    or (public.is_oppe_evaluator() and evaluator_id = auth.uid() and created_by = auth.uid() and status in ('draft', 'in_progress'))
  );

drop policy if exists "oppe_evaluations_update" on public.oppe_evaluations;
create policy "oppe_evaluations_update" on public.oppe_evaluations for update to authenticated
  using (
    public.is_oppe_committee()
    or (evaluator_id = auth.uid() and status in ('draft', 'in_progress'))
  )
  with check (
    public.is_oppe_committee()
    or (evaluator_id = auth.uid() and status in ('draft', 'in_progress', 'submitted'))
  );

drop policy if exists "oppe_evaluations_delete" on public.oppe_evaluations;
create policy "oppe_evaluations_delete" on public.oppe_evaluations for delete to authenticated
  using (public.is_admin() or (public.is_oppe_committee() and status <> 'finalized'));

-- ── Item evaluasi: mengikuti hak atas evaluasi induk ────────────────────────
alter table public.oppe_evaluation_items enable row level security;
drop policy if exists "oppe_items_select" on public.oppe_evaluation_items;
create policy "oppe_items_select" on public.oppe_evaluation_items for select to authenticated
  using (public.oppe_can_read_evaluation(evaluation_id));
drop policy if exists "oppe_items_insert" on public.oppe_evaluation_items;
create policy "oppe_items_insert" on public.oppe_evaluation_items for insert to authenticated
  with check (public.oppe_can_edit_evaluation(evaluation_id));
drop policy if exists "oppe_items_update" on public.oppe_evaluation_items;
create policy "oppe_items_update" on public.oppe_evaluation_items for update to authenticated
  using (public.oppe_can_edit_evaluation(evaluation_id))
  with check (public.oppe_can_edit_evaluation(evaluation_id));
drop policy if exists "oppe_items_delete" on public.oppe_evaluation_items;
create policy "oppe_items_delete" on public.oppe_evaluation_items for delete to authenticated
  using (public.oppe_can_edit_evaluation(evaluation_id));

-- ── FPPE ───────────────────────────────────────────────────────────────────
alter table public.oppe_fppe enable row level security;
drop policy if exists "oppe_fppe_select" on public.oppe_fppe;
create policy "oppe_fppe_select" on public.oppe_fppe for select to authenticated
  using (public.is_oppe_committee() or evaluator_id = auth.uid() or public.oppe_is_own_doctor(doctor_id));
drop policy if exists "oppe_fppe_insert" on public.oppe_fppe;
create policy "oppe_fppe_insert" on public.oppe_fppe for insert to authenticated
  with check (public.is_oppe_committee());
drop policy if exists "oppe_fppe_update" on public.oppe_fppe;
create policy "oppe_fppe_update" on public.oppe_fppe for update to authenticated
  using (public.is_oppe_committee() or evaluator_id = auth.uid())
  with check (public.is_oppe_committee() or evaluator_id = auth.uid());
drop policy if exists "oppe_fppe_delete" on public.oppe_fppe;
create policy "oppe_fppe_delete" on public.oppe_fppe for delete to authenticated
  using (public.is_admin());

-- ── Audit trail: insert oleh pelaku sendiri; dibaca Komite/Admin atau pelaku ─
alter table public.oppe_audit_logs enable row level security;
drop policy if exists "oppe_audit_select" on public.oppe_audit_logs;
create policy "oppe_audit_select" on public.oppe_audit_logs for select to authenticated
  using (public.is_oppe_committee() or user_id = auth.uid());
drop policy if exists "oppe_audit_insert" on public.oppe_audit_logs;
create policy "oppe_audit_insert" on public.oppe_audit_logs for insert to authenticated
  with check (user_id = auth.uid() and public.oppe_has_access());
-- (sengaja TIDAK ada policy update/delete)

-- Counter penomoran hanya diakses lewat fungsi security definer
alter table public.oppe_counters enable row level security;

-- ============================================================================
-- 11. STORAGE — bukti/evidence per indikator (PDF, Excel, gambar, dokumen)
-- ============================================================================
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('oppe-evidence', 'oppe-evidence', false)
    on conflict (id) do nothing;

    execute 'drop policy if exists "oppe_storage_select" on storage.objects';
    execute $p$create policy "oppe_storage_select" on storage.objects for select to authenticated
      using (bucket_id = 'oppe-evidence' and (public.is_oppe_evaluator() or owner = auth.uid()))$p$;
    execute 'drop policy if exists "oppe_storage_insert" on storage.objects';
    execute $p$create policy "oppe_storage_insert" on storage.objects for insert to authenticated
      with check (bucket_id = 'oppe-evidence' and public.is_oppe_evaluator())$p$;
    execute 'drop policy if exists "oppe_storage_delete" on storage.objects';
    execute $p$create policy "oppe_storage_delete" on storage.objects for delete to authenticated
      using (bucket_id = 'oppe-evidence' and (public.is_admin() or owner = auth.uid()))$p$;
  end if;
end $$;

-- ============================================================================
-- 12. IMPORT — integrasi dengan Import Engine existing (migration_import_export.sql)
-- ============================================================================
do $$
begin
  if to_regclass('public.import_history') is not null then
    alter table public.import_history drop constraint if exists import_history_module_check;
    alter table public.import_history add constraint import_history_module_check
      check (module in ('risk', 'ikp', 'budaya', 'kepuasan', 'uimu', 'custom_indicator', 'oppe'));

    -- is_import_reviewer(): ditulis ulang IDENTIK dengan versi existing + kasus 'oppe'.
    execute $f$
      create or replace function public.is_import_reviewer(p_module text)
      returns boolean
      language plpgsql security definer stable set search_path = public
      as $body$
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
          when 'oppe' then public.is_oppe_evaluator()
          else false
        end;
      end;
      $body$;
    $f$;
  end if;
end $$;

-- RPC import transaksional. Satu baris payload = satu indikator untuk satu
-- dokter pada satu periode. Evaluasi dibuat otomatis (status in_progress)
-- bila belum ada; item di-upsert dari snapshot master indikator. Evaluasi
-- yang sudah FINAL dilewati (tidak diubah). Skor dihitung ulang aplikasi
-- (needs_recalc = true) memakai engine yang sama dengan form evaluasi.
create or replace function public.oppe_import_batch(p_payload jsonb, p_actor uuid)
returns table (success_count int, inserted_ids uuid[])
language plpgsql security definer set search_path = public
as $$
declare
  v_item jsonb;
  v_data jsonb;
  v_doctor public.oppe_doctors%rowtype;
  v_ind record;
  v_eval_id uuid;
  v_eval_status text;
  v_eval_evaluator uuid;
  v_year int;
  v_period text;
  v_template uuid;
  v_count int := 0;
  v_ids uuid[] := '{}';
  v_actor_name text;
begin
  if auth.uid() is null or auth.uid() <> p_actor or not public.is_oppe_evaluator() then
    raise exception 'Tidak memiliki izin import untuk modul OPPE.';
  end if;

  select coalesce(display_name, email) into v_actor_name from public.profiles where id = p_actor;

  for v_item in select * from jsonb_array_elements(p_payload) loop
    v_data := v_item -> 'data';
    v_year := (v_data->>'year')::int;
    v_period := v_data->>'period_type';

    select * into v_doctor from public.oppe_doctors where id = (v_data->>'doctor_id')::uuid;
    if not found then
      raise exception 'Dokter tidak ditemukan (baris payload %).', v_count + 1;
    end if;

    select i.*, c.code as cat_code into v_ind
      from public.oppe_indicators i join public.oppe_indicator_categories c on c.id = i.category_id
     where i.id = (v_data->>'indicator_id')::uuid;
    if not found then
      raise exception 'Indikator tidak ditemukan (baris payload %).', v_count + 1;
    end if;

    v_eval_id := null;
    select id, status, evaluator_id into v_eval_id, v_eval_status, v_eval_evaluator from public.oppe_evaluations
     where doctor_id = v_doctor.id and year = v_year and period_type = v_period and period_start is null;

    if v_eval_id is not null and not public.is_oppe_committee() then
      if v_eval_evaluator is distinct from p_actor or v_eval_status not in ('draft', 'in_progress') then
        raise exception 'Evaluasi OPPE % (%, %) ditugaskan ke evaluator lain atau sudah diajukan — import dibatalkan.', v_doctor.name, v_period, v_year;
      end if;
    end if;

    if v_eval_id is null then
      select t.id into v_template from public.oppe_templates t
       where t.is_active and t.ksm_id is not distinct from v_doctor.ksm_id
       order by t.created_at limit 1;
      insert into public.oppe_evaluations (
        doctor_id, ksm_id, unit_id, unit_name, profession, specialty, template_id,
        period_type, year, evaluator_id, evaluator_name, evaluation_date, status, needs_recalc, created_by
      ) values (
        v_doctor.id, v_doctor.ksm_id, v_doctor.unit_id, v_doctor.unit_name, v_doctor.profession, v_doctor.specialty, v_template,
        v_period, v_year, p_actor, v_actor_name, current_date, 'in_progress', true, p_actor
      ) returning id, status into v_eval_id, v_eval_status;
      insert into public.oppe_audit_logs (user_id, user_name, evaluation_id, entity_id, action, new_data, reason)
      values (p_actor, v_actor_name, v_eval_id, v_eval_id, 'import', jsonb_build_object('doctor', v_doctor.name, 'year', v_year, 'period_type', v_period), 'Evaluasi dibuat dari import Excel');
    end if;

    if v_eval_status = 'finalized' then
      continue;  -- evaluasi final tidak diubah lewat import
    end if;

    insert into public.oppe_evaluation_items (
      evaluation_id, indicator_id, sequence, category_id, category_code, code, name,
      data_type, unit_label, target_text, target_operator, target_value, trigger_text, trigger_operator, trigger_value,
      options, pass_values, attention_values, is_critical, weight, score_met, score_attention, score_trigger,
      realization_text, realization_number, notes, source_data, quality_indicator_id
    ) values (
      v_eval_id, v_ind.id, coalesce((select max(sequence) + 1 from public.oppe_evaluation_items where evaluation_id = v_eval_id), 1),
      v_ind.category_id, v_ind.cat_code, v_ind.code, v_ind.name,
      v_ind.data_type, v_ind.unit_label, v_ind.target_text, v_ind.target_operator,
      coalesce((v_data->>'target_value')::numeric, v_ind.target_value),
      v_ind.trigger_text, v_ind.trigger_operator, v_ind.trigger_value,
      v_ind.options, v_ind.pass_values, v_ind.attention_values, v_ind.is_critical, v_ind.weight,
      v_ind.score_met, v_ind.score_attention, v_ind.score_trigger,
      v_data->>'realization_text', (v_data->>'realization_number')::numeric, v_data->>'notes',
      coalesce(v_data->>'source_data', v_ind.source_data), v_ind.quality_indicator_id
    )
    on conflict (evaluation_id, indicator_id) where indicator_id is not null do update set
      realization_text = excluded.realization_text,
      realization_number = excluded.realization_number,
      target_value = coalesce((v_data->>'target_value')::numeric, public.oppe_evaluation_items.target_value),
      notes = coalesce(excluded.notes, public.oppe_evaluation_items.notes),
      source_data = coalesce(excluded.source_data, public.oppe_evaluation_items.source_data);

    update public.oppe_evaluations set needs_recalc = true where id = v_eval_id;

    v_count := v_count + 1;
    if not (v_eval_id = any(v_ids)) then
      v_ids := array_append(v_ids, v_eval_id);
    end if;
  end loop;

  if to_regprocedure('public.log_import_audit(text,text,uuid)') is not null then
    perform public.log_import_audit('oppe', format('Import %s data realisasi OPPE (%s evaluasi)', v_count, coalesce(array_length(v_ids, 1), 0)), p_actor);
  end if;
  return query select v_count, v_ids;
end;
$$;

grant execute on function public.oppe_import_batch(jsonb, uuid) to authenticated;

-- ============================================================================
-- 13. REALTIME
-- ============================================================================
do $$
begin
  begin alter publication supabase_realtime add table public.oppe_evaluations; exception when others then null; end;
  begin alter publication supabase_realtime add table public.oppe_fppe; exception when others then null; end;
end $$;

-- ============================================================================
-- 14. SEED KONFIGURASI DEFAULT (tidak menimpa perubahan admin)
-- ============================================================================
insert into public.oppe_indicator_categories (code, name, weight, description, sort_order) values
  ('A', 'Perilaku Profesional', 30, 'Kepatuhan jam pelayanan, kehadiran rapat KSM, keluhan pasien, kerja sama tim, kode etik & aturan internal.', 1),
  ('B', 'Pengembangan Profesional', 20, 'Pemenuhan SKP, pelatihan mutu/PPI/keselamatan pasien, sertifikasi, kegiatan ilmiah, edukasi.', 2),
  ('C', 'Kinerja Klinis Spesifik', 50, 'Indikator klinis spesifik per KSM.', 3)
on conflict (code) do nothing;

insert into public.oppe_settings (
  id, score_met, score_attention, score_trigger, result_categories,
  recommendation_critical_trigger, recommendation_multiple_trigger, recommendation_decline
) values (
  'default', 100, 70, 0,
  '[
    {"code":"sangat_baik","label":"Sangat Baik","min":90,"max":null,"color":"#22c55e","recommendation":"Direkomendasikan mempertahankan kewenangan klinis dan melanjutkan monitoring OPPE rutin."},
    {"code":"baik","label":"Baik","min":80,"max":90,"color":"#4f8ef7","recommendation":"Direkomendasikan melanjutkan kewenangan klinis dengan monitoring rutin."},
    {"code":"perlu_perbaikan","label":"Perlu Perbaikan","min":70,"max":80,"color":"#f59e0b","recommendation":"Direkomendasikan rencana perbaikan dan pemantauan pada indikator yang belum mencapai target."},
    {"code":"tidak_memenuhi","label":"Tidak Memenuhi","min":0,"max":70,"color":"#ef4444","recommendation":"Direkomendasikan evaluasi lebih lanjut oleh Komite Medik/Subkomite Mutu Profesi."}
  ]'::jsonb,
  'Direkomendasikan evaluasi terfokus/FPPE berdasarkan hasil indikator kritis.',
  'Terdapat beberapa indikator yang terkena trigger — dipertimbangkan evaluasi terfokus/FPPE sesuai keputusan Komite Medik.',
  'Skor menurun signifikan dibanding periode sebelumnya — perlu ditelusuri penyebabnya bersama Ketua KSM.'
) on conflict (id) do nothing;

insert into public.oppe_master_options (kind, code, name, sort_order) values
  ('profession', 'DU', 'Dokter Umum', 1),
  ('profession', 'DSP', 'Dokter Spesialis', 2),
  ('profession', 'DRG', 'Dokter Gigi', 3),
  ('profession', 'DRGSP', 'Dokter Gigi Spesialis', 4),
  ('specialty', 'SP.AN', 'Anestesiologi dan Terapi Intensif (Sp.An)', 1),
  ('specialty', 'SP.RAD', 'Radiologi (Sp.Rad)', 2),
  ('specialty', 'SP.M', 'Mata (Sp.M)', 3),
  ('specialty', 'SP.THT', 'THT-BKL (Sp.THT-BKL)', 4),
  ('specialty', 'SP.KFR', 'Kedokteran Fisik dan Rehabilitasi (Sp.KFR)', 5),
  ('specialty', 'SP.PK', 'Patologi Klinik (Sp.PK)', 6),
  ('specialty', 'SP.OG', 'Obstetri dan Ginekologi (Sp.OG)', 7),
  ('specialty', 'SP.PD', 'Penyakit Dalam (Sp.PD)', 8),
  ('specialty', 'SP.A', 'Anak (Sp.A)', 9),
  ('specialty', 'SP.B', 'Bedah (Sp.B)', 10),
  ('service_type', 'RJ', 'Rawat Jalan', 1),
  ('service_type', 'RI', 'Rawat Inap', 2),
  ('service_type', 'IGD', 'Gawat Darurat', 3),
  ('service_type', 'OK', 'Kamar Operasi', 4),
  ('service_type', 'PNJ', 'Penunjang Medis', 5)
on conflict (kind, name) do nothing;

-- ============================================================================
-- 15. SEED INDIKATOR & TEMPLATE DARI "OPPE BARU By dr.Sri RSASM.xlsx"
--     (dibangkitkan otomatis dari file Excel — 12 lembar, 168 indikator)
-- ============================================================================
-- 15.a KSM
insert into public.oppe_ksm (code, name, description) values
  ('DU', 'KSM Dokter Umum', 'Unit Kerja Utama: [ IGD / Poliklinik Rawat Jalan / Dokter Ruangan Rawat Inap ]'),
  ('NBDH', 'KSM Non Bedah', 'Kelompok Staf Medis (KSM): [Penyakit Dalam / Anak / Jantung / Saraf / Paru / Kulit / Jiwa  /Dll]'),
  ('BDH', 'KSM Bedah', 'Kelompok Staf Medis (KSM): Spesialisasi Bedah (Umum / Orthopedi / Urologi / Onkologi / Digestif  / DLL]'),
  ('OBG', 'KSM Obstetri & Ginekologi', 'Kelompok Staf Medis (KSM): Kebidanan dan Kandungan (Obstetri & Ginekologi)'),
  ('ANS', 'KSM Anestesiologi & Terapi Intensif', 'Kelompok Staf Medis (KSM): Spesialis Anestesiologi dan Terapi Intensif'),
  ('KFR', 'KSM Kedokteran Fisik & Rehabilitasi Medik', 'Kelompok Staf Medis (KSM): Kedokteran Fisik dan Rehabilitasi Medik'),
  ('MTA', 'KSM Mata', 'Kelompok Staf Medis (KSM): Mata / Oftalmologi'),
  ('THT', 'KSM THT-BKL', 'Kelompok Staf Medis (KSM): THT-BKL'),
  ('GGM', 'KSM Gigi & Mulut', 'Kelompok Staf Medis (KSM): POLI GIGI & MULUT'),
  ('LKT', 'KSM / Klinik Laktasi', 'Unit Kerja Utama: Poliklinik Laktasi / Klinik ASI / Rawat Inap Post-Partum'),
  ('PK', 'KSM Patologi Klinik', 'Kelompok Staf Medis (KSM): Patologi Klinik / Penunjang Medis'),
  ('RAD', 'KSM Radiologi', 'Kelompok Staf Medis (KSM): Spesialis Radiologi')
on conflict (code) do nothing;

-- 15.b Template
insert into public.oppe_templates (code, name, profession, ksm_id, description)
select v.code, v.name, v.profession, k.id, v.description from (values
  ('UMUM', 'Template OPPE Dokter Umum', 'Dokter Umum', 'DU', 'Diimpor dari lembar ''OPPE DR UMUM'' — LEMBAR EVALUASI PRAKTIK PROFESIONAL BERKELANJUTAN (OPPE) DOKTER UMUM'),
  ('NBDH', 'Template OPPE KSM Non Bedah', 'Dokter Spesialis', 'NBDH', 'Diimpor dari lembar ''OPPE NON BEDAH'' — LEMBAR EVALUASI PRAKTIK PROFESIONAL BERKELANJUTAN (OPPE) KSM NON BEDAH'),
  ('BDH', 'Template OPPE KSM Bedah', 'Dokter Spesialis', 'BDH', 'Diimpor dari lembar ''OPPE BEDAH'' — LEMBAR EVALUASI PRAKTIK PROFESIONAL BERKELANJUTAN (OPPE) KSM BEDAH'),
  ('OBG', 'Template OPPE KSM Obstetri & Ginekologi', 'Dokter Spesialis', 'OBG', 'Diimpor dari lembar ''OPPE DR OBGYN'' — LEMBAR EVALUASI PRAKTIK PROFESIONAL BERKELANJUTAN (OPPE) KSM Kebidanan dan Kandungan (Obstetri & Ginekologi)'),
  ('ANS', 'Template OPPE KSM Anestesiologi', 'Dokter Spesialis', 'ANS', 'Diimpor dari lembar ''OPPE DR ANESTESI'' — LEMBAR EVALUASI PRAKTIK PROFESIONAL BERKELANJUTAN (OPPE) KSM DOKTER ANESTESI'),
  ('KFR', 'Template OPPE KSM Rehabilitasi Medik', 'Dokter Spesialis', 'KFR', 'Diimpor dari lembar ''OPPE DR REHAB'' — LEMBAR EVALUASI PRAKTIK PROFESIONAL BERKELANJUTAN (OPPE) DOKTER REHABILITASI MEDIK'),
  ('MTA', 'Template OPPE KSM Mata', 'Dokter Spesialis', 'MTA', 'Diimpor dari lembar ''OPPE DR MATA'' — LEMBAR EVALUASI PRAKTIK PROFESIONAL BERKELANJUTAN (OPPE) DOKTER SPESIALIS MATA'),
  ('THT', 'Template OPPE KSM THT-BKL', 'Dokter Spesialis', 'THT', 'Diimpor dari lembar ''OPPE DR THT'' — LEMBAR EVALUASI PRAKTIK PROFESIONAL BERKELANJUTAN (OPPE) DOKTER THT-BKL'),
  ('DRG', 'Template OPPE Dokter Gigi Umum', 'Dokter Gigi', 'GGM', 'Diimpor dari lembar ''OPPE DRG UMUM'' — LEMBAR EVALUASI PRAKTIK PROFESIONAL BERKELANJUTAN (OPPE) DOKTER GIGI UMUM'),
  ('LKT', 'Template OPPE Dokter Laktasi', 'Dokter Umum', 'LKT', 'Diimpor dari lembar ''OPPE DR LAKTASI'' — LEMBAR EVALUASI PRAKTIK PROFESIONAL BERKELANJUTAN (OPPE) DOKTER LAKTASI'),
  ('PK', 'Template OPPE KSM Patologi Klinik', 'Dokter Spesialis', 'PK', 'Diimpor dari lembar ''OPPE Dr PK'' — LEMBAR EVALUASI PRAKTIK PROFESIONAL BERKELANJUTAN (OPPE) DOKTER SPESIALIS PATOLOGI KLINIK'),
  ('RAD', 'Template OPPE KSM Radiologi', 'Dokter Spesialis', 'RAD', 'Diimpor dari lembar ''OPPE Dr RADIOLOGI'' — LEMBAR EVALUASI PRAKTIK PROFESIONAL BERKELANJUTAN (OPPE) DOKTER SPESIALIS RADIOLOGI')
) as v(code, name, profession, ksm_code, description)
join public.oppe_ksm k on k.code = v.ksm_code
on conflict (code) do nothing;

-- 15.c Indikator (teks target/trigger/sumber data sesuai Excel)
insert into public.oppe_indicators (code, category_id, ksm_id, profession, name, unit_label, data_type, target_text, target_operator, target_value,
  trigger_text, trigger_operator, trigger_value, options, pass_values, attention_values, is_critical, source_data, frequency, evaluation_period, reference_note)
select v.code, c.id, k.id, v.profession, v.name, v.unit_label, v.data_type, v.target_text, v.target_operator, v.target_value,
  v.trigger_text, v.trigger_operator, v.trigger_value, v.options, v.pass_values, v.attention_values, v.is_critical, v.source_data, 'Per periode evaluasi', 'Semester / Tahunan', v.reference_note
from (values
  ('UMUM-A1', 'A', 'DU', 'Dokter Umum', 'Kepatuhan jam shift (datang tepat waktu saat operan)', '%', 'percent', '≥ 95%', 'gte', 95::numeric, '< 90% tepat waktu', 'lt', 90::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Absensi / SDM', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('UMUM-A2', 'A', 'DU', 'Dokter Umum', 'Menghadiri rapat koordinasi / pertemuan klinis Dokter Umum', '%', 'percent', '≥ 80%', 'gte', 80::numeric, 'Di bawah target (Ya/Tidak)', 'lt', 80::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Notulen & Absensi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('UMUM-A3', 'A', 'DU', 'Dokter Umum', 'Tidak ada keluhan tertulis dari pasien atau keluarga', 'kasus', 'count', '0 Keluhan', 'zero', 0::numeric, '≥ 1 komplain', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Customer Service', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('UMUM-A4', 'A', 'DU', 'Dokter Umum', 'Komunikasi efektif saat konsul ke Dokter Spesialis (SBAR)', 'kategori', 'grade', 'Skor Baik', 'category', null::numeric, 'Ada komplain spesialis', 'not_pass', null::numeric, array['Baik', 'Cukup', 'Kurang']::text[], array['Baik']::text[], array['Cukup']::text[], false, 'Rekam Medis / SIMRS', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('UMUM-A5', 'A', 'DU', 'Dokter Umum', 'Kepatuhan terhadap Kode Etik Kedokteran & Aturan Internal RS', 'kasus', 'count', '0 Pelanggaran', 'zero', 0::numeric, '≥ 1 kasus', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite Medik', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('UMUM-B1', 'B', 'DU', 'Dokter Umum', 'Pemenuhan poin SKP tahunan (Kemenkes/IDI)', 'SKP', 'skp', 'Sesuai target', 'gte', null::numeric, '< Target', 'lt_target', null::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Logbook / LMS', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx — Target SKP "Sesuai target" — isi nilai target SKP pada master indikator atau per evaluasi.'),
  ('UMUM-B2', 'B', 'DU', 'Dokter Umum', 'Sertifikasi Kegawatdaruratan yang aktif (ATLS / ACLS / ANLS)', 'kategori', 'category', '100% Aktif', 'category', null::numeric, 'Sertifikat kedaluwarsa', 'not_pass', null::numeric, array['Aktif', 'Mati']::text[], array['Aktif']::text[], '{}'::text[], false, 'Berkas Kredensial', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('UMUM-B3', 'B', 'DU', 'Dokter Umum', 'Mengikuti Pelatihan Internal RS (Code Blue, PPI, Patient Safety)', 'kategori', 'pass', '100% lulus', 'category', null::numeric, 'Belum lulus', 'not_pass', null::numeric, array['Lulus', 'Belum']::text[], array['Lulus']::text[], '{}'::text[], false, 'Bagian Diklat', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('UMUM-C1', 'C', 'DU', 'Dokter Umum', 'Ketepatan waktu respons pelayanan di IGD (Response Time ≤ 5 mnt)', '%', 'percent', '≥ 95%', 'gte', 95::numeric, '< 90%', 'lt', 90::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Indikator Mutu IGD', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('UMUM-C2', 'C', 'DU', 'Dokter Umum', 'Kelengkapan Asesmen Gawat Darurat / Medis Awal < 2 jam', '%', 'percent', '100% Lengkap', 'pct100', 100::numeric, '< 90% lengkap', 'lt', 90::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Audit Rekam Medis', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('UMUM-C3', 'C', 'DU', 'Dokter Umum', 'Kepatuhan penulisan resep sesuai Formularium RS', '%', 'percent', '≥ 95%', 'gte', 95::numeric, '< 95%', 'lt', 95::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Komite Farmasi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('UMUM-C4', 'C', 'DU', 'Dokter Umum', 'Ketepatan melakukan triase pasien sesuai regulasi (ATS/ESI)', '%', 'percent', '≥ 90% tepat', 'gte', 90::numeric, '< 85% tepat', 'lt', 85::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Audit Klinis IGD', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('UMUM-C5', 'C', 'DU', 'Dokter Umum', 'Angka kesalahan pemberian instruksi medis awal (medication error)', 'kasus', 'count', '0 Kasus', 'zero', 0::numeric, '≥ 1 insiden', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite Keselamatan Pasien', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('UMUM-C6', 'C', 'DU', 'Dokter Umum', 'Kepatuhan melakukan Informed Consent sebelum tindakan invasif', '%', 'percent', '100%', 'pct100', 100::numeric, '< 100%', 'lt', 100::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Audit Rekam Medis', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('NBDH-A1', 'A', 'NBDH', 'Dokter Spesialis', 'Kepatuhan jam visite dokter di Ruang Rawat Inap ( 06.00 - 20.00 wib )', '%', 'percent', '≥ 80%', 'gte', 80::numeric, '< 80% tepat waktu', 'lt', 80::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'SIMRS / Keperawatan', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('NBDH-A2', 'A', 'NBDH', 'Dokter Spesialis', 'Menghadiri rapat KSM harian/bulanan & Audit Medik', '%', 'percent', '≥ 80%', 'gte', 80::numeric, 'Di bawah target (Ya/Tidak)', 'lt', 80::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Notulen & Absensi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('NBDH-A3', 'A', 'NBDH', 'Dokter Spesialis', 'Tidak ada keluhan tertulis dari pasien atau keluarga', 'kasus', 'count', '0 Keluhan', 'zero', 0::numeric, '≥ 1 komplain', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Customer Service', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('NBDH-A4', 'A', 'NBDH', 'Dokter Spesialis', 'Komunikasi efektif antar-profesi (SBAR/TBAK)', 'kategori', 'grade', 'Skor Baik', 'category', null::numeric, 'Ada laporan konflik', 'not_pass', null::numeric, array['Baik', 'Cukup', 'Kurang']::text[], array['Baik']::text[], array['Cukup']::text[], false, 'Rekam Medis / SIMRS', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('NBDH-A5', 'A', 'NBDH', 'Dokter Spesialis', 'Kepatuhan terhadap Kode Etik Kedokteran & Aturan Internal RS', 'kasus', 'count', '0 Pelanggaran', 'zero', 0::numeric, '≥ 1 kasus', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite Medik', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('NBDH-B1', 'B', 'NBDH', 'Dokter Spesialis', 'Pemenuhan poin SKP tahunan (Kemenkes/IDI)', 'SKP', 'skp', 'Sesuai target', 'gte', null::numeric, '< Target', 'lt_target', null::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Logbook / LMS', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx — Target SKP "Sesuai target" — isi nilai target SKP pada master indikator atau per evaluasi.'),
  ('NBDH-B2', 'B', 'NBDH', 'Dokter Spesialis', 'Mengikuti Pelatihan Mutu, PPI, & Patient Safety', 'kategori', 'pass', '100% Aktif', 'category', null::numeric, 'Belum lulus', 'not_pass', null::numeric, array['Lulus', 'Belum']::text[], array['Lulus']::text[], '{}'::text[], false, 'Bagian Diklat', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('NBDH-B3', 'B', 'NBDH', 'Dokter Spesialis', 'Partisipasi dalam Penyusunan/Review PPK & Clinical Pathway', 'kali', 'count', 'Min. 1x / tahun', 'min', 1::numeric, 'Tidak terlibat', 'lt', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'SK / Notulen KSM', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('NBDH-C1', 'C', 'NBDH', 'Dokter Spesialis', 'Kelengkapan Asesmen Awal Medis Rawat Inap < 24 jam', '%', 'percent', '100%', 'pct100', 100::numeric, '< 90% lengkap', 'lt', 90::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Audit Rekam Medis', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('NBDH-C2', 'C', 'NBDH', 'Dokter Spesialis', 'Kepatuhan penulisan resep sesuai Formularium RS', '%', 'percent', '≥ 95%', 'gte', 95::numeric, '< 90%', 'lt', 90::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Komite Farmasi & Terapi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('NBDH-C3', 'C', 'NBDH', 'Dokter Spesialis', 'Angka re-admisi pasien dengan diagnosis sama < 30 hari', '%', 'percent', '≤ 5%', 'lte', 5::numeric, '> 5%', 'gt', 5::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Rekam Medis / SIMRS', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('NBDH-C4', 'C', 'NBDH', 'Dokter Spesialis', 'Kepatuhan terhadap Panduan Praktik Klinis (PPK)', '%', 'percent', '≥ 80%', 'gte', 80::numeric, '< 80%', 'lt', 80::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Komite Mutu / Audit', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('NBDH-C5', 'C', 'NBDH', 'Dokter Spesialis', 'Kejadian pasien memburuk tanpa aktivasi Early Warning System (EWS)', 'kasus', 'count', '0 Kasus', 'zero', 0::numeric, '≥ 1 insiden', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite Mutu / Audit', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('NBDH-C6', 'C', 'NBDH', 'Dokter Spesialis', 'Angka kematian pasien < 48 jam rawat (NDR - Net Death Rate)', '%', 'percent', 'Sesuai Standar RS', 'lte', null::numeric, 'Melampaui standar', 'gt_target', null::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Komite Mutu / Audit', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx — Target "Sesuai Standar RS" — isi nilai standar RS pada master indikator.'),
  ('BDH-A1', 'A', 'BDH', 'Dokter Spesialis', 'Tingkat kehadiran di Kamar Operasi & Poliklinik', '%', 'percent', '≥ 95%', 'gte', 95::numeric, 'Di bawah target (Ya/Tidak)', 'lt', 95::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Absensi / SIMRS', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('BDH-A2', 'A', 'BDH', 'Dokter Spesialis', 'Menghadiri rapat KSM Bedah & Audit Medik', '%', 'percent', '≥ 80%', 'gte', 80::numeric, 'Di bawah target (Ya/Tidak)', 'lt', 80::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Notulen & Absensi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('BDH-A3', 'A', 'BDH', 'Dokter Spesialis', 'Tidak ada keluhan tertulis dari pasien/keluarga/sejawat bedah', 'kasus', 'count', '0 Keluhan', 'zero', 0::numeric, '≥ 1 komplain', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Customer Service', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('BDH-A4', 'A', 'BDH', 'Dokter Spesialis', 'Kerjasama tim dengan perawat instrumen & anestesi', 'kategori', 'grade', 'Skor Baik', 'category', null::numeric, 'Ada laporan konflik', 'not_pass', null::numeric, array['Baik', 'Cukup', 'Kurang']::text[], array['Baik']::text[], array['Cukup']::text[], false, 'Angket Internal', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('BDH-A5', 'A', 'BDH', 'Dokter Spesialis', 'Kepatuhan terhadap Kode Etik Kedokteran & Aturan Internal', 'kasus', 'count', '0 Pelanggaran', 'zero', 0::numeric, '≥ 1 kasus', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite Medik', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('BDH-B1', 'B', 'BDH', 'Dokter Spesialis', 'Pemenuhan poin SKP tahunan (Kemenkes/IDI)', 'SKP', 'skp', 'Sesuai target', 'gte', null::numeric, '< Target', 'lt_target', null::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Logbook / LMS', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx — Target SKP "Sesuai target" — isi nilai target SKP pada master indikator atau per evaluasi.'),
  ('BDH-B2', 'B', 'BDH', 'Dokter Spesialis', 'Mengikuti Pelatihan Mutu & Keselamatan Pasien', 'kategori', 'pass', '100% lulus', 'category', null::numeric, 'Belum lulus', 'not_pass', null::numeric, array['Lulus', 'Belum']::text[], array['Lulus']::text[], '{}'::text[], false, 'Bagian Diklat', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('BDH-B3', 'B', 'BDH', 'Dokter Spesialis', 'Partisipasi dalam Penyusunan/Review PPK & Clinical Pathway', 'kali', 'count', 'Min. 1x / tahun', 'min', 1::numeric, 'Tidak terlibat', 'lt', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'SK / Notulen KSM', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('BDH-C1', 'C', 'BDH', 'Dokter Spesialis', 'Kepatuhan pengisian Surgical Safety Checklist', '%', 'percent', '100%', 'pct100', 100::numeric, '< 100%', 'lt', 100::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Komite Mutu / Laporan OK', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('BDH-C2', 'C', 'BDH', 'Dokter Spesialis', 'Angka Infeksi Daerah Operasi (IDO) pasien kelolaan', '%', 'percent', '≤ 2%', 'lte', 2::numeric, '> 2%', 'gt', 2::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Komite PPI', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('BDH-C3', 'C', 'BDH', 'Dokter Spesialis', 'Kejadian operasi ulang (Re-operasi) < 24 jam', 'kasus', 'count', '0%', 'zero', 0::numeric, '≥ 1 kasus', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite Mutu / Laporan OK', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx — Realisasi diinput sebagai JUMLAH KASUS karena trigger Excel berbentuk "≥ 1 kasus/insiden" (kolom realisasi Excel bertanda %).'),
  ('BDH-C4', 'C', 'BDH', 'Dokter Spesialis', 'Penulisan Laporan Operasi & Instruksi Pasca-Bedah', '%', 'percent', '100% Lengkap', 'pct100', 100::numeric, '< 95% lengkap', 'lt', 95::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Audit Rekam Medis', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('BDH-C5', 'C', 'BDH', 'Dokter Spesialis', 'Diskordansi Diagnosis Pra-Bedah vs PA (Patologi)', '%', 'percent', '≤ 5%', 'lte', 5::numeric, '> 5%', 'gt', 5::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Berkas Hasil PA & Rekam Medis', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('BDH-C6', 'C', 'BDH', 'Dokter Spesialis', 'Kepatuhan melakukan Time Out sebelum insisi', '%', 'percent', '100%', 'pct100', 100::numeric, '< 100%', 'lt', 100::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Komite Mutu / Audit', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('OBG-A1', 'A', 'OBG', 'Dokter Spesialis', 'Kepatuhan jam visite di Ruang Bersalin (VK) & Rawat Inap', '%', 'percent', '≥ 95%', 'gte', 95::numeric, 'Di bawah target (Ya/Tidak)', 'lt', 95::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Absensi / SIMRS', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('OBG-A2', 'A', 'OBG', 'Dokter Spesialis', 'Menghadiri rapat koordinasi bulanan KSM Obgyn & Audit Maternal', '%', 'percent', '≥ 80%', 'gte', 80::numeric, 'Di bawah target (Ya/Tidak)', 'lt', 80::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Notulen & Absensi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('OBG-A3', 'A', 'OBG', 'Dokter Spesialis', 'Tidak ada keluhan tertulis dari pasien/keluarga/sejawat bedah', 'kasus', 'count', '0 Keluhan', 'zero', 0::numeric, '≥ 1 komplain', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Customer Service', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('OBG-A4', 'A', 'OBG', 'Dokter Spesialis', 'Komunikasi efektif antar-profesi dengan bidan & perawat', 'kategori', 'grade', 'Skor Baik', 'category', null::numeric, 'Ada laporan konflik', 'not_pass', null::numeric, array['Baik', 'Cukup', 'Kurang']::text[], array['Baik']::text[], array['Cukup']::text[], false, 'Angket Internal', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('OBG-A5', 'A', 'OBG', 'Dokter Spesialis', 'Kepatuhan terhadap Kode Etik Kedokteran & Aturan Internal', 'kasus', 'count', '0 Pelanggaran', 'zero', 0::numeric, '≥ 1 kasus', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite Medik', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('OBG-B1', 'B', 'OBG', 'Dokter Spesialis', 'Pemenuhan poin SKP tahunan (Kemenkes/IDI/POGI)', 'SKP', 'skp', 'Sesuai target', 'gte', null::numeric, '< Target', 'lt_target', null::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Logbook / LMS', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx — Target SKP "Sesuai target" — isi nilai target SKP pada master indikator atau per evaluasi.'),
  ('OBG-B2', 'B', 'OBG', 'Dokter Spesialis', 'Mengikuti Pelatihan Mutu & Keselamatan Pasien', 'kategori', 'pass', '100% lulus', 'category', null::numeric, 'Belum lulus', 'not_pass', null::numeric, array['Lulus', 'Belum']::text[], array['Lulus']::text[], '{}'::text[], false, 'Bagian Diklat', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('OBG-B3', 'B', 'OBG', 'Dokter Spesialis', 'Keterlibatan dalam peninjauan PPK / Clinical Pathway Obgyn', 'kali', 'count', 'Min. 1x / tahun', 'min', 1::numeric, 'Tidak terlibat', 'lt', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'SK / Notulen KSM', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('OBG-C1', 'C', 'OBG', 'Dokter Spesialis', 'Kepatuhan pengisian Surgical Safety Checklist sebelum operasi SC', '%', 'percent', '100%', 'pct100', 100::numeric, '< 100%', 'lt', 100::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Komite Mutu / Audit', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('OBG-C2', 'C', 'OBG', 'Dokter Spesialis', 'Kejadian cedera organ sekunder (kandung kemih/usus) saat histerektomi atau Seksio Sesarea (SC)', 'kasus', 'count', '0%', 'zero', 0::numeric, '≥ 1 kasus', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Laporan OK / Mutu', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx — Realisasi diinput sebagai JUMLAH KASUS karena trigger Excel berbentuk "≥ 1 kasus/insiden" (kolom realisasi Excel bertanda %).'),
  ('OBG-C3', 'C', 'OBG', 'Dokter Spesialis', 'Kepatuhan penggunaan Partograf pada pemantauan persalinan pervaginam', '%', 'percent', '100%', 'pct100', 100::numeric, '< 95%', 'lt', 95::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Audit Rekam Medis', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('OBG-C4', 'C', 'OBG', 'Dokter Spesialis', 'Angka kematian ibu melahirkan (Maternal Mortality) akibat kelalaian tata laksana klinis', 'kasus', 'count', '0 Kasus', 'zero', 0::numeric, '≥ 1 insiden', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite Mutu', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('OBG-C5', 'C', 'OBG', 'Dokter Spesialis', 'Angka kejadian robekan perineum derajat 3 dan 4 pada persalinan pervaginam tanpa penyulit penyerta', '%', 'percent', '≤ 5%', 'lte', 5::numeric, '> 5%', 'gt', 5::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Laporan VK / RM', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('OBG-C6', 'C', 'OBG', 'Dokter Spesialis', 'Kepatuhan pelaksanaan penandaan area tindakan (Marking) pada pembedahan ginekologi unilateral (misal: kista ovarium)', '%', 'percent', '100%', 'pct100', 100::numeric, '< 100%', 'lt', 100::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Komite Mutu / Audit', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('ANS-A1', 'A', 'ANS', 'Dokter Spesialis', 'Kepatuhan hadir tepat waktu di Kamar Operasi (On-time)', '%', 'percent', '≥ 95%', 'gte', 95::numeric, '< 90% tepat waktu', 'lt', 90::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Logbook OK / SIMRS', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('ANS-A2', 'A', 'ANS', 'Dokter Spesialis', 'Menghadiri rapat KSM Anestesi & pertemuan klinis RS', '%', 'percent', '≥ 80%', 'gte', 80::numeric, 'Di bawah target (Ya/Tidak)', 'lt', 80::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Notulen & Absensi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('ANS-A3', 'A', 'ANS', 'Dokter Spesialis', 'Tidak ada keluhan tertulis dari pasien atau keluarga', 'kasus', 'count', '0 Keluhan', 'zero', 0::numeric, '≥ 1 komplain', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Customer Service / KSM', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('ANS-A4', 'A', 'ANS', 'Dokter Spesialis', 'Komunikasi efektif (Kerjasama tim anestesi-bedah-perawat)', 'kategori', 'grade', 'Skor Baik', 'category', null::numeric, 'Ada laporan konflik', 'not_pass', null::numeric, array['Baik', 'Cukup', 'Kurang']::text[], array['Baik']::text[], array['Cukup']::text[], false, 'Evaluasi Tim / Angket', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('ANS-A5', 'A', 'ANS', 'Dokter Spesialis', 'Kepatuhan terhadap Kode Etik Kedokteran & Aturan Internal RS', 'kasus', 'count', '0 Pelanggaran', 'zero', 0::numeric, '≥ 1 kasus', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite Medik', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('ANS-B1', 'B', 'ANS', 'Dokter Spesialis', 'Pemenuhan poin SKP tahunan (Kemenkes/IDI/Perdatin)', 'SKP', 'skp', 'Sesuai target', 'gte', null::numeric, '< Target', 'lt_target', null::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Logbook / LMS', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx — Target SKP "Sesuai target" — isi nilai target SKP pada master indikator atau per evaluasi.'),
  ('ANS-B2', 'B', 'ANS', 'Dokter Spesialis', 'Sertifikasi Bantuan Hidup Lanjut/Anestesi yang aktif (ACLS/ATLS)', 'kategori', 'category', '100% Aktif', 'category', null::numeric, 'Sertifikat kedaluwarsa', 'not_pass', null::numeric, array['Aktif', 'Mati']::text[], array['Aktif']::text[], '{}'::text[], false, 'Berkas Kredensial', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('ANS-B3', 'B', 'ANS', 'Dokter Spesialis', 'Mengikuti Pelatihan Mutu, PPI, & Keselamatan Pasien RS', 'kategori', 'pass', '100% lulus', 'category', null::numeric, 'Belum lulus', 'not_pass', null::numeric, array['Lulus', 'Belum']::text[], array['Lulus']::text[], '{}'::text[], false, 'Bagian Diklat', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('ANS-C1', 'C', 'ANS', 'Dokter Spesialis', 'Kepatuhan pengisian Asesmen Pra-Anestesi & Informed Consent', '%', 'percent', '100%', 'pct100', 100::numeric, '< 95%', 'lt', 95::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Audit Rekam Medis', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('ANS-C2', 'C', 'ANS', 'Dokter Spesialis', 'Kepatuhan pemantauan (monitoring) intra-anestesi dalam Rekam Medis', '%', 'percent', '100%', 'pct100', 100::numeric, '< 100%', 'lt', 100::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Audit Rekam Medis OK', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('ANS-C3', 'C', 'ANS', 'Dokter Spesialis', 'Angka kejadian Unplanned Admission ke ICU pasca-operasi', '%', 'percent', '≤ 1%', 'lte', 1::numeric, '> 1.5%', 'gt', 1.5::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Laporan Mutu OK/ICU', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('ANS-C4', 'C', 'ANS', 'Dokter Spesialis', 'Kejadian henti jantung peri-anestesi (Perioperative Cardiac Arrest)', 'kasus', 'count', '0 Kasus', 'zero', 0::numeric, '≥ 1 insiden', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite Mutu / Audit', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx — Realisasi diinput sebagai JUMLAH KASUS karena trigger Excel berbentuk "≥ 1 kasus/insiden" (kolom realisasi Excel bertanda %).'),
  ('ANS-C5', 'C', 'ANS', 'Dokter Spesialis', 'Kepatuhan serah terima pasien di ruang pemulihan (Recovery Room/Aldrete Score)', '%', 'percent', '100%', 'pct100', 100::numeric, '< 95%', 'lt', 95::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Logbook Recovery Room', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('ANS-C6', 'C', 'ANS', 'Dokter Spesialis', 'Kejadian komplikasi berat anestesi (Aspirasi, Reaksi Alergi Berat, Intubasi Sulit Tak Terencana)', 'kasus', 'count', '0 Kasus', 'zero', 0::numeric, '≥ 1 kasus', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Laporan Mutu KSM', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('KFR-A1', 'A', 'KFR', 'Dokter Spesialis', 'Kepatuhan jam pelayanan di Poliklinik Rehabilitasi Medik', '%', 'percent', '≥ 95%', 'gte', 95::numeric, '< 90% tepat waktu', 'lt', 90::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'SIMRS / Absensi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('KFR-A2', 'A', 'KFR', 'Dokter Spesialis', 'Menghadiri rapat KSM & pertemuan audit klinis/mutu RS', '%', 'percent', '≥ 80%', 'gte', 80::numeric, 'Di bawah target (Ya/Tidak)', 'lt', 80::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Notulen & Absensi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('KFR-A3', 'A', 'KFR', 'Dokter Spesialis', 'Tidak ada keluhan tertulis dari pasien atau keluarga', 'kasus', 'count', '0 Keluhan', 'zero', 0::numeric, '≥ 1 komplain', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Customer Service / KSM', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('KFR-A4', 'A', 'KFR', 'Dokter Spesialis', 'Koordinasi dan kolaborasi tim yang efektif dengan para Terapis', 'kategori', 'grade', 'Skor Baik', 'category', null::numeric, 'Ada laporan konflik', 'not_pass', null::numeric, array['Baik', 'Cukup', 'Kurang']::text[], array['Baik']::text[], array['Cukup']::text[], false, 'Evaluasi Tim / Angket', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('KFR-A5', 'A', 'KFR', 'Dokter Spesialis', 'Kepatuhan terhadap Kode Etik Kedokteran & Aturan Internal RS', 'kasus', 'count', '0 Pelanggaran', 'zero', 0::numeric, '≥ 1 kasus', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite Medik', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('KFR-B1', 'B', 'KFR', 'Dokter Spesialis', 'Pemenuhan poin SKP tahunan (Kemenkes/IDI/Perdosri)', 'SKP', 'skp', 'Sesuai target', 'gte', null::numeric, '< Target', 'lt_target', null::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Logbook / LMS', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx — Target SKP "Sesuai target" — isi nilai target SKP pada master indikator atau per evaluasi.'),
  ('KFR-B2', 'B', 'KFR', 'Dokter Spesialis', 'Mengikuti Pelatihan Mutu, PPI, & Keselamatan Pasien RS', 'kategori', 'pass', '100% lulus', 'category', null::numeric, 'Belum lulus', 'not_pass', null::numeric, array['Lulus', 'Belum']::text[], array['Lulus']::text[], '{}'::text[], false, 'Bagian Diklat', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('KFR-B3', 'B', 'KFR', 'Dokter Spesialis', 'Partisipasi dalam edukasi publik / edukasi pasien kelompok', 'kali', 'count', 'Min. 1x / tahun', 'min', 1::numeric, '0 Kali', 'lt', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'PKRS /sertifikat', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('KFR-C1', 'C', 'KFR', 'Dokter Spesialis', 'Kelengkapan Asesmen Fungsi & Penulisan Protokol Terapi KFR', '%', 'percent', '100%', 'pct100', 100::numeric, '< 95% lengkap', 'lt', 95::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Audit Rekam Medis', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('KFR-C2', 'C', 'KFR', 'Dokter Spesialis', 'Ketepatan evaluasi berkala capaian terapi pasien (Re-evaluasi)', '%', 'percent', '100%', 'pct100', 100::numeric, '< 95%', 'lt', 95::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Audit Rekam Medis', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('KFR-C3', 'C', 'KFR', 'Dokter Spesialis', 'Kepatuhan penulisan resep obat / modalitas sesuai Formularium', '%', 'percent', '≥ 95%', 'gte', 95::numeric, '< 90%', 'lt', 90::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Komite Farmasi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('KFR-C4', 'C', 'KFR', 'Dokter Spesialis', 'Kejadian pasien jatuh di area pelayanan Rehabilitasi Medik', 'kasus', 'count', '0 Kasus', 'zero', 0::numeric, '≥ 1 insiden', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite Mutu / Audit', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('KFR-C5', 'C', 'KFR', 'Dokter Spesialis', 'Efektivitas program (pencapaian target fungsional/skor kemandirian pasien, misal Barthel Index)', '%', 'percent', '≥ 80% pasien mencapai target', 'gte', 80::numeric, '< 75% pasien mencapai target', 'lt', 75::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Logbook Recovery Room', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('KFR-C6', 'C', 'KFR', 'Dokter Spesialis', 'Kepatuhan pelaksanaan penandaan area tindakan (misal: Injeksi Intra-artikular / Blok Saraf Perifer)', '%', 'percent', '100%', 'pct100', 100::numeric, '< 100%', 'lt', 100::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Laporan Komite Mutu KSM', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('MTA-A1', 'A', 'MTA', 'Dokter Spesialis', 'Kepatuhan jam pelayanan di Poliklinik Mata & Kamar Operasi', '%', 'percent', '≥ 95%', 'gte', 95::numeric, '< 90% tepat waktu', 'lt', 90::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'SIMRS / Absensi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('MTA-A2', 'A', 'MTA', 'Dokter Spesialis', 'Menghadiri rapat koordinasi KSM Mata & Audit Medik internal', '%', 'percent', '≥ 80%', 'gte', 80::numeric, 'Di bawah target (Ya/Tidak)', 'lt', 80::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Notulen & Absensi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('MTA-A3', 'A', 'MTA', 'Dokter Spesialis', 'Tidak ada keluhan tertulis dari pasien atau keluarga', 'kasus', 'count', '0 Keluhan', 'zero', 0::numeric, '≥ 1 komplain', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Customer Service / KSM', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('MTA-A4', 'A', 'MTA', 'Dokter Spesialis', 'Kerjasama dan koordinasi yang baik dengan perawat/refraksionis', 'kategori', 'grade', 'Skor Baik', 'category', null::numeric, 'Ada laporan konflik', 'not_pass', null::numeric, array['Baik', 'Cukup', 'Kurang']::text[], array['Baik']::text[], array['Cukup']::text[], false, 'Evaluasi Tim / Angket', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('MTA-A5', 'A', 'MTA', 'Dokter Spesialis', 'Kepatuhan terhadap Kode Etik Kedokteran & Aturan Internal RS', 'kasus', 'count', '0 Pelanggaran', 'zero', 0::numeric, '≥ 1 kasus', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite Medik', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('MTA-B1', 'B', 'MTA', 'Dokter Spesialis', 'Pemenuhan poin SKP tahunan (Kemenkes/IDI/Perdami)', 'SKP', 'skp', 'Sesuai target', 'gte', null::numeric, '< Target', 'lt_target', null::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Logbook / LMS', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx — Target SKP "Sesuai target" — isi nilai target SKP pada master indikator atau per evaluasi.'),
  ('MTA-B2', 'B', 'MTA', 'Dokter Spesialis', 'Mengikuti Pelatihan Mutu, PPI, & Keselamatan Pasien RS', 'kategori', 'pass', '100% lulus', 'category', null::numeric, 'Belum lulus', 'not_pass', null::numeric, array['Lulus', 'Belum']::text[], array['Lulus']::text[], '{}'::text[], false, 'Bagian Diklat', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('MTA-B3', 'B', 'MTA', 'Dokter Spesialis', 'Partisipasi aktif dalam kegiatan ilmiah/simposium oftamologi', 'kali', 'count', 'Min. 1x / tahun', 'min', 1::numeric, '0 Kali', 'lt', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Sertifikat', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('MTA-C1', 'C', 'MTA', 'Dokter Spesialis', 'Kepatuhan pengisian Surgical Safety Checklist pada operasi mata', '%', 'percent', '100%', 'pct100', 100::numeric, '< 100%', 'lt', 100::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Komite Mutu / OK', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('MTA-C2', 'C', 'MTA', 'Dokter Spesialis', 'Angka kejadian Infeksi Pasca-Operasi Katarak (Endoftalmitis)', 'kasus', 'count', '0%', 'zero', 0::numeric, '≥ 1 kasus', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite  PPI', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx — Realisasi diinput sebagai JUMLAH KASUS karena trigger Excel berbentuk "≥ 1 kasus/insiden" (kolom realisasi Excel bertanda %).'),
  ('MTA-C3', 'C', 'MTA', 'Dokter Spesialis', 'Kejadian Posterior Capsule Rupture (PCR) saat fakoemulsifikasi', '%', 'percent', '≤ 5%', 'lte', 5::numeric, '> 5%', 'gt', 5::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Laporan Operasi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('MTA-C4', 'C', 'MTA', 'Dokter Spesialis', 'Kelengkapan Rekam Medis (pemeriksaan tajam penglihatan/visus, tekanan intraokular/TIO, dlsb)', '%', 'percent', '100%', 'pct100', 100::numeric, '< 95% lengkap', 'lt', 95::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Audit Rekam Medis', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('MTA-C5', 'C', 'MTA', 'Dokter Spesialis', 'Ketepatan waktu Informed Consent tindakan laser/bedah minor', '%', 'percent', '100%', 'pct100', 100::numeric, '< 100%', 'lt', 100::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Audit Rekam Medis', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('MTA-C6', 'C', 'MTA', 'Dokter Spesialis', 'Angka tajam penglihatan pasca-operasi katarak mencapai ≥ 6/12 tanpa penyulit (pada mata tanpa komorbiditas)', '%', 'percent', '≥ 85% pasien', 'gte', 85::numeric, '< 80% pasien', 'lt', 80::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Audit Rekam Medis', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('THT-A1', 'A', 'THT', 'Dokter Spesialis', 'Kepatuhan jam pelayanan di Poliklinik THT & Kamar Operasi', '%', 'percent', '≥ 95%', 'gte', 95::numeric, '< 90% tepat waktu', 'lt', 90::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'SIMRS / Absensi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('THT-A2', 'A', 'THT', 'Dokter Spesialis', 'Menghadiri rapat bulanan KSM THT-BKL & Audit Medik', '%', 'percent', '≥ 80%', 'gte', 80::numeric, 'Di bawah target (Ya/Tidak)', 'lt', 80::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Notulen & Absensi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('THT-A3', 'A', 'THT', 'Dokter Spesialis', 'Tidak ada keluhan tertulis dari pasien/keluarga pasien', 'kasus', 'count', '0 Keluhan', 'zero', 0::numeric, '≥ 1 komplain', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Customer Service / KSM', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('THT-A4', 'A', 'THT', 'Dokter Spesialis', 'Komunikasi efektif antar-profesi dengan perawat/audiologis', 'kategori', 'grade', 'Skor Baik', 'category', null::numeric, 'Ada laporan konflik', 'not_pass', null::numeric, array['Baik', 'Cukup', 'Kurang']::text[], array['Baik']::text[], array['Cukup']::text[], false, 'Evaluasi Tim / Angket', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('THT-A5', 'A', 'THT', 'Dokter Spesialis', 'Kepatuhan terhadap Kode Etik Kedokteran & Aturan Internal RS', 'kasus', 'count', '0 Pelanggaran', 'zero', 0::numeric, '≥ 1 kasus', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite Medik', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('THT-B1', 'B', 'THT', 'Dokter Spesialis', 'Pemenuhan poin SKP tahunan (Kemenkes/IDI/Perhati-KL)', 'SKP', 'skp', 'Sesuai target', 'gte', null::numeric, '< Target', 'lt_target', null::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Logbook / LMS', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx — Target SKP "Sesuai target" — isi nilai target SKP pada master indikator atau per evaluasi.'),
  ('THT-B2', 'B', 'THT', 'Dokter Spesialis', 'Mengikuti Pelatihan Mutu, PPI, & Keselamatan Pasien RS', 'kategori', 'pass', '100% lulus', 'category', null::numeric, 'Belum lulus', 'not_pass', null::numeric, array['Lulus', 'Belum']::text[], array['Lulus']::text[], '{}'::text[], false, 'Bagian Diklat', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('THT-B3', 'B', 'THT', 'Dokter Spesialis', 'Partisipasi aktif dalam kegiatan ilmiah/workshop THT-BKL', 'kali', 'count', 'Min. 1x / tahun', 'min', 1::numeric, '0 Kali', 'lt', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Sertifikat', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('THT-C1', 'C', 'THT', 'Dokter Spesialis', 'Kepatuhan pengisian Surgical Safety Checklist pada operasi THT', '%', 'percent', '100%', 'pct100', 100::numeric, '< 100%', 'lt', 100::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Komite Mutu / OK', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('THT-C2', 'C', 'THT', 'Dokter Spesialis', 'Kejadian perdarahan pasca-operasi tonsilektomi yang membutuhkan intervensi atau re-operasi < 24 jam', 'kasus', 'count', '0%', 'zero', 0::numeric, '≥ 1 kasus', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite  PPI', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx — Realisasi diinput sebagai JUMLAH KASUS karena trigger Excel berbentuk "≥ 1 kasus/insiden" (kolom realisasi Excel bertanda %).'),
  ('THT-C3', 'C', 'THT', 'Dokter Spesialis', 'Kejadian cedera struktur sekitar (misal: kebocoran LCS/liquor, trauma orbita) saat operasi endoskopi sinus fungsional (FESS)', 'kasus', 'count', '0 Kasus', 'zero', 0::numeric, '≥ 1 kasus', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Rekam Medis / Komite Mutu', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx — Realisasi diinput sebagai JUMLAH KASUS karena trigger Excel berbentuk "≥ 1 kasus/insiden" (kolom realisasi Excel bertanda %).'),
  ('THT-C4', 'C', 'THT', 'Dokter Spesialis', 'Kelengkapan Rekam Medis (termasuk draf gambar anatomi/lokasi lesi hasil pemeriksaan otoskopi/laringoskopi)', '%', 'percent', '100%', 'pct100', 100::numeric, '< 95% lengkap', 'lt', 95::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Audit Rekam Medis', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('THT-C5', 'C', 'THT', 'Dokter Spesialis', 'Ketepatan waktu serah terima pasien pasca-operasi dengan modifikasi Steward Score atau Aldrete Score di RR', '%', 'percent', '100%', 'pct100', 100::numeric, '< 95%', 'lt', 95::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Logbook Recovery Room', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('THT-C6', 'C', 'THT', 'Dokter Spesialis', 'Kepatuhan pelaksanaan penandaan area tindakan (Marking) untuk organ berpasangan (Telinga Kanan/Kiri, Sinus Dekstra/Sinistra)', '%', 'percent', '100%', 'pct100', 100::numeric, '< 100%', 'lt', 100::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Komite Mutu', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('DRG-A1', 'A', 'GGM', 'Dokter Gigi', 'Kepatuhan jam pelayanan di Poliklinik Gigi & Mulut', '%', 'percent', '≥ 95%', 'gte', 95::numeric, '< 90% tepat waktu', 'lt', 90::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'SIMRS / Absensi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('DRG-A2', 'A', 'GGM', 'Dokter Gigi', 'Menghadiri rapat koordinasi / pertemuan klinis KSM Gigi', '%', 'percent', '≥ 80%', 'gte', 80::numeric, 'Di bawah target (Ya/Tidak)', 'lt', 80::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Notulen & Absensi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('DRG-A3', 'A', 'GGM', 'Dokter Gigi', 'Tidak ada keluhan tertulis dari pasien/keluarga pasien', 'kasus', 'count', '0 Keluhan', 'zero', 0::numeric, '≥ 1 komplain', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Customer Service / KSM', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('DRG-A4', 'A', 'GGM', 'Dokter Gigi', 'Kerjasama tim & koordinasi yang baik dengan Perawat Gigi', 'kategori', 'grade', 'Skor Baik', 'category', null::numeric, 'Ada laporan konflik', 'not_pass', null::numeric, array['Baik', 'Cukup', 'Kurang']::text[], array['Baik']::text[], array['Cukup']::text[], false, 'Evaluasi Tim / Angket', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('DRG-A5', 'A', 'GGM', 'Dokter Gigi', 'Kepatuhan terhadap Kode Etik Kedokteran & Aturan Internal RS', 'kasus', 'count', '0 Pelanggaran', 'zero', 0::numeric, '≥ 1 kasus', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite Medik', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('DRG-B1', 'B', 'GGM', 'Dokter Gigi', 'Pemenuhan poin SKP tahunan (Kemenkes/PDGI)', 'SKP', 'skp', 'Sesuai target', 'gte', null::numeric, '< Target', 'lt_target', null::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Logbook / LMS', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx — Target SKP "Sesuai target" — isi nilai target SKP pada master indikator atau per evaluasi.'),
  ('DRG-B2', 'B', 'GGM', 'Dokter Gigi', 'Mengikuti Pelatihan Mutu, PPI, & Keselamatan Pasien RS', 'kategori', 'pass', '100% lulus', 'category', null::numeric, 'Belum lulus', 'not_pass', null::numeric, array['Lulus', 'Belum']::text[], array['Lulus']::text[], '{}'::text[], false, 'Bagian Diklat', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('DRG-B3', 'B', 'GGM', 'Dokter Gigi', 'Partisipasi dalam edukasi kesehatan gigi mulut masyarakat', 'kali', 'count', 'Min. 1x / tahun', 'min', 1::numeric, '0 Kali', 'lt', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Sertifikat', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('DRG-C1', 'C', 'GGM', 'Dokter Gigi', 'Kelengkapan pengisian data Odontogram pada Rekam Medis pasien baru', '%', 'percent', '100%', 'pct100', 100::numeric, '< 100%', 'lt', 100::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Komite Mutu / OK', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('DRG-C2', 'C', 'GGM', 'Dokter Gigi', 'Kepatuhan pelaksanaan Informed Consent tertulis sebelum tindakan invasif (ekstraksi, insisi, bedah minor gigi)', '%', 'percent', '100%', 'pct100', 100::numeric, '< 100%', 'lt', 100::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Audit Rekam Medis', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('DRG-C3', 'C', 'GGM', 'Dokter Gigi', 'Kejadian komplikasi pasca-ekstraksi gigi berat (pendarahan masif tak terkendali, dry socket, atau perforasi sinus)', 'kasus', 'count', '0 Kasus', 'zero', 0::numeric, '≥ 1 kasus', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite Mutu / KSM', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx — Realisasi diinput sebagai JUMLAH KASUS karena trigger Excel berbentuk "≥ 1 kasus/insiden" (kolom realisasi Excel bertanda %).'),
  ('DRG-C4', 'C', 'GGM', 'Dokter Gigi', 'Kepatuhan sterilisasi handpiece dan instrumen dental kritis di antara satu pasien ke pasien berikutnya', '%', 'percent', '100%', 'pct100', 100::numeric, '< 100%', 'lt', 100::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Tim PPI / Log book Poli Gigi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('DRG-C5', 'C', 'GGM', 'Dokter Gigi', 'Kepatuhan melakukan prosedur Time Out / penandaan sisi (Marking) untuk pencabutan gigi berpasangan/pembedahan', '%', 'percent', '100%', 'pct100', 100::numeric, '< 100%', 'lt', 100::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Komite Mutu', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('DRG-C6', 'C', 'GGM', 'Dokter Gigi', 'Angka kejadian jarum suntik/benda tajam dental tertinggal atau insiden tertusuk jarum (needle stick injury) pada staf/pasien', 'kasus', 'count', '0 Kasus', 'zero', 0::numeric, '≥ 1 insiden', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite Mutu & Komite PPI', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('LKT-A1', 'A', 'LKT', 'Dokter Umum', 'Kepatuhan jam pelayanan di Poliklinik Laktasi & Visite Ranap', '%', 'percent', '≥ 95%', 'gte', 95::numeric, '< 90% tepat waktu', 'lt', 90::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Absensi / SDM', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('LKT-A2', 'A', 'LKT', 'Dokter Umum', 'Menghadiri rapat koordinasi Tim PONEK / Perinatologi / KSM', '%', 'percent', '≥ 80%', 'gte', 80::numeric, 'Di bawah target (Ya/Tidak)', 'lt', 80::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Notulen & Absensi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('LKT-A3', 'A', 'LKT', 'Dokter Umum', 'Tidak ada keluhan tertulis dari pasien/ibu menyusui', 'kasus', 'count', '0 Keluhan', 'zero', 0::numeric, '≥ 1 komplain', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Customer Service', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('LKT-A4', 'A', 'LKT', 'Dokter Umum', 'Kerjasama tim & komunikasi empati antar-profesi dengan Bidan/Konselor ASI', 'kategori', 'grade', 'Skor Baik', 'category', null::numeric, 'Ada komplain spesialis', 'not_pass', null::numeric, array['Baik', 'Cukup', 'Kurang']::text[], array['Baik']::text[], array['Cukup']::text[], false, 'Rekam Medis / SIMRS', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('LKT-A5', 'A', 'LKT', 'Dokter Umum', 'Kepatuhan terhadap Kode Etik Kedokteran & Regulasi Internasional Pemasaran Susu Formula (WHO Code)', 'kasus', 'count', '0 Pelanggaran', 'zero', 0::numeric, '≥ 1 kasus', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite Medik / PONEK', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('LKT-B1', 'B', 'LKT', 'Dokter Umum', 'Pemenuhan poin SKP tahunan (Kemenkes/IDI) & sertifikasi ulang IBCLC jika ada', 'SKP', 'skp', 'Sesuai target', 'gte', null::numeric, '< Target', 'lt_target', null::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Logbook / LMS', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx — Target SKP "Sesuai target" — isi nilai target SKP pada master indikator atau per evaluasi.'),
  ('LKT-B2', 'B', 'LKT', 'Dokter Umum', 'Mengikuti Pelatihan Mutu, PPI, K3RS, serta penyegaran Konseling Laktasi Modul WHO', 'kategori', 'pass', '100% lulus', 'category', null::numeric, 'Belum lulus', 'not_pass', null::numeric, array['Lulus', 'Belum']::text[], array['Lulus']::text[], '{}'::text[], false, 'Bagian Diklat', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('LKT-B3', 'B', 'LKT', 'Dokter Umum', 'Partisipasi aktif dalam kegiatan edukasi/seminar menyusui bagi awam (Pekan ASI Sedunia, dll)', 'kali', 'count', 'Min. 1x / tahun', 'min', 1::numeric, '0 Kali', 'lt', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'PKRS / Sertifikat', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('LKT-C1', 'C', 'LKT', 'Dokter Umum', 'Kelengkapan pengisian dokumen Pengkajian Manajemen Laktasi (Asesmen posisi, perlekatan, & transfer ASI) pada Rekam Medis', '%', 'percent', '≥ 95%', 'gte', 95::numeric, '< 90%', 'lt', 90::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Audit Rekam Medis', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('LKT-C2', 'C', 'LKT', 'Dokter Umum', 'Angka keberhasilan konseling perlekatan (latch-on) efektif pada kunjungan pertama/kedua ibu dengan masalah menyusui', '%', 'percent', '≥ 85%', 'gte', 85::numeric, '< 75% keberhasilan', 'lt', 75::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Logbook / SIMRS', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('LKT-C3', 'C', 'LKT', 'Dokter Umum', 'Kepatuhan pengisian Informed Consent tertulis sebelum melakukan tindakan invasif (misal: Insisi abses payudara / Frenotomy)', '%', 'percent', '100%', 'pct100', 100::numeric, '< 100%', 'lt', 100::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Audit Rekam Medis', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('LKT-C4', 'C', 'LKT', 'Dokter Umum', 'Kejadian komplikasi berat pasca-tindakan klinik (misal: perdarahan masif pasca-frenotomy atau infeksi sekunder)', 'kasus', 'count', '0%', 'zero', 0::numeric, '≥ 1 kasus', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Audit Klinis IGD', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx — Realisasi diinput sebagai JUMLAH KASUS karena trigger Excel berbentuk "≥ 1 kasus/insiden" (kolom realisasi Excel bertanda %).'),
  ('LKT-C5', 'C', 'LKT', 'Dokter Umum', 'Angka ketepatan edukasi penggunaan obat aman bagi ibu menyusui (Kepatuhan terhadap kategori risiko laktasi/LactMed)', '%', 'percent', '100% tepat', 'pct100', 100::numeric, '< 100% ketepatan', 'lt', 100::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Audit Rekam Medis', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('LKT-C6', 'C', 'LKT', 'Dokter Umum', 'Angka keberhasilan relaktasi pada ibu yang sempat terhenti menyusui (dalam program monitoring klinik)', '%', 'percent', '≥ 70%', 'gte', 70::numeric, '< 60% keberhasilan', 'lt', 60::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Data Mutu Klinik ASI', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('PK-A1', 'A', 'PK', 'Dokter Spesialis', 'Kepatuhan jam kehadiran dan pengawasan berkala di Laboratorium', '%', 'percent', '≥ 95%', 'gte', 95::numeric, '< 90% tepat waktu', 'lt', 90::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'SIMRS / Absensi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('PK-A2', 'A', 'PK', 'Dokter Spesialis', 'Menghadiri rapat koordinasi internal penunjang & Audit Medik', '%', 'percent', '≥ 80%', 'gte', 80::numeric, 'Di bawah target (Ya/Tidak)', 'lt', 80::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Notulen & Absensi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('PK-A3', 'A', 'PK', 'Dokter Spesialis', 'Tidak ada keluhan tertulis dari sejawat klinisi terkait konsultasi ekspertisi hasil', 'kasus', 'count', '0 Keluhan', 'zero', 0::numeric, '≥ 1 komplain', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Customer Service / KSM', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('PK-A4', 'A', 'PK', 'Dokter Spesialis', 'Kerjasama dan koordinasi yang baik dengan Analis Kesehatan (ATLM)', 'kategori', 'grade', 'Skor Baik', 'category', null::numeric, 'Ada laporan konflik', 'not_pass', null::numeric, array['Baik', 'Cukup', 'Kurang']::text[], array['Baik']::text[], array['Cukup']::text[], false, 'Evaluasi Tim / Angket', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('PK-A5', 'A', 'PK', 'Dokter Spesialis', 'Kepatuhan terhadap Kode Etik Kedokteran & Aturan Internal RS', 'kasus', 'count', '0 Pelanggaran', 'zero', 0::numeric, '≥ 1 kasus', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite Medik', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('PK-B1', 'B', 'PK', 'Dokter Spesialis', 'Pemenuhan poin SKP tahunan (Kemenkes/IDI/PDS PatKLin)', 'SKP', 'skp', 'Sesuai target', 'gte', null::numeric, '< Target', 'lt_target', null::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Logbook / LMS', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx — Target SKP "Sesuai target" — isi nilai target SKP pada master indikator atau per evaluasi.'),
  ('PK-B2', 'B', 'PK', 'Dokter Spesialis', 'Mengikuti Pelatihan Mutu, K3 Laboratorium (Biosafety), & PPI', 'kategori', 'pass', '100% lulus', 'category', null::numeric, 'Belum lulus', 'not_pass', null::numeric, array['Lulus', 'Belum']::text[], array['Lulus']::text[], '{}'::text[], false, 'Bagian Diklat', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('PK-B3', 'B', 'PK', 'Dokter Spesialis', 'Partisipasi aktif dalam evaluasi Pemantauan Mutu Eksternal (PME)', 'kali', 'count', 'Min. 1x / tahun', 'min', 1::numeric, '0 Kali', 'lt', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Sertifikat', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('PK-C1', 'C', 'PK', 'Dokter Spesialis', 'Kecepatan pelaporan Nilai Kritis Laboratorium (Critical Value Reporting < 30 menit) ke unit pengirim', '%', 'percent', '100%', 'pct100', 100::numeric, '< 100%', 'lt', 100::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Komite Mutu / Indikator Mutu Lab', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('PK-C2', 'C', 'PK', 'Dokter Spesialis', 'Angka kesalahan identifikasi sampel atau kesalahan input hasil ekspertis (Medication/Diagnostic Error)', 'kasus', 'count', '0 Kasus', 'zero', 0::numeric, '≥ 1 insiden', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite Mutu / Indikator Mutu Lab', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('PK-C3', 'C', 'PK', 'Dokter Spesialis', 'Kelengkapan validasi dan otentikasi hasil laboratorium canggih atau hasil kritis oleh dokter Sp.PK', '%', 'percent', '100%', 'pct100', 100::numeric, '< 95%', 'lt', 95::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'LIS (Lab Info System)', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('PK-C4', 'C', 'PK', 'Dokter Spesialis', 'Kepatuhan pelaksanaan dan evaluasi harian Pemantauan Mutu Internal (PMI) untuk instrumen laboratorium utama', '%', 'percent', '100%', 'pct100', 100::numeric, '< 100%', 'lt', 100::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Logbook Kendali Mutu Lab', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('PK-C5', 'C', 'PK', 'Dokter Spesialis', 'Ketepatan waktu penyerahan hasil pemeriksaan cito (Turnaround Time / TAT sesuai standar RS, misal < 60 menit)', '%', 'percent', '≥ 90%', 'gte', 90::numeric, '< 85%', 'lt', 85::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'LIS / SIMRS', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('PK-C6', 'C', 'PK', 'Dokter Spesialis', 'Angka kejadian kecelakaan kerja (seperti paparan bahan biologis berbahaya/tumpahan spesimen) akibat kelalaian protokol', 'kasus', 'count', '0 Kasus', 'zero', 0::numeric, '≥ 1 insiden', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite K3RS / PPI', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('RAD-A1', 'A', 'RAD', 'Dokter Spesialis', 'Kepatuhan jam kehadiran dan pengawasan mutu di Instalasi Radiologi', '%', 'percent', '≥ 95%', 'gte', 95::numeric, '< 90% tepat waktu', 'lt', 90::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'SIMRS / Absensi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('RAD-A2', 'A', 'RAD', 'Dokter Spesialis', 'Menghadiri rapat koordinasi bulanan KSM & pertemuan klinis/audit', '%', 'percent', '≥ 80%', 'gte', 80::numeric, 'Di bawah target (Ya/Tidak)', 'lt', 80::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Notulen & Absensi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('RAD-A3', 'A', 'RAD', 'Dokter Spesialis', 'Tidak ada keluhan tertulis dari sejawat klinisi terkait konsultasi bacaan', 'kasus', 'count', '0 Keluhan', 'zero', 0::numeric, '≥ 1 komplain', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Customer Service / KSM', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('RAD-A4', 'A', 'RAD', 'Dokter Spesialis', 'Kerjasama dan koordinasi yang baik dengan Radiografer & Fisikawan Medis', 'kategori', 'grade', 'Skor Baik', 'category', null::numeric, 'Ada laporan konflik', 'not_pass', null::numeric, array['Baik', 'Cukup', 'Kurang']::text[], array['Baik']::text[], array['Cukup']::text[], false, 'Evaluasi Tim / Angket', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('RAD-A5', 'A', 'RAD', 'Dokter Spesialis', 'Kepatuhan terhadap Kode Etik Kedokteran & Aturan Keselamatan Radiasi', 'kasus', 'count', '0 Pelanggaran', 'zero', 0::numeric, '≥ 1 kasus', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite Medik / BAPETEN', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('RAD-B1', 'B', 'RAD', 'Dokter Spesialis', 'Pemenuhan poin SKP tahunan (Kemenkes/IDI/PDSRI)', 'SKP', 'skp', 'Sesuai target', 'gte', null::numeric, '< Target', 'lt_target', null::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Logbook / LMS', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx — Target SKP "Sesuai target" — isi nilai target SKP pada master indikator atau per evaluasi.'),
  ('RAD-B2', 'B', 'RAD', 'Dokter Spesialis', 'Mengikuti Pelatihan Proteksi Radiasi (PPR), K3RS, Mutu, & PPI )', 'kategori', 'pass', '100% lulus', 'category', null::numeric, 'Belum lulus', 'not_pass', null::numeric, array['Lulus', 'Belum']::text[], array['Lulus']::text[], '{}'::text[], false, 'Bagian Diklat', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('RAD-B3', 'B', 'RAD', 'Dokter Spesialis', 'Partisipasi aktif dalam kegiatan ilmiah/workshop radiologi mutakhir', 'kali', 'count', 'Min. 1x / tahun', 'min', 1::numeric, '0 Kali', 'lt', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Sertifikat', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('RAD-C1', 'C', 'RAD', 'Dokter Spesialis', 'Kecepatan pelaporan Temuan Kritis Radiologi (Critical Findings < 60 menit, misal: stroke perdarahan, pneumotoraks) ke klinisi', '%', 'percent', '100%', 'pct100', 100::numeric, '< 100%', 'lt', 100::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Komite Mutu / Indikator Mutu Radiologi', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('RAD-C2', 'C', 'RAD', 'Dokter Spesialis', 'Angka ketepatan waktu penyerahan hasil (Turnaround Time / TAT) ekspertis foto polos reguler rawat jalan (sesuai standar RS, misal < 3 jam)', '%', 'percent', '≥ 90%', 'gte', 90::numeric, '< 85%', 'lt', 85::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'RIS (Radiology Info System)', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('RAD-C3', 'C', 'RAD', 'Dokter Spesialis', 'Angka diskordansi/perbedaan interpretasi hasil radiologi antara Sp.Rad pada proses audit klinis (koreksi pembacaan ulang)', '%', 'percent', '≤ 5%', 'lte', 5::numeric, '> 5% diskordansi', 'gt', 5::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Audit Medis KSM', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('RAD-C4', 'C', 'RAD', 'Dokter Spesialis', 'Kepatuhan pelaksanaan skrining keselamatan sebelum pemeriksaan kontras (Alergi kontras, fungsi ginjal/eGFR, implant logam)', '%', 'percent', '100%', 'pct100', 100::numeric, '< 100%', 'lt', 100::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Rekam Medis / RIS', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('RAD-C5', 'C', 'RAD', 'Dokter Spesialis', 'Kejadian efek samping berat akibat media kontras (extravasation berat / syok anafilaktik) yang tidak tertangani sesuai protokol', 'kasus', 'count', '0 Kasus', 'zero', 0::numeric, '≥ 1 insiden', 'gte', 1::numeric, '{}'::text[], '{}'::text[], '{}'::text[], true, 'Komite Mutu', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx'),
  ('RAD-C6', 'C', 'RAD', 'Dokter Spesialis', 'Kepatuhan melakukan prosedur Time Out / penandaan sisi (Marking) untuk tindakan radiologi intervensional unilateral', '%', 'percent', '100% (Excel: 0 Kasus)', 'pct100', 100::numeric, '< 100%', 'lt', 100::numeric, '{}'::text[], '{}'::text[], '{}'::text[], false, 'Komite Mutu', 'Sumber: OPPE BARU By dr.Sri RSASM.xlsx — Di Excel target tertulis "0 Kasus" namun indikator berupa kepatuhan (%) dengan trigger "< 100%"; disimpan sebagai target 100%. Teks target asli tetap ditampilkan.')
) as v(code, cat, ksm_code, profession, name, unit_label, data_type, target_text, target_operator, target_value,
       trigger_text, trigger_operator, trigger_value, options, pass_values, attention_values, is_critical, source_data, reference_note)
join public.oppe_indicator_categories c on c.code = v.cat
left join public.oppe_ksm k on k.code = v.ksm_code
on conflict (code) do nothing;

-- 15.d Relasi template -> indikator (urutan sesuai Excel)
insert into public.oppe_template_indicators (template_id, indicator_id, sequence)
select t.id, i.id, v.seq from (values
  ('UMUM', 'UMUM-A1', 1),
  ('UMUM', 'UMUM-A2', 2),
  ('UMUM', 'UMUM-A3', 3),
  ('UMUM', 'UMUM-A4', 4),
  ('UMUM', 'UMUM-A5', 5),
  ('UMUM', 'UMUM-B1', 6),
  ('UMUM', 'UMUM-B2', 7),
  ('UMUM', 'UMUM-B3', 8),
  ('UMUM', 'UMUM-C1', 9),
  ('UMUM', 'UMUM-C2', 10),
  ('UMUM', 'UMUM-C3', 11),
  ('UMUM', 'UMUM-C4', 12),
  ('UMUM', 'UMUM-C5', 13),
  ('UMUM', 'UMUM-C6', 14),
  ('NBDH', 'NBDH-A1', 1),
  ('NBDH', 'NBDH-A2', 2),
  ('NBDH', 'NBDH-A3', 3),
  ('NBDH', 'NBDH-A4', 4),
  ('NBDH', 'NBDH-A5', 5),
  ('NBDH', 'NBDH-B1', 6),
  ('NBDH', 'NBDH-B2', 7),
  ('NBDH', 'NBDH-B3', 8),
  ('NBDH', 'NBDH-C1', 9),
  ('NBDH', 'NBDH-C2', 10),
  ('NBDH', 'NBDH-C3', 11),
  ('NBDH', 'NBDH-C4', 12),
  ('NBDH', 'NBDH-C5', 13),
  ('NBDH', 'NBDH-C6', 14),
  ('BDH', 'BDH-A1', 1),
  ('BDH', 'BDH-A2', 2),
  ('BDH', 'BDH-A3', 3),
  ('BDH', 'BDH-A4', 4),
  ('BDH', 'BDH-A5', 5),
  ('BDH', 'BDH-B1', 6),
  ('BDH', 'BDH-B2', 7),
  ('BDH', 'BDH-B3', 8),
  ('BDH', 'BDH-C1', 9),
  ('BDH', 'BDH-C2', 10),
  ('BDH', 'BDH-C3', 11),
  ('BDH', 'BDH-C4', 12),
  ('BDH', 'BDH-C5', 13),
  ('BDH', 'BDH-C6', 14),
  ('OBG', 'OBG-A1', 1),
  ('OBG', 'OBG-A2', 2),
  ('OBG', 'OBG-A3', 3),
  ('OBG', 'OBG-A4', 4),
  ('OBG', 'OBG-A5', 5),
  ('OBG', 'OBG-B1', 6),
  ('OBG', 'OBG-B2', 7),
  ('OBG', 'OBG-B3', 8),
  ('OBG', 'OBG-C1', 9),
  ('OBG', 'OBG-C2', 10),
  ('OBG', 'OBG-C3', 11),
  ('OBG', 'OBG-C4', 12),
  ('OBG', 'OBG-C5', 13),
  ('OBG', 'OBG-C6', 14),
  ('ANS', 'ANS-A1', 1),
  ('ANS', 'ANS-A2', 2),
  ('ANS', 'ANS-A3', 3),
  ('ANS', 'ANS-A4', 4),
  ('ANS', 'ANS-A5', 5),
  ('ANS', 'ANS-B1', 6),
  ('ANS', 'ANS-B2', 7),
  ('ANS', 'ANS-B3', 8),
  ('ANS', 'ANS-C1', 9),
  ('ANS', 'ANS-C2', 10),
  ('ANS', 'ANS-C3', 11),
  ('ANS', 'ANS-C4', 12),
  ('ANS', 'ANS-C5', 13),
  ('ANS', 'ANS-C6', 14),
  ('KFR', 'KFR-A1', 1),
  ('KFR', 'KFR-A2', 2),
  ('KFR', 'KFR-A3', 3),
  ('KFR', 'KFR-A4', 4),
  ('KFR', 'KFR-A5', 5),
  ('KFR', 'KFR-B1', 6),
  ('KFR', 'KFR-B2', 7),
  ('KFR', 'KFR-B3', 8),
  ('KFR', 'KFR-C1', 9),
  ('KFR', 'KFR-C2', 10),
  ('KFR', 'KFR-C3', 11),
  ('KFR', 'KFR-C4', 12),
  ('KFR', 'KFR-C5', 13),
  ('KFR', 'KFR-C6', 14),
  ('MTA', 'MTA-A1', 1),
  ('MTA', 'MTA-A2', 2),
  ('MTA', 'MTA-A3', 3),
  ('MTA', 'MTA-A4', 4),
  ('MTA', 'MTA-A5', 5),
  ('MTA', 'MTA-B1', 6),
  ('MTA', 'MTA-B2', 7),
  ('MTA', 'MTA-B3', 8),
  ('MTA', 'MTA-C1', 9),
  ('MTA', 'MTA-C2', 10),
  ('MTA', 'MTA-C3', 11),
  ('MTA', 'MTA-C4', 12),
  ('MTA', 'MTA-C5', 13),
  ('MTA', 'MTA-C6', 14),
  ('THT', 'THT-A1', 1),
  ('THT', 'THT-A2', 2),
  ('THT', 'THT-A3', 3),
  ('THT', 'THT-A4', 4),
  ('THT', 'THT-A5', 5),
  ('THT', 'THT-B1', 6),
  ('THT', 'THT-B2', 7),
  ('THT', 'THT-B3', 8),
  ('THT', 'THT-C1', 9),
  ('THT', 'THT-C2', 10),
  ('THT', 'THT-C3', 11),
  ('THT', 'THT-C4', 12),
  ('THT', 'THT-C5', 13),
  ('THT', 'THT-C6', 14),
  ('DRG', 'DRG-A1', 1),
  ('DRG', 'DRG-A2', 2),
  ('DRG', 'DRG-A3', 3),
  ('DRG', 'DRG-A4', 4),
  ('DRG', 'DRG-A5', 5),
  ('DRG', 'DRG-B1', 6),
  ('DRG', 'DRG-B2', 7),
  ('DRG', 'DRG-B3', 8),
  ('DRG', 'DRG-C1', 9),
  ('DRG', 'DRG-C2', 10),
  ('DRG', 'DRG-C3', 11),
  ('DRG', 'DRG-C4', 12),
  ('DRG', 'DRG-C5', 13),
  ('DRG', 'DRG-C6', 14),
  ('LKT', 'LKT-A1', 1),
  ('LKT', 'LKT-A2', 2),
  ('LKT', 'LKT-A3', 3),
  ('LKT', 'LKT-A4', 4),
  ('LKT', 'LKT-A5', 5),
  ('LKT', 'LKT-B1', 6),
  ('LKT', 'LKT-B2', 7),
  ('LKT', 'LKT-B3', 8),
  ('LKT', 'LKT-C1', 9),
  ('LKT', 'LKT-C2', 10),
  ('LKT', 'LKT-C3', 11),
  ('LKT', 'LKT-C4', 12),
  ('LKT', 'LKT-C5', 13),
  ('LKT', 'LKT-C6', 14),
  ('PK', 'PK-A1', 1),
  ('PK', 'PK-A2', 2),
  ('PK', 'PK-A3', 3),
  ('PK', 'PK-A4', 4),
  ('PK', 'PK-A5', 5),
  ('PK', 'PK-B1', 6),
  ('PK', 'PK-B2', 7),
  ('PK', 'PK-B3', 8),
  ('PK', 'PK-C1', 9),
  ('PK', 'PK-C2', 10),
  ('PK', 'PK-C3', 11),
  ('PK', 'PK-C4', 12),
  ('PK', 'PK-C5', 13),
  ('PK', 'PK-C6', 14),
  ('RAD', 'RAD-A1', 1),
  ('RAD', 'RAD-A2', 2),
  ('RAD', 'RAD-A3', 3),
  ('RAD', 'RAD-A4', 4),
  ('RAD', 'RAD-A5', 5),
  ('RAD', 'RAD-B1', 6),
  ('RAD', 'RAD-B2', 7),
  ('RAD', 'RAD-B3', 8),
  ('RAD', 'RAD-C1', 9),
  ('RAD', 'RAD-C2', 10),
  ('RAD', 'RAD-C3', 11),
  ('RAD', 'RAD-C4', 12),
  ('RAD', 'RAD-C5', 13),
  ('RAD', 'RAD-C6', 14)
) as v(tcode, icode, seq)
join public.oppe_templates t on t.code = v.tcode
join public.oppe_indicators i on i.code = v.icode
on conflict (template_id, indicator_id) do nothing;

-- ============================================================================
-- SELESAI. Langkah berikut: assign peran, mis.
--   update public.profiles set oppe_roles = array['komite_medik'] where email = 'komite.medik@rs.id';
--   update public.profiles set oppe_roles = array['evaluator']    where email = 'ketua.ksm@rs.id';
--   update public.profiles set oppe_roles = array['dokter']       where email = 'dokter@rs.id';
--   lalu hubungkan akun dokter: update public.oppe_doctors set user_id = (select id from auth.users where email = ...) where ...;
-- Data demo (opsional, BUKAN untuk produksi): supabase/seed_oppe_demo.sql
-- ============================================================================
