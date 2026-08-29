-- ============================================================================
-- INMrsds — Modul Pelaporan Insiden Keselamatan Pasien (IKP)
-- Migration tambahan, dijalankan SETELAH supabase/migration.sql.
-- Aman dijalankan berulang (IF NOT EXISTS / idempotent DO blocks), dan
-- TIDAK mengubah struktur tabel existing (profiles, indicator_entries),
-- kecuali penambahan kolom baru yang bersifat additive (lihat bagian 0).
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 0. PERLUASAN ADDITIVE PADA TABEL EXISTING (tidak menghapus/mengubah kolom lama)
-- ============================================================================

-- 0.a — Peran tambahan khusus modul IKP, terpisah dari `role` ('user'/'admin')
--       yang sudah dipakai modul INM agar tidak mengubah perilaku modul lama.
--       Nilai yang dipakai aplikasi: 'verifikator', 'tim_mutu', 'pimpinan'.
--       'admin' (role existing) otomatis dianggap punya semua hak IKP.
alter table public.profiles
  add column if not exists ikp_roles text[] not null default '{}'::text[];

comment on column public.profiles.ikp_roles is
  'Peran tambahan khusus modul IKP: verifikator, tim_mutu, pimpinan. Tidak memengaruhi role dasar (user/admin).';

-- 0.b — audit_logs diperluas agar bisa menyimpan audit trail per-entity dengan
--       nilai sebelum/sesudah (kebutuhan section 18), sekaligus tetap dipakai
--       sebagai feed NotificationPanel/AuditTrailPanel yang sudah ada.
alter table public.audit_logs
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists old_value jsonb,
  add column if not exists new_value jsonb;

alter table public.audit_logs drop constraint if exists audit_logs_type_check;
alter table public.audit_logs add constraint audit_logs_type_check
  check (type in ('block', 'login', 'input', 'mapping', 'ikp'));

-- ============================================================================
-- 1. MASTER DATA (referensi tetap, sesuai istilah pada dokumen IKP)
-- ============================================================================
-- Catatan: klasifikasi/kategori pada dokumen acuan bersifat tetap (baku RS),
-- jadi disimpan sebagai check-constraint + konstanta TS (src/types/ikp.ts),
-- BUKAN tabel master yang bisa diedit bebas dari UI — konsisten dengan pola
-- INDICATORS/UNIT_MAP yang sudah dipakai modul INM (konstanta kode, bukan
-- tabel). Ini mengurangi risiko istilah baku berubah tanpa sepengetahuan
-- Tim Keselamatan Pasien. Jika ke depan RS ingin master data dinamis dari
-- UI, ini bisa dimigrasikan ke tabel tanpa mengubah bentuk data lain.

-- ============================================================================
-- 2. TABEL UTAMA: ikp_incidents
-- ============================================================================
-- Menaungi DUA jenis formulir dari dokumen acuan lewat kolom report_kind:
--   'insiden' -> "Laporan Insiden KNC, KTC, KTD, dan Kejadian Sentinel"
--   'kpc'     -> "Laporan Kondisi Potensial Cedera (KPC)"
-- Field yang hanya berlaku untuk salah satu jenis dibiarkan nullable.

create table if not exists public.ikp_incidents (
  id                        uuid primary key default gen_random_uuid(),
  report_number             text not null unique,
  report_kind                text not null check (report_kind in ('insiden', 'kpc')),
  status                     text not null default 'draft' check (status in (
                               'draft', 'dilaporkan', 'diverifikasi', 'investigasi', 'analisis',
                               'rencana_tindak_lanjut', 'pelaksanaan', 'verifikasi_penyelesaian', 'selesai'
                             )),

  -- ── Identitas laporan ────────────────────────────────────────────────
  report_date                date not null default current_date,
  report_time                time,
  reporter_id                uuid references auth.users (id) on delete set null,
  reporter_name               text,
  reporter_unit               text,
  reporter_profession          text,
  reporter_contact            text,
  is_anonymous                boolean not null default false,
  tempat                      text, -- "Tempat : Poli ..." pada kop formulir

  -- ── Data pasien (khusus report_kind = 'insiden') ────────────────────
  patient_name                text,
  patient_mr_number             text,
  patient_room                 text,
  patient_age_group             text check (patient_age_group is null or patient_age_group in (
                                 '0_1_bulan', '1bulan_1tahun', '1_5tahun', '5_15tahun',
                                 '15_30tahun', '30_65tahun', 'diatas_65tahun'
                               )),
  patient_gender               text check (patient_gender is null or patient_gender in ('laki_laki', 'perempuan')),
  payer_type                   text check (payer_type is null or payer_type in (
                                 'umum', 'asuransi_swasta', 'bpjs_kesehatan', 'perusahaan',
                                 'bpjs_pbi', 'jaminan_kesehatan_daerah'
                               )),
  admission_date               date,
  admission_time               time,

  -- ── Rincian kejadian ─────────────────────────────────────────────────
  incident_date                date,
  incident_time                time,
  incident_summary             text,
  chronology                   text,
  incident_type                text check (incident_type is null or incident_type in ('knc', 'ktc', 'ktd_sentinel')),
  is_sentinel                  boolean not null default false, -- penanda tambahan bila incident_type = 'ktd_sentinel' tergolong kejadian sentinel (lihat catatan "Perlu konfirmasi" di src/types/ikp.ts)
  reported_by_category           text check (reported_by_category is null or reported_by_category in (
                                 'karyawan', 'pasien', 'keluarga_pendamping', 'pengunjung', 'lain_lain'
                               )),
  reported_by_detail            text,
  incident_subject             text check (incident_subject is null or incident_subject in ('pasien', 'lain_lain')),
  incident_subject_detail        text,
  patient_service_type           text check (patient_service_type is null or patient_service_type in (
                                 'rawat_inap', 'rawat_jalan', 'igd', 'lain_lain'
                               )),
  incident_location             text,
  patient_service_unit           text,
  patient_service_unit_other      text,
  causing_unit                 text,
  patient_impact                text check (patient_impact is null or patient_impact in (
                                 'kematian', 'cedera_irreversibel_berat', 'cedera_reversibel_sedang',
                                 'cedera_ringan', 'tidak_ada_cedera'
                               )),
  immediate_action              text,
  immediate_action_result         text,
  action_taken_by               text check (action_taken_by is null or action_taken_by in (
                                 'tim', 'dokter', 'perawat', 'petugas_lain'
                               )),
  action_taken_by_detail          text,
  recurrence_elsewhere            boolean,
  recurrence_detail             text,

  -- ── Khusus KPC ───────────────────────────────────────────────────────
  kpc_description               text,
  kpc_location                  text,
  kpc_related_unit               text,

  -- ── Grading risiko (diisi atasan pelapor / verifikator, insiden saja) ─
  severity_grade                text check (severity_grade is null or severity_grade in ('biru', 'hijau', 'kuning', 'merah')),
  severity_set_by                uuid references auth.users (id),
  severity_set_at                timestamptz,
  investigation_required           boolean,

  -- ── Sign-off (tabel Pembuat/Penerima Laporan pada dokumen) ───────────
  report_maker_name              text,
  report_receiver_name             text,
  report_receiver_id              uuid references auth.users (id),
  report_received_date             date,

  -- ── Meta ─────────────────────────────────────────────────────────────
  created_by                  uuid references auth.users (id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  submitted_at                 timestamptz,
  verified_at                  timestamptz,
  closed_at                    timestamptz
);

comment on table public.ikp_incidents is
  'Laporan Insiden Keselamatan Pasien (KNC/KTC/KTD/Sentinel) dan Laporan KPC, sesuai Format Laporan Insiden ke Tim Keselamatan Pasien.';

-- ============================================================================
-- 3. INVESTIGASI
-- ============================================================================
create table if not exists public.ikp_investigations (
  id                       uuid primary key default gen_random_uuid(),
  incident_id               uuid not null references public.ikp_incidents (id) on delete cascade,
  investigator_id             uuid references auth.users (id),
  investigator_name           text,
  method                    text, -- mis. 'Investigasi Sederhana', 'RCA', '5 Why', 'Fishbone/Ishikawa'
  started_at                date,
  completed_at               date,
  findings                  text,
  root_cause                 text,
  contributing_factors          text[] default '{}'::text[], -- subset dari: manusia, sistem, lingkungan, komunikasi, organisasi
  contributing_factors_detail     text,
  recommendation              text,
  created_by                uuid references auth.users (id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

comment on table public.ikp_investigations is
  'Catatan investigasi & analisis akar masalah per insiden. Metode dan faktor kontributor mengikuti praktik umum manajemen risiko RS — TIDAK berasal dari dokumen acuan, perlu dikonfirmasi Tim Keselamatan Pasien.';

-- ============================================================================
-- 4. TINDAK LANJUT (corrective / preventive action)
-- ============================================================================
create table if not exists public.ikp_actions (
  id                  uuid primary key default gen_random_uuid(),
  incident_id           uuid not null references public.ikp_incidents (id) on delete cascade,
  action              text not null,
  action_type           text check (action_type in ('corrective', 'preventive')),
  pic_id              uuid references auth.users (id),
  pic_name             text,
  unit                text,
  priority             text check (priority in ('rendah', 'sedang', 'tinggi')),
  due_date             date,
  status              text not null default 'belum_dimulai' check (status in (
                        'belum_dimulai', 'berjalan', 'menunggu_verifikasi', 'selesai', 'terlambat'
                      )),
  completed_at          date,
  evidence_note          text,
  verifier_id            uuid references auth.users (id),
  verification_result      text,
  verified_at            timestamptz,
  notes               text,
  created_by            uuid references auth.users (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.ikp_actions is
  'Rencana & pelaksanaan tindak lanjut (corrective/preventive action) per insiden, dengan PIC, prioritas, deadline, dan verifikasi.';

-- ============================================================================
-- 5. ATTACHMENT (metadata; file fisik disimpan di Supabase Storage)
-- ============================================================================
create table if not exists public.ikp_attachments (
  id             uuid primary key default gen_random_uuid(),
  incident_id      uuid not null references public.ikp_incidents (id) on delete cascade,
  action_id        uuid references public.ikp_actions (id) on delete set null,
  filename         text not null,
  storage_key       text not null, -- path di bucket Storage 'ikp-attachments'
  mime_type        text,
  size_bytes        bigint,
  uploaded_by       uuid references auth.users (id),
  created_at        timestamptz not null default now()
);

comment on table public.ikp_attachments is
  'Metadata bukti pendukung (foto, dokumen, hasil pemeriksaan) yang diunggah ke Supabase Storage bucket ikp-attachments.';

-- ============================================================================
-- 6. INDEXES
-- ============================================================================
create index if not exists idx_ikp_incidents_status on public.ikp_incidents (status);
create index if not exists idx_ikp_incidents_report_kind on public.ikp_incidents (report_kind);
create index if not exists idx_ikp_incidents_severity on public.ikp_incidents (severity_grade);
create index if not exists idx_ikp_incidents_reporter on public.ikp_incidents (reporter_id);
create index if not exists idx_ikp_incidents_created_by on public.ikp_incidents (created_by);
create index if not exists idx_ikp_incidents_incident_date on public.ikp_incidents (incident_date desc);
create index if not exists idx_ikp_incidents_report_date on public.ikp_incidents (report_date desc);
create index if not exists idx_ikp_incidents_causing_unit on public.ikp_incidents (causing_unit);

create index if not exists idx_ikp_investigations_incident on public.ikp_investigations (incident_id);
create index if not exists idx_ikp_actions_incident on public.ikp_actions (incident_id);
create index if not exists idx_ikp_actions_status on public.ikp_actions (status);
create index if not exists idx_ikp_actions_pic on public.ikp_actions (pic_id);
create index if not exists idx_ikp_actions_due_date on public.ikp_actions (due_date);
create index if not exists idx_ikp_attachments_incident on public.ikp_attachments (incident_id);

create index if not exists idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);

-- ============================================================================
-- 7. AUTOMATIC NUMBERING — format IKP-YYYY-000001, aman untuk concurrent insert
-- ============================================================================
create table if not exists public.ikp_report_counters (
  year        int primary key,
  last_number int not null default 0
);

create or replace function public.generate_ikp_report_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_year int := extract(year from now())::int;
  next_number int;
begin
  if new.report_number is not null and new.report_number <> '' then
    return new;
  end if;

  insert into public.ikp_report_counters (year, last_number)
  values (cur_year, 1)
  on conflict (year) do update set last_number = public.ikp_report_counters.last_number + 1
  returning last_number into next_number;

  new.report_number := 'IKP-' || cur_year::text || '-' || lpad(next_number::text, 6, '0');
  return new;
end;
$$;

drop trigger if exists trg_ikp_incidents_report_number on public.ikp_incidents;
create trigger trg_ikp_incidents_report_number
  before insert on public.ikp_incidents
  for each row execute function public.generate_ikp_report_number();

-- ============================================================================
-- 8. updated_at TRIGGERS (reuse fungsi set_updated_at() dari migration.sql)
-- ============================================================================
drop trigger if exists trg_ikp_incidents_updated_at on public.ikp_incidents;
create trigger trg_ikp_incidents_updated_at
  before update on public.ikp_incidents
  for each row execute function public.set_updated_at();

drop trigger if exists trg_ikp_investigations_updated_at on public.ikp_investigations;
create trigger trg_ikp_investigations_updated_at
  before update on public.ikp_investigations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_ikp_actions_updated_at on public.ikp_actions;
create trigger trg_ikp_actions_updated_at
  before update on public.ikp_actions
  for each row execute function public.set_updated_at();

-- Tandai 'terlambat' otomatis kalau due_date lewat dan status belum selesai.
-- Dipanggil dari aplikasi saat memuat daftar tindak lanjut (lihat ikpData.ts),
-- bukan cron job, supaya tidak butuh Supabase Edge Function tambahan.
create or replace function public.mark_overdue_ikp_actions()
returns void
language sql
security definer
set search_path = public
as $$
  update public.ikp_actions
  set status = 'terlambat'
  where due_date < current_date
    and status in ('belum_dimulai', 'berjalan');
$$;

-- ============================================================================
-- 9. ROLE HELPER — perluasan is_admin() (dari migration.sql) untuk peran IKP
-- ============================================================================
create or replace function public.has_ikp_role(role_name text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'admin' or role_name = any(ikp_roles))
  );
$$;

create or replace function public.is_ikp_reviewer()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'admin' or ikp_roles && array['verifikator', 'tim_mutu', 'pimpinan'])
  );
$$;

-- ============================================================================
-- 10. ROW LEVEL SECURITY
-- ============================================================================

-- ── ikp_incidents ──────────────────────────────────────────────────────
-- Dokumen menandai formulir "RAHASIA" — pelapor biasa hanya boleh melihat
-- laporan miliknya sendiri; verifikator/tim_mutu/pimpinan/admin melihat semua.
alter table public.ikp_incidents enable row level security;

drop policy if exists "ikp_incidents_select" on public.ikp_incidents;
create policy "ikp_incidents_select"
  on public.ikp_incidents for select
  to authenticated
  using (
    created_by = auth.uid()
    or reporter_id = auth.uid()
    or public.is_ikp_reviewer()
  );

drop policy if exists "ikp_incidents_insert" on public.ikp_incidents;
create policy "ikp_incidents_insert"
  on public.ikp_incidents for insert
  to authenticated
  with check (created_by = auth.uid());

-- Pelapor hanya boleh mengubah laporan miliknya SELAGI masih draft.
-- Verifikator/tim_mutu/pimpinan/admin boleh mengubah kapan saja (perubahan
-- status, grading, dsb.) — enforcement transisi status yang lebih rinci
-- dilakukan di lapisan aplikasi (lihat ikpData.ts).
drop policy if exists "ikp_incidents_update" on public.ikp_incidents;
create policy "ikp_incidents_update"
  on public.ikp_incidents for update
  to authenticated
  using (
    (created_by = auth.uid() and status = 'draft')
    or public.is_ikp_reviewer()
  )
  with check (
    (created_by = auth.uid() and status in ('draft', 'dilaporkan'))
    or public.is_ikp_reviewer()
  );

drop policy if exists "ikp_incidents_delete" on public.ikp_incidents;
create policy "ikp_incidents_delete"
  on public.ikp_incidents for delete
  to authenticated
  using (public.is_admin() or (created_by = auth.uid() and status = 'draft'));

-- ── ikp_investigations ─────────────────────────────────────────────────
alter table public.ikp_investigations enable row level security;

drop policy if exists "ikp_investigations_select" on public.ikp_investigations;
create policy "ikp_investigations_select"
  on public.ikp_investigations for select
  to authenticated
  using (
    public.is_ikp_reviewer()
    or exists (
      select 1 from public.ikp_incidents i
      where i.id = incident_id and i.created_by = auth.uid()
    )
  );

drop policy if exists "ikp_investigations_write" on public.ikp_investigations;
create policy "ikp_investigations_write"
  on public.ikp_investigations for all
  to authenticated
  using (public.is_ikp_reviewer())
  with check (public.is_ikp_reviewer());

-- ── ikp_actions ────────────────────────────────────────────────────────
alter table public.ikp_actions enable row level security;

drop policy if exists "ikp_actions_select" on public.ikp_actions;
create policy "ikp_actions_select"
  on public.ikp_actions for select
  to authenticated
  using (
    public.is_ikp_reviewer()
    or pic_id = auth.uid()
    or exists (
      select 1 from public.ikp_incidents i
      where i.id = incident_id and i.created_by = auth.uid()
    )
  );

drop policy if exists "ikp_actions_insert" on public.ikp_actions;
create policy "ikp_actions_insert"
  on public.ikp_actions for insert
  to authenticated
  with check (public.is_ikp_reviewer());

-- PIC boleh update status pengerjaan miliknya sendiri; reviewer boleh semua.
drop policy if exists "ikp_actions_update" on public.ikp_actions;
create policy "ikp_actions_update"
  on public.ikp_actions for update
  to authenticated
  using (public.is_ikp_reviewer() or pic_id = auth.uid())
  with check (public.is_ikp_reviewer() or pic_id = auth.uid());

drop policy if exists "ikp_actions_delete" on public.ikp_actions;
create policy "ikp_actions_delete"
  on public.ikp_actions for delete
  to authenticated
  using (public.is_ikp_reviewer());

-- ── ikp_attachments ────────────────────────────────────────────────────
alter table public.ikp_attachments enable row level security;

drop policy if exists "ikp_attachments_select" on public.ikp_attachments;
create policy "ikp_attachments_select"
  on public.ikp_attachments for select
  to authenticated
  using (
    public.is_ikp_reviewer()
    or exists (
      select 1 from public.ikp_incidents i
      where i.id = incident_id and i.created_by = auth.uid()
    )
  );

drop policy if exists "ikp_attachments_insert" on public.ikp_attachments;
create policy "ikp_attachments_insert"
  on public.ikp_attachments for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and (
      public.is_ikp_reviewer()
      or exists (
        select 1 from public.ikp_incidents i
        where i.id = incident_id and i.created_by = auth.uid()
      )
    )
  );

drop policy if exists "ikp_attachments_delete" on public.ikp_attachments;
create policy "ikp_attachments_delete"
  on public.ikp_attachments for delete
  to authenticated
  using (public.is_admin() or uploaded_by = auth.uid());

-- ── Supabase Storage bucket + policy untuk attachment ────────────────────
insert into storage.buckets (id, name, public)
values ('ikp-attachments', 'ikp-attachments', false)
on conflict (id) do nothing;

drop policy if exists "ikp_storage_select" on storage.objects;
create policy "ikp_storage_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'ikp-attachments'
    and (public.is_ikp_reviewer() or owner = auth.uid())
  );

drop policy if exists "ikp_storage_insert" on storage.objects;
create policy "ikp_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'ikp-attachments');

drop policy if exists "ikp_storage_delete" on storage.objects;
create policy "ikp_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'ikp-attachments'
    and (public.is_admin() or owner = auth.uid())
  );

-- ============================================================================
-- 11. REALTIME
-- ============================================================================
do $$
begin
  alter publication supabase_realtime add table public.ikp_incidents;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ikp_actions;
exception when duplicate_object then null;
end $$;

-- ============================================================================
-- 12. SETUP MANUAL — jalankan sekali setelah user terkait sudah signup
-- ============================================================================
-- Contoh memberi peran IKP tambahan ke seorang user:
--
--   update public.profiles
--   set ikp_roles = array['tim_mutu']
--   where email = 'kepala.mutu@example.com';
--
-- Nilai ikp_roles yang dikenali aplikasi: 'verifikator', 'tim_mutu', 'pimpinan'.
-- User dengan role = 'admin' (existing) otomatis punya semua akses reviewer IKP.
