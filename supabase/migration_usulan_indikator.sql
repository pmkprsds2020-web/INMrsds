-- ============================================================================
-- INMrsds — Modul Usulan Indikator Mutu Unit (UIMU)
-- Migration tambahan, dijalankan SETELAH supabase/migration.sql (dan boleh
-- sebelum/sesudah migration_ikp.sql, migration_risk.sql, migration_budaya.sql
-- — tidak saling bergantung). Aman dijalankan berulang (IF NOT EXISTS / DO
-- blocks idempotent), dan TIDAK mengubah struktur tabel existing (profiles,
-- indicator_entries, audit_logs), kecuali penambahan kolom baru yang
-- bersifat additive (lihat bagian 0).
--
-- Alur modul: Usulan -> Review Kepala Unit/PJ Mutu -> Telaah Komite Mutu ->
-- Revisi (bila perlu) -> Persetujuan -> Penetapan -> Master Indikator ->
-- (integrasi ke modul pengukuran indikator mutu, di luar cakupan migration
-- ini — lihat catatan bagian 6).
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 0. PERLUASAN ADDITIVE PADA TABEL EXISTING
-- ============================================================================

-- 0.a — Peran tambahan khusus modul UIMU, terpisah dari `role` ('user'/'admin')
--       dan dari ikp_roles/risk_roles/budaya_roles, agar tidak mengubah
--       perilaku modul lain. Nilai yang dipakai aplikasi:
--       'kepala_unit'  -> Kepala Unit / PJ Mutu Unit (review awal usulan unitnya)
--       'komite_mutu'  -> Komite/Departemen Mutu (telaah, penetapan)
--       'manajemen'    -> Manajemen/Direktur (persetujuan akhir, dashboard pimpinan)
--       'admin' (role existing) otomatis dianggap punya semua hak UIMU.
alter table public.profiles
  add column if not exists uimu_roles text[] not null default '{}'::text[];

comment on column public.profiles.uimu_roles is
  'Peran tambahan khusus modul Usulan Indikator Mutu Unit: kepala_unit, komite_mutu, manajemen. Tidak memengaruhi role dasar (user/admin) atau ikp_roles/risk_roles/budaya_roles.';

-- 0.b — audit_logs sudah diperluas (entity_type/entity_id/old_value/new_value)
--       oleh migration_ikp.sql. Modul ini reuse kolom yang sama, cukup
--       menambahkan nilai 'uimu' pada check constraint `type`.
alter table public.audit_logs drop constraint if exists audit_logs_type_check;
alter table public.audit_logs add constraint audit_logs_type_check
  check (type in ('block', 'login', 'input', 'mapping', 'ikp', 'risk', 'budaya', 'uimu'));

-- ============================================================================
-- 1. MASTER UNIT (dinamis, dikelola admin — lihat catatan desain di bawah)
-- ============================================================================
-- Catatan desain: public.profiles.unit_id memakai check-constraint 9 nilai
-- tetap (IGD, Rawat Jalan, Rawat Inap, ICU, Kamar Operasi, VK, Laboratorium,
-- Radiologi, Farmasi) untuk keperluan modul INM/IKP/Risk/Budaya. Daftar itu
-- tidak mencakup seluruh unit/bagian rumah sakit (mis. Perawatan Umum, KBBL,
-- PI, PA, CSSD, IPCN, dst — lihat lampiran usulan & SPO acuan modul ini), dan
-- dokumen acuan modul UIMU secara eksplisit meminta master unit yang FLEKSIBEL
-- (bisa ditambah/diubah/dinonaktifkan admin, bukan hard-coded). Oleh karena
-- itu modul ini punya master unit sendiri (uimu_units), TIDAK menumpangi
-- enum profiles.unit_id yang sempit. proposer_unit_id_hint (bagian 2) tetap
-- menyimpan profiles.unit_id apa adanya sebagai info tambahan bila cocok.
create table if not exists public.uimu_units (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,          -- kode singkat, mis. 'PU', 'KBBL', 'FARMASI'
  name        text not null,                 -- nama lengkap, mis. 'Perawatan Umum'
  category    text,                          -- opsional: 'Rawat Inap','Rawat Jalan','Penunjang','Manajemen', dst — bebas teks, untuk pengelompokan tampilan
  is_active   boolean not null default true,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.uimu_units is
  'Master unit/bagian pengusul indikator mutu untuk modul UIMU. Dikelola admin lewat menu Master Indikator > Master Unit. Terpisah dari enum profiles.unit_id (lihat komentar di atas).';

-- ============================================================================
-- 2. TABEL UTAMA: uimu_proposals
-- ============================================================================
-- Satu baris = satu usulan indikator (satu versi aktif). Revisi TIDAK
-- membuat baris baru — riwayat revisi/versi disimpan di uimu_revisions
-- (bagian 3) sebagai snapshot before/after, sedangkan baris ini sendiri
-- membawa nomor `version` yang naik setiap kali dikembalikan lalu dikirim
-- ulang. "Salin indikator tahun sebelumnya" (poin 26 dokumen acuan) MEMBUAT
-- baris baru berstatus draft dengan parent_proposal_id menunjuk usulan asal.
create table if not exists public.uimu_proposals (
  id                       uuid primary key default gen_random_uuid(),
  proposal_number          text not null unique,   -- format UIMU/{KODE_UNIT}/{TAHUN}/000001, dibuat trigger
  period_year              int not null default extract(year from now())::int,
  version                  int not null default 1,
  parent_proposal_id       uuid references public.uimu_proposals (id) on delete set null,

  status                   text not null default 'draft' check (status in (
                              'draft', 'diajukan', 'review_unit', 'dikembalikan',
                              'telaah_mutu', 'revisi', 'disetujui', 'ditetapkan',
                              'aktif', 'tidak_disetujui', 'tidak_aktif'
                            )),

  -- ── Identitas pengusul ───────────────────────────────────────────────
  unit_id                  uuid references public.uimu_units (id) on delete restrict,
  unit_name_snapshot        text,               -- salinan nama unit saat pengajuan (tahan perubahan nama unit di masa depan)
  subunit                  text,
  proposer_id               uuid references auth.users (id) on delete set null,
  proposer_name             text,
  proposer_position          text,
  proposer_email            text,
  proposer_unit_id_hint      text,               -- opsional: profiles.unit_id pengusul saat itu, info tambahan saja

  -- ── Data indikator yang diusulkan ───────────────────────────────────
  indicator_name            text,
  indicator_category         text check (indicator_category is null or indicator_category in (
                              'inm', 'imp_rs', 'imp_unit', 'lainnya'
                            )),
  quality_dimension          text check (quality_dimension is null or quality_dimension in (
                              'keselamatan', 'efektivitas', 'efisiensi', 'aksesibilitas',
                              'berorientasi_pasien', 'ketepatan_waktu', 'keadilan',
                              'integrasi_pelayanan', 'lainnya'
                            )),
  quality_dimension_other     text,
  aspect_area                text,              -- kode salah satu dari 21 aspek SPO, atau 'lainnya' — daftar tetap disimpan di src/types/uimu.ts (pola sama seperti IKP)
  aspect_area_other          text,

  -- ── Alasan/dasar pemilihan (poin 6 dokumen acuan) ───────────────────
  reason_checklist           text[] not null default '{}'::text[],  -- kode-kode dari daftar tetap di src/types/uimu.ts
  reason_other               text,
  gap_description            text,               -- "Uraian masalah/gap yang mendasari indikator"

  -- ── Validasi kelayakan (poin 7 dokumen acuan / diagram SPO) ─────────
  eligibility_visi_misi       boolean,
  eligibility_evidence_gap     boolean,
  eligibility_important       boolean,
  eligibility_controllable     boolean,
  eligibility_validated       text check (eligibility_validated is null or eligibility_validated in ('ya', 'tidak', 'belum')),
  eligibility_quality_principle text,
  eligibility_patient_safety    boolean,
  eligibility_recommendation    text check (eligibility_recommendation is null or eligibility_recommendation in ('layak', 'tidak_layak', 'perlu_kajian')),

  -- ── Definisi operasional (poin 8, diisi setelah lolos review awal) ──
  operational_definition      text,
  indicator_goal              text,
  indicator_kind              text check (indicator_kind is null or indicator_kind in ('struktur', 'proses', 'outcome')),
  numerator                  text,
  denominator                text,
  formula                   text,
  unit_of_measure             text,
  inclusion_criteria          text,
  exclusion_criteria          text,
  population                text,
  data_source                text,
  collection_method           text,
  collection_instrument        text,
  pic_id                    uuid references auth.users (id) on delete set null,
  pic_name                  text,
  collection_frequency         text,
  analysis_period             text,
  reporting_period            text,
  notes                    text,

  -- ── Target (poin 9) ──────────────────────────────────────────────────
  target_value               text,
  target_unit                text,
  target_min                 numeric,
  target_max                 numeric,
  target_operator             text check (target_operator is null or target_operator in ('gte', 'lte', 'eq', 'range')),
  national_standard            text,
  hospital_standard            text,
  unit_standard               text,
  target_source               text check (target_source is null or target_source in (
                              'data_internal', 'data_rs_lain', 'standar_nasional',
                              'standar_internasional', 'evidence_praktik_terbaik', 'kesepakatan_internal'
                            )),
  target_reference             text,
  target_year                 int,

  -- ── Skor prioritas (poin 10) — total_score dihitung otomatis oleh DB,
  --    priority_category dihitung di aplikasi (lihat computeUimuPriority di
  --    src/lib/uimuData.ts) supaya ambang batas mudah disesuaikan tanpa migrasi.
  score_patient_safety_risk    int check (score_patient_safety_risk is null or score_patient_safety_risk between 1 and 5),
  score_gap                  int check (score_gap is null or score_gap between 1 and 5),
  score_frequency              int check (score_frequency is null or score_frequency between 1 and 5),
  score_patient_impact         int check (score_patient_impact is null or score_patient_impact between 1 and 5),
  score_hospital_impact        int check (score_hospital_impact is null or score_hospital_impact between 1 and 5),
  score_cost_utilization        int check (score_cost_utilization is null or score_cost_utilization between 1 and 5),
  score_controllability         int check (score_controllability is null or score_controllability between 1 and 5),
  score_strategic_importance     int check (score_strategic_importance is null or score_strategic_importance between 1 and 5),
  total_score                 int generated always as (
                              coalesce(score_patient_safety_risk, 0) + coalesce(score_gap, 0) +
                              coalesce(score_frequency, 0) + coalesce(score_patient_impact, 0) +
                              coalesce(score_hospital_impact, 0) + coalesce(score_cost_utilization, 0) +
                              coalesce(score_controllability, 0) + coalesce(score_strategic_importance, 0)
                            ) stored,

  -- ── Penetapan ────────────────────────────────────────────────────────
  decree_number               text,               -- nomor penetapan (berita acara/SK)
  established_date             date,
  established_by               uuid references auth.users (id) on delete set null,
  rejection_reason             text,

  -- ── Metadata ─────────────────────────────────────────────────────────
  created_by                 uuid references auth.users (id) on delete set null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  submitted_at                timestamptz
);

comment on table public.uimu_proposals is
  'Usulan indikator mutu unit, dari draft sampai ditetapkan/aktif. Baris berstatus ditetapkan/aktif berfungsi sebagai Master Indikator (lihat view uimu_master_indikator, bagian 6) dan menjadi sumber untuk modul pengukuran indikator mutu.';
comment on column public.uimu_proposals.reason_checklist is
  'Array kode alasan pemilihan indikator (checklist poin 6), mis. {keselamatan_pasien,variasi_pelayanan,inm}. Daftar kode tetap ada di src/types/uimu.ts, tidak dibatasi check-constraint supaya bisa berkembang tanpa migrasi.';

-- ============================================================================
-- 3. RIWAYAT REVISI / KOMENTAR REVIEWER (poin 12)
-- ============================================================================
create table if not exists public.uimu_revisions (
  id             uuid primary key default gen_random_uuid(),
  proposal_id     uuid not null references public.uimu_proposals (id) on delete cascade,
  version         int not null,            -- nomor versi usulan SAAT revisi ini dibuat
  stage          text not null check (stage in ('review_unit', 'telaah_mutu', 'approval')),
  reviewer_id      uuid references auth.users (id) on delete set null,
  reviewer_name    text,
  reviewer_role    text,                    -- snapshot role penilai saat itu (kepala_unit/komite_mutu/manajemen/admin)
  decision        text not null check (decision in ('dikembalikan', 'revisi', 'disetujui', 'ditolak')),
  comment         text,
  fields_to_fix     text[],                  -- opsional: daftar field yang harus diperbaiki, untuk UI form
  created_at       timestamptz not null default now()
);

comment on table public.uimu_revisions is
  'Riwayat setiap keputusan review/telaah per versi usulan. Tidak pernah dihapus/ditimpa (append-only) supaya jejak revisi lengkap tetap terlihat (poin 12: Versi 1 -> Versi 2 -> ...).';

-- ============================================================================
-- 4. APPROVAL BERJENJANG (poin 13)
-- ============================================================================
create table if not exists public.uimu_approvals (
  id             uuid primary key default gen_random_uuid(),
  proposal_id     uuid not null references public.uimu_proposals (id) on delete cascade,
  stage          text not null check (stage in ('pengusul', 'kepala_unit', 'komite_mutu', 'manajemen')),
  approver_id      uuid references auth.users (id) on delete set null,
  approver_name    text,
  approver_position text,
  decision        text not null check (decision in ('mengirim', 'menyetujui', 'menolak', 'meminta_revisi')),
  notes          text,
  decided_at       timestamptz not null default now()
);

comment on table public.uimu_approvals is
  'Jejak approval berjenjang Pengusul -> Kepala Unit/PJ Mutu -> Komite Mutu -> Manajemen/Direktur (poin 13).';

-- ============================================================================
-- 5. INDEXES
-- ============================================================================
create index if not exists idx_uimu_proposals_unit on public.uimu_proposals (unit_id);
create index if not exists idx_uimu_proposals_status on public.uimu_proposals (status);
create index if not exists idx_uimu_proposals_period on public.uimu_proposals (period_year);
create index if not exists idx_uimu_proposals_created_by on public.uimu_proposals (created_by);
create index if not exists idx_uimu_proposals_parent on public.uimu_proposals (parent_proposal_id);
create index if not exists idx_uimu_proposals_indicator_category on public.uimu_proposals (indicator_category);
create index if not exists idx_uimu_revisions_proposal on public.uimu_revisions (proposal_id);
create index if not exists idx_uimu_approvals_proposal on public.uimu_approvals (proposal_id);
create index if not exists idx_uimu_units_active on public.uimu_units (is_active);

-- ============================================================================
-- 6. MASTER INDIKATOR — view di atas uimu_proposals (poin 14)
-- ============================================================================
-- Tidak duplikasi data ke tabel terpisah: begitu status = 'ditetapkan' atau
-- 'aktif', baris usulan yang sama otomatis tampil di sini. Modul pengukuran
-- indikator mutu (di luar cakupan migration ini) bisa query view ini sebagai
-- sumber indikator aktif per unit/tahun.
create or replace view public.uimu_master_indikator as
select
  p.id, p.proposal_number, p.period_year, p.unit_id, u.code as unit_code, u.name as unit_name,
  p.indicator_name, p.indicator_category, p.quality_dimension, p.operational_definition,
  p.indicator_kind, p.numerator, p.denominator, p.formula, p.unit_of_measure,
  p.target_value, p.target_operator, p.collection_frequency, p.analysis_period,
  p.pic_id, p.pic_name, p.status, p.decree_number, p.established_date, p.established_by,
  p.total_score
from public.uimu_proposals p
left join public.uimu_units u on u.id = p.unit_id
where p.status in ('ditetapkan', 'aktif');

comment on view public.uimu_master_indikator is
  'Indikator mutu unit yang sudah resmi ditetapkan/aktif — sumber data untuk modul pengukuran indikator mutu. Lihat poin 14-15 dokumen acuan modul UIMU.';

-- ============================================================================
-- 7. AUTOMATIC NUMBERING — format UIMU/{KODE_UNIT}/{TAHUN}/000001
-- ============================================================================
create table if not exists public.uimu_proposal_counters (
  period_year  int not null,
  unit_code   text not null,
  last_number  int not null default 0,
  primary key (period_year, unit_code)
);

create or replace function public.generate_uimu_proposal_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit_code text;
  next_number int;
begin
  if new.proposal_number is not null and new.proposal_number <> '' then
    return new;
  end if;

  select code into v_unit_code from public.uimu_units where id = new.unit_id;
  if v_unit_code is null then
    v_unit_code := 'UNIT';
  end if;

  insert into public.uimu_proposal_counters (period_year, unit_code, last_number)
  values (new.period_year, v_unit_code, 1)
  on conflict (period_year, unit_code) do update
    set last_number = public.uimu_proposal_counters.last_number + 1
  returning last_number into next_number;

  new.proposal_number := 'UIMU/' || v_unit_code || '/' || new.period_year::text || '/' || lpad(next_number::text, 6, '0');
  return new;
end;
$$;

drop trigger if exists trg_uimu_proposals_number on public.uimu_proposals;
create trigger trg_uimu_proposals_number
  before insert on public.uimu_proposals
  for each row execute function public.generate_uimu_proposal_number();

-- ============================================================================
-- 8. updated_at TRIGGERS (reuse fungsi set_updated_at() dari migration.sql)
-- ============================================================================
drop trigger if exists trg_uimu_proposals_updated_at on public.uimu_proposals;
create trigger trg_uimu_proposals_updated_at
  before update on public.uimu_proposals
  for each row execute function public.set_updated_at();

drop trigger if exists trg_uimu_units_updated_at on public.uimu_units;
create trigger trg_uimu_units_updated_at
  before update on public.uimu_units
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 9. ROLE HELPERS
-- ============================================================================
create or replace function public.has_uimu_role(role_name text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'admin' or role_name = any(uimu_roles))
  );
$$;

-- "Reviewer" dalam arti luas — punya akses baca semua usulan & masuk ke
-- salah satu tahap workflow (kepala_unit/komite_mutu/manajemen/admin).
-- Pemeriksaan TAHAP mana yang boleh dilakukan (review_unit vs telaah_mutu
-- vs approval akhir) dilakukan di lapisan aplikasi (src/lib/uimuData.ts),
-- sama seperti pola is_ikp_reviewer()/enforcement status IKP.
create or replace function public.is_uimu_reviewer()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'admin' or uimu_roles && array['kepala_unit', 'komite_mutu', 'manajemen'])
  );
$$;

-- ============================================================================
-- 10. ROW LEVEL SECURITY
-- ============================================================================

-- ── uimu_units ───────────────────────────────────────────────────────────
alter table public.uimu_units enable row level security;

drop policy if exists "uimu_units_select" on public.uimu_units;
create policy "uimu_units_select"
  on public.uimu_units for select
  to authenticated
  using (true);  -- semua staf perlu melihat daftar unit saat membuat usulan

drop policy if exists "uimu_units_write" on public.uimu_units;
create policy "uimu_units_write"
  on public.uimu_units for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── uimu_proposals ───────────────────────────────────────────────────────
-- Pengusul hanya melihat usulan miliknya sendiri; kepala_unit/komite_mutu/
-- manajemen/admin melihat semua (perlu untuk review lintas unit & dashboard
-- pimpinan, poin 4/17 dokumen acuan).
alter table public.uimu_proposals enable row level security;

drop policy if exists "uimu_proposals_select" on public.uimu_proposals;
create policy "uimu_proposals_select"
  on public.uimu_proposals for select
  to authenticated
  using (
    created_by = auth.uid()
    or proposer_id = auth.uid()
    or public.is_uimu_reviewer()
  );

drop policy if exists "uimu_proposals_insert" on public.uimu_proposals;
create policy "uimu_proposals_insert"
  on public.uimu_proposals for insert
  to authenticated
  with check (created_by = auth.uid());

-- Pengusul hanya boleh mengubah usulan miliknya SELAGI draft/dikembalikan/
-- revisi (butuh perbaikan). Reviewer boleh mengubah kapan saja (perubahan
-- status/skor/penetapan) — enforcement transisi status yang lebih rinci ada
-- di lapisan aplikasi (uimuData.ts), sama seperti pola modul IKP.
drop policy if exists "uimu_proposals_update" on public.uimu_proposals;
create policy "uimu_proposals_update"
  on public.uimu_proposals for update
  to authenticated
  using (
    (created_by = auth.uid() and status in ('draft', 'dikembalikan', 'revisi'))
    or public.is_uimu_reviewer()
  )
  with check (
    (created_by = auth.uid() and status in ('draft', 'diajukan', 'dikembalikan', 'revisi'))
    or public.is_uimu_reviewer()
  );

drop policy if exists "uimu_proposals_delete" on public.uimu_proposals;
create policy "uimu_proposals_delete"
  on public.uimu_proposals for delete
  to authenticated
  using (public.is_admin() or (created_by = auth.uid() and status = 'draft'));

-- ── uimu_revisions ───────────────────────────────────────────────────────
alter table public.uimu_revisions enable row level security;

drop policy if exists "uimu_revisions_select" on public.uimu_revisions;
create policy "uimu_revisions_select"
  on public.uimu_revisions for select
  to authenticated
  using (
    exists (
      select 1 from public.uimu_proposals p
      where p.id = proposal_id and (p.created_by = auth.uid() or p.proposer_id = auth.uid())
    )
    or public.is_uimu_reviewer()
  );

drop policy if exists "uimu_revisions_insert" on public.uimu_revisions;
create policy "uimu_revisions_insert"
  on public.uimu_revisions for insert
  to authenticated
  with check (public.is_uimu_reviewer());

-- ── uimu_approvals ───────────────────────────────────────────────────────
alter table public.uimu_approvals enable row level security;

drop policy if exists "uimu_approvals_select" on public.uimu_approvals;
create policy "uimu_approvals_select"
  on public.uimu_approvals for select
  to authenticated
  using (
    exists (
      select 1 from public.uimu_proposals p
      where p.id = proposal_id and (p.created_by = auth.uid() or p.proposer_id = auth.uid())
    )
    or public.is_uimu_reviewer()
  );

drop policy if exists "uimu_approvals_insert" on public.uimu_approvals;
create policy "uimu_approvals_insert"
  on public.uimu_approvals for insert
  to authenticated
  with check (approver_id = auth.uid() or public.is_uimu_reviewer());

-- ============================================================================
-- 11. SEED — daftar unit awal, diambil dari contoh usulan (Perawatan Umum,
--     KBBL, dst) supaya modul langsung terpakai. Admin bebas menambah/
--     mengubah/menonaktifkan lewat menu Master Indikator > Master Unit.
-- ============================================================================
insert into public.uimu_units (code, name, category) values
  ('PU', 'Perawatan Umum', 'Rawat Inap'),
  ('PI', 'Perawatan Interna', 'Rawat Inap'),
  ('PA', 'Perawatan Anak', 'Rawat Inap'),
  ('KBBL', 'Kamar Bersalin dan Bayi Lahir', 'Rawat Inap'),
  ('IGD', 'Instalasi Gawat Darurat', 'Gawat Darurat'),
  ('OK', 'Kamar Operasi', 'Bedah'),
  ('ICU', 'Intensive Care Unit', 'Rawat Inap'),
  ('RJ', 'Rawat Jalan', 'Rawat Jalan'),
  ('FARMASI', 'Farmasi', 'Penunjang'),
  ('LAB', 'Laboratorium', 'Penunjang'),
  ('RAD', 'Radiologi', 'Penunjang'),
  ('GIZI', 'Gizi', 'Penunjang'),
  ('RM', 'Rekam Medis', 'Penunjang'),
  ('CSSD', 'CSSD', 'Penunjang'),
  ('PPI', 'IPCN / PPI', 'Manajemen Mutu'),
  ('MUTU', 'Komite/Departemen Mutu', 'Manajemen Mutu'),
  ('SDM', 'Sumber Daya Manusia', 'Manajemen'),
  ('KEU', 'Keuangan', 'Manajemen'),
  ('RT', 'Rumah Tangga', 'Manajemen')
on conflict (code) do nothing;
