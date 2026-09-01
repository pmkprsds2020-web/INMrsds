-- ============================================================================
-- INMrsds — Modul Master Indikator Mutu Custom
-- Migration tambahan, dijalankan SETELAH supabase/migration.sql (independen
-- dari migration_ikp.sql/migration_risk.sql/migration_budaya.sql/
-- migration_usulan_indikator.sql). Aman dijalankan berulang.
--
-- TIDAK mengubah: indicator_entries, IndicatorType (11 indikator legacy),
-- IndicatorPanel.tsx, atau union type apa pun di src/types/index.ts.
-- Indikator custom hidup di tabel/arsitektur SENDIRI (bagian 50 dokumen
-- acuan) dan disatukan ke dashboard lewat adapter di lapisan aplikasi
-- (src/lib/indicatorDefinitionAdapter.ts), bukan lewat migrasi skema.
--
-- Arsitektur: custom_indicators -> custom_indicator_versions (1:N, histori
-- definisi/target per periode) -> custom_indicator_fields (field pengukuran
-- dinamis per versi) & custom_indicator_measurements (data hasil, snapshot
-- nilai target & status capaian supaya tidak berubah retroaktif kalau master
-- diedit — bagian 20). custom_indicator_units mengatur unit mana yang pakai
-- indikator ini, memakai KODE UNIT YANG SAMA dengan UNIT_MAP existing
-- (IGD/Rawat Jalan/Rawat Inap/ICU/Kamar Operasi/VK/Laboratorium/Radiologi/
-- Farmasi/all) — bukan tabel unit baru — karena dokumen acuan sendiri
-- memakai daftar unit itu sebagai contoh checkbox penetapan unit (bagian 4),
-- dan ini menjaga modul tetap terintegrasi dengan struktur unit existing.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 0. PERLUASAN ADDITIVE PADA TABEL EXISTING
-- ============================================================================

-- Peran tambahan khusus modul ini, terpisah dari role/ikp_roles/risk_roles/
-- budaya_roles/uimu_roles. Nilai: 'komite_mutu' (kelola master indikator,
-- versi, kategori), 'manajemen' (approval indikator Prioritas RS).
-- 'admin' (role existing) otomatis punya semua hak. Kepala Unit/staff TIDAK
-- perlu role baru untuk INPUT DATA — cukup unit_id mereka match salah satu
-- unit yang di-assign ke indikator (sama seperti pola indicator_entries
-- existing yang readable oleh siapa saja & writable oleh pembuatnya).
alter table public.profiles
  add column if not exists custom_indicator_roles text[] not null default '{}'::text[];

comment on column public.profiles.custom_indicator_roles is
  'Peran tambahan khusus modul Master Indikator Mutu Custom: komite_mutu, manajemen.';

alter table public.audit_logs drop constraint if exists audit_logs_type_check;
alter table public.audit_logs add constraint audit_logs_type_check
  check (type in ('block', 'login', 'input', 'mapping', 'ikp', 'risk', 'budaya', 'uimu', 'custom_indicator'));

-- ============================================================================
-- 1. KATEGORI (dapat ditambah admin/komite_mutu — bagian 3)
-- ============================================================================
create table if not exists public.custom_indicator_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

comment on table public.custom_indicator_categories is
  'Daftar kategori indikator yang bisa ditambah admin/komite_mutu. Kategori default (Keselamatan Pasien, Klinis, dst.) disuplai sebagai konstanta TS di src/types/customIndicators.ts dan di-seed di sini agar keduanya konsisten.';

insert into public.custom_indicator_categories (name) values
  ('Keselamatan Pasien'), ('Klinis'), ('Manajerial'), ('Pelayanan'), ('Efisiensi'),
  ('SDM'), ('Farmasi'), ('Laboratorium'), ('K3'), ('PPI'), ('Kepuasan'), ('Dokumentasi'), ('Lainnya')
on conflict (name) do nothing;

-- ============================================================================
-- 2. TABEL UTAMA: custom_indicators (identitas — bagian 3, 11, 43, 44, 45)
-- ============================================================================
create table if not exists public.custom_indicators (
  id                          uuid primary key default gen_random_uuid(),
  code                        text not null unique,
  name                        text not null,
  description                 text,
  purpose                     text,
  indicator_type              text not null check (indicator_type in ('unit', 'priority_rs')),
  category                    text not null default 'Lainnya',

  status                      text not null default 'draft' check (status in ('draft', 'active', 'inactive', 'archived')),

  is_all_units                boolean not null default false,
  is_comparable_across_units  boolean not null default false,

  pic_user_id                 uuid references auth.users (id) on delete set null,
  pic_name                    text,
  reviewer_name                text,
  approver_name                text,

  start_date                  date,
  end_date                    date,
  is_permanent                 boolean not null default true,

  -- ── Khusus indicator_type = 'priority_rs' (bagian 43) ─────────────────
  priority_number              int,
  priority_reason              text,
  priority_basis                text,   -- "dasar penetapan"
  priority_period               text,
  related_indicator_id           uuid references public.custom_indicators (id) on delete set null,  -- bagian 44

  -- ── Lifecycle (bagian 11, 12, 13, 14, 15) ─────────────────────────────
  deactivated_at                timestamptz,
  deactivated_by                uuid references auth.users (id) on delete set null,
  deactivation_reason            text check (deactivation_reason is null or deactivation_reason in (
                                 'target_tercapai_konsisten', 'bukan_prioritas', 'perubahan_kebijakan',
                                 'perubahan_sop', 'digantikan_indikator_lain', 'tidak_relevan', 'perubahan_unit', 'lainnya'
                               )),
  deactivation_note              text,

  created_by                   uuid references auth.users (id) on delete set null,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

comment on table public.custom_indicators is
  'Identitas indikator mutu custom (RS-defined). Definisi operasional/target/formula ADA DI custom_indicator_versions, bukan di sini, supaya perubahan definisi tidak destruktif terhadap data historis (bagian 16).';

-- ============================================================================
-- 3. VERSIONING (bagian 16) — definisi operasional, formula, target per periode
-- ============================================================================
create table if not exists public.custom_indicator_versions (
  id                          uuid primary key default gen_random_uuid(),
  indicator_id                 uuid not null references public.custom_indicators (id) on delete cascade,
  version_number                int not null,
  effective_from                date not null default current_date,
  effective_to                 date,   -- null = versi berlaku saat ini

  operational_definition        text,
  numerator_label               text,
  denominator_label             text,
  inclusion_criteria            text,
  exclusion_criteria            text,
  source_of_data                text,
  collection_method             text,

  formula_type                 text not null default 'percentage' check (formula_type in (
                                 'percentage', 'rate', 'average', 'sum', 'count', 'ratio', 'custom'
                               )),
  formula_multiplier            numeric not null default 100,
  formula_expression            text,   -- catatan bebas untuk formula_type = 'custom' (evaluasi tetap manual/di aplikasi, tidak di-eval sebagai kode di DB)

  target_value                 numeric,
  target_operator               text check (target_operator is null or target_operator in ('gte', 'lte', 'eq', 'gt', 'lt')),
  target_direction              text check (target_direction is null or target_direction in ('higher_better', 'lower_better', 'exact')),

  unit_of_measure               text,
  unit_of_measure_custom         text,

  frequency                    text not null default 'bulanan' check (frequency in (
                                 'harian', 'mingguan', 'bulanan', 'triwulanan', 'semesteran', 'tahunan', 'custom'
                               )),
  frequency_custom              text,

  allow_multiple_per_period      boolean not null default false,   -- bagian 29
  allow_numerator_gt_denominator boolean not null default false,   -- bagian 28

  created_by                   uuid references auth.users (id) on delete set null,
  created_at                   timestamptz not null default now(),

  unique (indicator_id, version_number)
);

comment on table public.custom_indicator_versions is
  'Riwayat versi definisi/formula/target. Diisi PENUH setiap kali dibuat versi baru (bukan cuma delta) supaya query "versi berlaku pada tanggal X" sederhana. Baris lama TIDAK PERNAH diubah/dihapus (bagian 16, 38).';

-- ============================================================================
-- 4. FIELD PENGUKURAN DINAMIS per versi (bagian 18)
-- ============================================================================
create table if not exists public.custom_indicator_fields (
  id                     uuid primary key default gen_random_uuid(),
  indicator_version_id    uuid not null references public.custom_indicator_versions (id) on delete cascade,
  field_code             text not null,
  field_label            text not null,
  field_type             text not null check (field_type in ('number', 'decimal', 'text', 'date', 'select', 'boolean')),
  is_required             boolean not null default true,
  min_value               numeric,
  max_value               numeric,
  options                 text[],                -- untuk field_type = 'select'
  sort_order              int not null default 0,
  role_in_formula          text check (role_in_formula is null or role_in_formula in ('numerator', 'denominator', 'value')),

  unique (indicator_version_id, field_code)
);

comment on table public.custom_indicator_fields is
  'Field form input yang dikonfigurasi admin per versi indikator (bagian 18). role_in_formula menandai field mana yang dipakai calculation engine sebagai numerator/denominator/value (bagian 6, 19).';

-- ============================================================================
-- 5. PENETAPAN UNIT (bagian 4) — memakai kode unit yang sama dengan UNIT_MAP
--    existing (src/types/index.ts): IGD, Rawat Jalan, Rawat Inap, ICU,
--    Kamar Operasi, VK, Laboratorium, Radiologi, Farmasi, atau 'all'.
-- ============================================================================
create table if not exists public.custom_indicator_units (
  id             uuid primary key default gen_random_uuid(),
  indicator_id    uuid not null references public.custom_indicators (id) on delete cascade,
  unit_id        text not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),

  unique (indicator_id, unit_id)
);

comment on table public.custom_indicator_units is
  'Unit yang memakai indikator ini. unit_id memakai kode UnitId existing (IGD/Rawat Jalan/dst.) atau ''all'' bila is_all_units true di custom_indicators — tidak membuat master unit baru, sesuai bagian 40 dokumen acuan (integrasi ke struktur unit existing).';

-- ============================================================================
-- 6. DATA PENGUKURAN (bagian 19, 20)
-- ============================================================================
create table if not exists public.custom_indicator_measurements (
  id                    uuid primary key default gen_random_uuid(),
  indicator_id           uuid not null references public.custom_indicators (id) on delete restrict,
  indicator_version_id    uuid not null references public.custom_indicator_versions (id) on delete restrict,
  unit_id                text not null,
  measurement_date        date not null default current_date,
  period                 text not null,   -- kunci periode terformat aplikasi, mis. '2026-01', '2026-Q1', '2026-S1', '2026'
  observation_seq          int not null default 1,   -- bagian 29: >1 hanya kalau allow_multiple_per_period

  numerator               numeric,
  denominator              numeric,
  value                  numeric,          -- calculated_value (snapshot hasil formula)
  target_value             numeric,          -- SNAPSHOT target saat data disimpan (bagian 20 — tidak bergantung ke master yang bisa berubah)
  target_operator          text,             -- snapshot juga
  achievement_status        text check (achievement_status is null or achievement_status in ('tercapai', 'tidak_tercapai')),

  measurement_data         jsonb not null default '{}'::jsonb,  -- nilai field dinamis di luar numerator/denominator/value
  notes                   text,

  created_by               uuid references auth.users (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  unique (indicator_id, indicator_version_id, unit_id, period, observation_seq)
);

comment on table public.custom_indicator_measurements is
  'Data hasil pengukuran, generic untuk semua indikator custom. numerator/denominator/value/target_value/achievement_status disimpan sebagai SNAPSHOT saat input (bagian 20) — perubahan master/versi di kemudian hari tidak mengubah histori ini.';

-- ============================================================================
-- 7. INDEXES
-- ============================================================================
create index if not exists idx_custom_indicators_status on public.custom_indicators (status);
create index if not exists idx_custom_indicators_type on public.custom_indicators (indicator_type);
create index if not exists idx_custom_indicators_category on public.custom_indicators (category);
create index if not exists idx_custom_indicator_versions_indicator on public.custom_indicator_versions (indicator_id);
create index if not exists idx_custom_indicator_fields_version on public.custom_indicator_fields (indicator_version_id);
create index if not exists idx_custom_indicator_units_indicator on public.custom_indicator_units (indicator_id);
create index if not exists idx_custom_indicator_units_unit on public.custom_indicator_units (unit_id);
create index if not exists idx_custom_measurements_indicator on public.custom_indicator_measurements (indicator_id);
create index if not exists idx_custom_measurements_unit_period on public.custom_indicator_measurements (unit_id, period);
create index if not exists idx_custom_measurements_created_by on public.custom_indicator_measurements (created_by);

-- ============================================================================
-- 8. updated_at TRIGGERS
-- ============================================================================
drop trigger if exists trg_custom_indicators_updated_at on public.custom_indicators;
create trigger trg_custom_indicators_updated_at
  before update on public.custom_indicators
  for each row execute function public.set_updated_at();

drop trigger if exists trg_custom_measurements_updated_at on public.custom_indicator_measurements;
create trigger trg_custom_measurements_updated_at
  before update on public.custom_indicator_measurements
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 9. ROLE HELPERS
-- ============================================================================
create or replace function public.has_custom_indicator_role(role_name text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'admin' or role_name = any(custom_indicator_roles))
  );
$$;

create or replace function public.is_custom_indicator_manager()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'admin' or 'komite_mutu' = any(custom_indicator_roles))
  );
$$;

-- ============================================================================
-- 10. ROW LEVEL SECURITY
-- ============================================================================

-- ── custom_indicator_categories ──────────────────────────────────────────
alter table public.custom_indicator_categories enable row level security;

drop policy if exists "cic_select" on public.custom_indicator_categories;
create policy "cic_select" on public.custom_indicator_categories for select to authenticated using (true);

drop policy if exists "cic_write" on public.custom_indicator_categories;
create policy "cic_write" on public.custom_indicator_categories for all to authenticated
  using (public.is_custom_indicator_manager()) with check (public.is_custom_indicator_manager());

-- ── custom_indicators (master) — baca semua, tulis hanya komite_mutu/admin
--    (bagian 39: "Admin/Komite Mutu: dapat membuat/mengubah master indikator") ──
alter table public.custom_indicators enable row level security;

drop policy if exists "custom_indicators_select" on public.custom_indicators;
create policy "custom_indicators_select" on public.custom_indicators for select to authenticated using (true);

drop policy if exists "custom_indicators_write" on public.custom_indicators;
create policy "custom_indicators_write" on public.custom_indicators for all to authenticated
  using (public.is_custom_indicator_manager()) with check (public.is_custom_indicator_manager());

-- ── custom_indicator_versions / fields / units — sama: baca semua, tulis manager ──
alter table public.custom_indicator_versions enable row level security;
drop policy if exists "civ_select" on public.custom_indicator_versions;
create policy "civ_select" on public.custom_indicator_versions for select to authenticated using (true);
drop policy if exists "civ_write" on public.custom_indicator_versions;
create policy "civ_write" on public.custom_indicator_versions for all to authenticated
  using (public.is_custom_indicator_manager()) with check (public.is_custom_indicator_manager());

alter table public.custom_indicator_fields enable row level security;
drop policy if exists "cif_select" on public.custom_indicator_fields;
create policy "cif_select" on public.custom_indicator_fields for select to authenticated using (true);
drop policy if exists "cif_write" on public.custom_indicator_fields;
create policy "cif_write" on public.custom_indicator_fields for all to authenticated
  using (public.is_custom_indicator_manager()) with check (public.is_custom_indicator_manager());

alter table public.custom_indicator_units enable row level security;
drop policy if exists "ciu_select" on public.custom_indicator_units;
create policy "ciu_select" on public.custom_indicator_units for select to authenticated using (true);
drop policy if exists "ciu_write" on public.custom_indicator_units;
create policy "ciu_write" on public.custom_indicator_units for all to authenticated
  using (public.is_custom_indicator_manager()) with check (public.is_custom_indicator_manager());

-- ── custom_indicator_measurements — pola sama seperti indicator_entries
--    existing: siapa saja boleh baca semua, insert milik sendiri, update/
--    delete milik sendiri atau manager. Pembatasan "indikator harus ACTIVE
--    dan unit user harus punya akses" (bagian 39) ditegakkan di lapisan
--    aplikasi (src/lib/customIndicatorData.ts) sebelum INSERT, sama seperti
--    modul lain di repo ini menegakkan transisi status di aplikasi. ──
alter table public.custom_indicator_measurements enable row level security;

drop policy if exists "cim_select" on public.custom_indicator_measurements;
create policy "cim_select" on public.custom_indicator_measurements for select to authenticated using (true);

drop policy if exists "cim_insert" on public.custom_indicator_measurements;
create policy "cim_insert" on public.custom_indicator_measurements for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "cim_update" on public.custom_indicator_measurements;
create policy "cim_update" on public.custom_indicator_measurements for update to authenticated
  using (created_by = auth.uid() or public.is_custom_indicator_manager())
  with check (created_by = auth.uid() or public.is_custom_indicator_manager());

drop policy if exists "cim_delete" on public.custom_indicator_measurements;
create policy "cim_delete" on public.custom_indicator_measurements for delete to authenticated
  using (created_by = auth.uid() or public.is_custom_indicator_manager());

-- ============================================================================
-- 11. REALTIME (opsional, dipakai subscribeTo* di lapisan aplikasi)
-- ============================================================================
do $$ begin
  alter publication supabase_realtime add table public.custom_indicators;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.custom_indicator_measurements;
exception when duplicate_object then null; end $$;
