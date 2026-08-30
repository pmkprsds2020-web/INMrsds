-- ============================================================================
-- INMrsds — Modul MANAJEMEN RISIKO
-- Migration tambahan, dijalankan SETELAH supabase/migration.sql dan
-- (opsional, jika modul IKP sudah dipakai) supabase/migration_ikp.sql.
-- Aman dijalankan berulang (IF NOT EXISTS / idempotent DO blocks), dan
-- TIDAK mengubah struktur tabel existing (profiles, indicator_entries,
-- ikp_*), kecuali penambahan kolom baru yang bersifat additive (lihat
-- bagian 0). Referensi utama: "RISK REGISTER .pdf" (RS Ali Sibroh Malisi,
-- tahun 2022-2025). Istilah, formula, dan batas level DIPERTAHANKAN
-- persis sesuai dokumen — lihat komentar "Sumber:" pada tiap bagian.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 0. PERLUASAN ADDITIVE PADA TABEL EXISTING
-- ============================================================================

-- 0.a — Peran tambahan khusus modul Manajemen Risiko, terpisah dari `role`
--       ('user'/'admin') dan dari `ikp_roles` (jika ada) supaya tidak
--       mengubah perilaku modul lain. Nilai yang dipakai aplikasi:
--       'manajemen', 'pj_mutu', 'risk_owner', 'staff_unit', 'direktur'.
--       'admin' (role existing) otomatis dianggap punya semua hak Risiko.
alter table public.profiles
  add column if not exists risk_roles text[] not null default '{}'::text[];

comment on column public.profiles.risk_roles is
  'Peran tambahan khusus modul Manajemen Risiko: manajemen, pj_mutu, risk_owner, staff_unit, direktur. Tidak memengaruhi role dasar (user/admin) atau ikp_roles.';

-- 0.b — audit_logs diperluas untuk menerima entity_type = 'risks' (kolom
--       entity_type/entity_id/old_value/new_value sudah ditambahkan oleh
--       migration_ikp.sql; blok ini idempotent bila modul IKP belum ada).
alter table public.audit_logs
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists old_value jsonb,
  add column if not exists new_value jsonb;

alter table public.audit_logs drop constraint if exists audit_logs_type_check;
alter table public.audit_logs add constraint audit_logs_type_check
  check (type in ('block', 'login', 'input', 'mapping', 'ikp', 'risk'));

-- ============================================================================
-- 1. MASTER DATA (referensi tetap; disimpan sebagai check-constraint +
--    konstanta TS di src/types/risk.ts — bukan tabel bebas-edit, konsisten
--    dengan pola IKP, supaya istilah baku tidak berubah diam-diam dari UI)
-- ============================================================================
-- Kategori risiko (25 kategori, poin 6 dokumen instruksi):
--   pelayanan_klinis, keselamatan_pasien, ppi, farmasi, laboratorium,
--   radiologi, keperawatan, igd, rawat_jalan, rawat_inap, ok_cssd, gizi,
--   laundry_linen, kesling, k3rs, ipsrs, it, keuangan, rekam_medis, sdm,
--   keamanan, sarana_prasarana, ambulance, administrasi, lainnya

-- ============================================================================
-- 2. TABEL UTAMA: risks (identifikasi risiko + kode + tahun)
-- ============================================================================
create table if not exists public.risks (
  id                    uuid primary key default gen_random_uuid(),
  risk_code             text not null unique,          -- RSK-2026-000001
  risk_year             int not null,                  -- Multi-tahun (poin 25) — SATU struktur tabel, bukan tabel per tahun
  identified_date       date not null default current_date,

  -- ── Informasi Risiko (poin 6.A) ─────────────────────────────────────
  unit_lokasi           text not null,
  category              text not null,
  subcategory           text,

  -- ── Identifikasi (poin 6.B) — istilah dipertahankan sesuai dokumen ──
  risiko                text not null,                 -- "RISIKO"
  sebab_insiden         text not null,                  -- "SEBAB INSIDEN/KEJADIAN"
  efek_dampak           text not null,                  -- "EFEK/DAMPAK"
  proses_terdampak      text,
  dokumen_spo_terkait   text,
  kontrol_existing      text,
  bukti_pendukung       text,

  -- ── Sumber (poin 22/23 — integrasi IKP & Audit, opsional) ───────────
  source_ikp_incident_id uuid,                         -- FK longgar (lihat bag. 9); diisi via tombol "Jadikan Risiko"
  source_audit_ref       text,

  status                text not null default 'draft' check (status in (
                          'draft', 'identifikasi', 'dianalisis', 'dievaluasi',
                          'dalam_mitigasi', 'monitoring', 'review', 'selesai', 'ditutup'
                        )),

  risk_owner_id         uuid references auth.users (id),
  risk_owner_name       text,                          -- "RISK OWNER/PIC"

  created_by            uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  closed_at             timestamptz
);

comment on table public.risks is
  'Identifikasi risiko — inti Risk Register multi-tahun (risk_year), sesuai struktur "RISK REGISTER .pdf" RS Ali Sibroh Malisi.';

-- ============================================================================
-- 3. ANALISIS RISIKO — risk_assessments (poin 7-11: Probabilitas x Dampak x
--    Controllability, skala 1-5, SKOR = DAMPAK x PROBABILITAS x
--    CONTROLLABILITY dihitung otomatis via generated column — tidak boleh
--    diinput manual, poin 41)
-- ============================================================================
-- Satu risiko memiliki SATU assessment "aktif" (inheren) yang bisa diedit
-- ulang saat re-analisis; riwayat perubahan tercatat di risk_history (bag. 8).
create table if not exists public.risk_assessments (
  id               uuid primary key default gen_random_uuid(),
  risk_id          uuid not null unique references public.risks (id) on delete cascade,

  probabilitas     int not null check (probabilitas between 1 and 5),
  dampak           int not null check (dampak between 1 and 5),
  controllability  int not null check (controllability between 1 and 5),

  -- SKOR RISIKO = DAMPAK x PROBABILITAS x CONTROLLABILITY (poin 11) — generated, read-only
  skor_risiko      int generated always as (dampak * probabilitas * controllability) stored,

  -- Level SKOR RISIKO (rentang 1-125) — dipakai untuk ranking & kartu dashboard.
  -- Batas ini TERPISAH dari batas Risk Matrix (bag. 4), sesuai poin 12.
  level_skor       text generated always as (
                      case
                        when (dampak * probabilitas * controllability) >= 60 then 'sangat_tinggi'
                        when (dampak * probabilitas * controllability) >= 30 then 'tinggi'
                        when (dampak * probabilitas * controllability) >= 12 then 'sedang'
                        when (dampak * probabilitas * controllability) >= 4  then 'rendah'
                        else 'sangat_rendah'
                      end
                    ) stored,

  -- Level Risk Matrix (Probabilitas x Dampak SAJA — batas persis dari dokumen, poin 12):
  --   Sangat Tinggi: >15 | Tinggi: 10-14 | Sedang: 5-9 | Rendah: 3-4 | Sangat Rendah: 1-2
  matrix_score     int generated always as (dampak * probabilitas) stored,
  matrix_level     text generated always as (
                      case
                        when (dampak * probabilitas) > 15 then 'sangat_tinggi'
                        when (dampak * probabilitas) >= 10 then 'tinggi'
                        when (dampak * probabilitas) >= 5 then 'sedang'
                        when (dampak * probabilitas) >= 3 then 'rendah'
                        else 'sangat_rendah'
                      end
                    ) stored,

  analyzed_by      uuid references auth.users (id),
  analyzed_at      timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.risk_assessments is
  'Analisis risiko inheren: Probabilitas x Dampak x Controllability (skala 1-5, sesuai dokumen acuan). skor_risiko, level_skor, matrix_score, matrix_level SEMUA generated column — tidak bisa diinput manual (poin 11, 41).';

-- ── Evaluasi risiko (poin 14) — melekat pada assessment aktif ──────────
alter table public.risk_assessments
  add column if not exists evaluation_decision text check (evaluation_decision is null or evaluation_decision in (
    'diterima', 'perlu_mitigasi', 'prioritas_tinggi', 'perlu_eskalasi', 'perlu_investigasi', 'perlu_monitoring'
  )),
  add column if not exists evaluated_by uuid references auth.users (id),
  add column if not exists evaluated_at timestamptz;

-- Ranking (poin 13) dihitung on-the-fly di aplikasi (ORDER BY skor_risiko DESC,
-- lalu level_skor, dampak, probabilitas, identified_date) — TIDAK disimpan
-- sebagai kolom statis supaya selalu konsisten saat data berubah.

-- ============================================================================
-- 4. PENGELOLAAN RISIKO / MITIGASI — risk_mitigations (poin 15)
-- ============================================================================
create table if not exists public.risk_mitigations (
  id                  uuid primary key default gen_random_uuid(),
  risk_id             uuid not null references public.risks (id) on delete cascade,

  strategi            text,                       -- Strategi Pengelolaan
  rencana_tindakan    text not null,               -- "PENGELOLAAN RISIKO" (istilah dipertahankan)
  tujuan_tindakan     text,
  pic_id              uuid references auth.users (id),
  pic_name            text,
  tanggal_mulai       date,
  target_penyelesaian date,
  indikator_keberhasilan text,
  target_capaian      text,
  sumber_daya         text,
  anggaran            numeric,
  status              text not null default 'belum_dimulai' check (status in (
                        'belum_dimulai', 'berjalan', 'menunggu_verifikasi', 'selesai', 'terlambat'
                      )),
  progress_percent    int not null default 0 check (progress_percent between 0 and 100),
  bukti_tindak_lanjut text,
  catatan             text,

  created_by          uuid references auth.users (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint chk_risk_mitigation_dates check (target_penyelesaian is null or tanggal_mulai is null or target_penyelesaian >= tanggal_mulai)
);

comment on table public.risk_mitigations is
  'Rencana & pelaksanaan pengelolaan/mitigasi risiko, dengan PIC, target, dan progress (poin 15).';

-- ============================================================================
-- 5. MONITORING RISIKO — risk_monitorings (timeline, poin 17)
-- ============================================================================
create table if not exists public.risk_monitorings (
  id             uuid primary key default gen_random_uuid(),
  risk_id        uuid not null references public.risks (id) on delete cascade,
  mitigation_id  uuid references public.risk_mitigations (id) on delete set null,

  tanggal        date not null default current_date,
  aktivitas      text not null,
  pic_name       text,
  catatan        text,
  progress_percent int check (progress_percent between 0 and 100),
  bukti          text,

  created_by     uuid references auth.users (id),
  created_at     timestamptz not null default now()
);

comment on table public.risk_monitorings is
  'Timeline monitoring tindak lanjut per risiko (tanggal, aktivitas, PIC, progress, bukti) — poin 17.';

-- ============================================================================
-- 6. REVIEW RISIKO / RISIKO RESIDUAL — risk_reviews (poin 18-19)
-- ============================================================================
-- Menyimpan RISIKO RESIDUAL secara terpisah dari risk_assessments (RISIKO
-- INHEREN/AWAL) — data awal TIDAK ditimpa (poin 19).
create table if not exists public.risk_reviews (
  id                     uuid primary key default gen_random_uuid(),
  risk_id                uuid not null references public.risks (id) on delete cascade,

  review_date            date not null default current_date,
  kondisi_saat_ini       text,
  masih_terjadi          boolean,
  mitigasi_dilakukan     boolean,
  mitigasi_efektif       boolean,

  -- Nilai BARU (residual) — probabilitas/dampak/controllability terpisah dari inheren
  probabilitas_baru      int check (probabilitas_baru between 1 and 5),
  dampak_baru            int check (dampak_baru between 1 and 5),
  controllability_baru   int check (controllability_baru between 1 and 5),
  skor_residual          int generated always as (
                            case when probabilitas_baru is not null and dampak_baru is not null and controllability_baru is not null
                              then dampak_baru * probabilitas_baru * controllability_baru
                              else null end
                          ) stored,
  level_residual         text generated always as (
                            case
                              when probabilitas_baru is null or dampak_baru is null or controllability_baru is null then null
                              when (dampak_baru * probabilitas_baru * controllability_baru) >= 60 then 'sangat_tinggi'
                              when (dampak_baru * probabilitas_baru * controllability_baru) >= 30 then 'tinggi'
                              when (dampak_baru * probabilitas_baru * controllability_baru) >= 12 then 'sedang'
                              when (dampak_baru * probabilitas_baru * controllability_baru) >= 4  then 'rendah'
                              else 'sangat_rendah'
                            end
                          ) stored,

  keputusan              text check (keputusan is null or keputusan in (
                            'risiko_menurun', 'risiko_tetap', 'risiko_meningkat',
                            'risiko_dapat_ditutup', 'mitigasi_dilanjutkan', 'mitigasi_diperbaiki'
                          )),

  reviewed_by            uuid references auth.users (id),
  created_at             timestamptz not null default now()
);

comment on table public.risk_reviews is
  'Review ulang risiko + Risiko Residual (probabilitas/dampak/controllability BARU, disimpan terpisah dari risk_assessments/inheren) — poin 18-19.';

-- ============================================================================
-- 7. ATTACHMENT — risk_attachments (metadata; file fisik di Supabase Storage)
-- ============================================================================
create table if not exists public.risk_attachments (
  id          uuid primary key default gen_random_uuid(),
  risk_id     uuid not null references public.risks (id) on delete cascade,
  filename    text not null,
  storage_key text not null,             -- path di bucket 'risk-attachments'
  mime_type   text,
  size_bytes  bigint,
  uploaded_by uuid references auth.users (id),
  created_at  timestamptz not null default now()
);

comment on table public.risk_attachments is
  'Metadata bukti pendukung (foto, dokumen) di bucket Storage risk-attachments.';

-- ============================================================================
-- 8. RIWAYAT STATUS — risk_history (poin 16: riwayat tidak dihapus)
-- ============================================================================
create table if not exists public.risk_history (
  id            uuid primary key default gen_random_uuid(),
  risk_id       uuid not null references public.risks (id) on delete cascade,
  from_status   text,
  to_status     text not null,
  changed_by    uuid references auth.users (id),
  note          text,
  created_at    timestamptz not null default now()
);

comment on table public.risk_history is
  'Riwayat perubahan status per risiko — risiko yang sudah "Ditutup" tidak dihapus, riwayat tetap tersimpan (poin 16).';

-- ============================================================================
-- 9. INTEGRASI IKP -> RISIKO (poin 22) — FK opsional, additive terhadap
--    ikp_incidents jika modul IKP sudah terpasang. Dibuat sebagai DO block
--    supaya tidak error bila tabel ikp_incidents belum ada.
-- ============================================================================
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'ikp_incidents') then
    alter table public.risks
      add constraint fk_risks_source_ikp_incident
      foreign key (source_ikp_incident_id) references public.ikp_incidents (id) on delete set null;
  end if;
exception when duplicate_object then null;
end $$;

-- ============================================================================
-- 10. INDEXES
-- ============================================================================
create index if not exists idx_risks_year on public.risks (risk_year);
create index if not exists idx_risks_status on public.risks (status);
create index if not exists idx_risks_unit on public.risks (unit_lokasi);
create index if not exists idx_risks_category on public.risks (category);
create index if not exists idx_risks_owner on public.risks (risk_owner_id);
create index if not exists idx_risks_created_by on public.risks (created_by);
create index if not exists idx_risks_identified_date on public.risks (identified_date desc);

create index if not exists idx_risk_assessments_risk on public.risk_assessments (risk_id);
create index if not exists idx_risk_assessments_level_skor on public.risk_assessments (level_skor);
create index if not exists idx_risk_assessments_skor on public.risk_assessments (skor_risiko desc);

create index if not exists idx_risk_mitigations_risk on public.risk_mitigations (risk_id);
create index if not exists idx_risk_mitigations_status on public.risk_mitigations (status);
create index if not exists idx_risk_mitigations_pic on public.risk_mitigations (pic_id);
create index if not exists idx_risk_mitigations_target on public.risk_mitigations (target_penyelesaian);

create index if not exists idx_risk_monitorings_risk on public.risk_monitorings (risk_id);
create index if not exists idx_risk_reviews_risk on public.risk_reviews (risk_id);
create index if not exists idx_risk_attachments_risk on public.risk_attachments (risk_id);
create index if not exists idx_risk_history_risk on public.risk_history (risk_id);

create index if not exists idx_audit_logs_entity_risk on public.audit_logs (entity_type, entity_id) where entity_type = 'risks';

-- ============================================================================
-- 11. AUTOMATIC NUMBERING — RSK-YYYY-000001, aman untuk concurrent insert
-- ============================================================================
create table if not exists public.risk_report_counters (
  year        int primary key,
  last_number int not null default 0
);

create or replace function public.generate_risk_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_year int := coalesce(new.risk_year, extract(year from now())::int);
  next_number int;
begin
  if new.risk_code is not null and new.risk_code <> '' then
    return new;
  end if;

  if new.risk_year is null then
    new.risk_year := cur_year;
  end if;

  insert into public.risk_report_counters (year, last_number)
  values (cur_year, 1)
  on conflict (year) do update set last_number = public.risk_report_counters.last_number + 1
  returning last_number into next_number;

  new.risk_code := 'RSK-' || cur_year::text || '-' || lpad(next_number::text, 6, '0');
  return new;
end;
$$;

drop trigger if exists trg_risks_code on public.risks;
create trigger trg_risks_code
  before insert on public.risks
  for each row execute function public.generate_risk_code();

-- ============================================================================
-- 12. updated_at TRIGGERS (reuse fungsi set_updated_at() dari migration.sql)
-- ============================================================================
drop trigger if exists trg_risks_updated_at on public.risks;
create trigger trg_risks_updated_at
  before update on public.risks
  for each row execute function public.set_updated_at();

drop trigger if exists trg_risk_assessments_updated_at on public.risk_assessments;
create trigger trg_risk_assessments_updated_at
  before update on public.risk_assessments
  for each row execute function public.set_updated_at();

drop trigger if exists trg_risk_mitigations_updated_at on public.risk_mitigations;
create trigger trg_risk_mitigations_updated_at
  before update on public.risk_mitigations
  for each row execute function public.set_updated_at();

-- Riwayat status otomatis (poin 16) — dicatat setiap kali kolom status berubah.
create or replace function public.log_risk_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.risk_history (risk_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, new.risk_owner_id);
  elsif (tg_op = 'INSERT') then
    insert into public.risk_history (risk_id, from_status, to_status)
    values (new.id, null, new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_risks_status_history on public.risks;
create trigger trg_risks_status_history
  after insert or update on public.risks
  for each row execute function public.log_risk_status_change();

-- Tandai 'terlambat' otomatis kalau target_penyelesaian lewat dan status
-- belum selesai. Dipanggil dari aplikasi saat memuat daftar mitigasi
-- (lihat riskData.ts), bukan cron job — sama seperti pola mark_overdue_ikp_actions.
create or replace function public.mark_overdue_risk_mitigations()
returns void
language sql
security definer
set search_path = public
as $$
  update public.risk_mitigations
  set status = 'terlambat'
  where target_penyelesaian < current_date
    and status in ('belum_dimulai', 'berjalan');
$$;

-- ============================================================================
-- 13. ROLE HELPER — perluasan pola is_admin()/is_ikp_reviewer() untuk peran Risiko
-- ============================================================================
create or replace function public.has_risk_role(role_name text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'admin' or role_name = any(risk_roles))
  );
$$;

-- "Reviewer" = boleh melihat & mengelola semua risiko (bukan hanya miliknya)
create or replace function public.is_risk_reviewer()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'admin' or risk_roles && array['manajemen', 'pj_mutu', 'direktur'])
  );
$$;

create or replace function public.is_risk_owner_of(p_risk_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.risks
    where id = p_risk_id and risk_owner_id = auth.uid()
  );
$$;

-- ============================================================================
-- 14. ROW LEVEL SECURITY
-- ============================================================================

-- ── risks ────────────────────────────────────────────────────────────
alter table public.risks enable row level security;

drop policy if exists "risks_select" on public.risks;
create policy "risks_select"
  on public.risks for select
  to authenticated
  using (
    created_by = auth.uid()
    or risk_owner_id = auth.uid()
    or public.is_risk_reviewer()
  );

drop policy if exists "risks_insert" on public.risks;
create policy "risks_insert"
  on public.risks for insert
  to authenticated
  with check (created_by = auth.uid());

-- Staff unit hanya boleh mengubah risiko yang diusulkannya SELAGI draft;
-- reviewer (manajemen/pj_mutu/direktur/admin) atau risk owner boleh mengubah kapan saja.
drop policy if exists "risks_update" on public.risks;
create policy "risks_update"
  on public.risks for update
  to authenticated
  using (
    (created_by = auth.uid() and status = 'draft')
    or risk_owner_id = auth.uid()
    or public.is_risk_reviewer()
  )
  with check (
    (created_by = auth.uid())
    or risk_owner_id = auth.uid()
    or public.is_risk_reviewer()
  );

-- Soft delete via status='ditutup' adalah jalur normal; DELETE fisik dibatasi admin saja (poin 37).
drop policy if exists "risks_delete" on public.risks;
create policy "risks_delete"
  on public.risks for delete
  to authenticated
  using (public.is_admin());

-- ── risk_assessments ───────────────────────────────────────────────────
alter table public.risk_assessments enable row level security;

drop policy if exists "risk_assessments_select" on public.risk_assessments;
create policy "risk_assessments_select"
  on public.risk_assessments for select
  to authenticated
  using (
    public.is_risk_reviewer()
    or public.is_risk_owner_of(risk_id)
    or exists (select 1 from public.risks r where r.id = risk_id and r.created_by = auth.uid())
  );

drop policy if exists "risk_assessments_write" on public.risk_assessments;
create policy "risk_assessments_write"
  on public.risk_assessments for all
  to authenticated
  using (public.is_risk_reviewer() or public.is_risk_owner_of(risk_id))
  with check (public.is_risk_reviewer() or public.is_risk_owner_of(risk_id));

-- ── risk_mitigations ───────────────────────────────────────────────────
alter table public.risk_mitigations enable row level security;

drop policy if exists "risk_mitigations_select" on public.risk_mitigations;
create policy "risk_mitigations_select"
  on public.risk_mitigations for select
  to authenticated
  using (
    public.is_risk_reviewer()
    or pic_id = auth.uid()
    or public.is_risk_owner_of(risk_id)
    or exists (select 1 from public.risks r where r.id = risk_id and r.created_by = auth.uid())
  );

drop policy if exists "risk_mitigations_insert" on public.risk_mitigations;
create policy "risk_mitigations_insert"
  on public.risk_mitigations for insert
  to authenticated
  with check (public.is_risk_reviewer() or public.is_risk_owner_of(risk_id));

-- PIC boleh update progress miliknya sendiri; reviewer/risk owner boleh semua field.
drop policy if exists "risk_mitigations_update" on public.risk_mitigations;
create policy "risk_mitigations_update"
  on public.risk_mitigations for update
  to authenticated
  using (public.is_risk_reviewer() or public.is_risk_owner_of(risk_id) or pic_id = auth.uid())
  with check (public.is_risk_reviewer() or public.is_risk_owner_of(risk_id) or pic_id = auth.uid());

drop policy if exists "risk_mitigations_delete" on public.risk_mitigations;
create policy "risk_mitigations_delete"
  on public.risk_mitigations for delete
  to authenticated
  using (public.is_risk_reviewer());

-- ── risk_monitorings ───────────────────────────────────────────────────
alter table public.risk_monitorings enable row level security;

drop policy if exists "risk_monitorings_select" on public.risk_monitorings;
create policy "risk_monitorings_select"
  on public.risk_monitorings for select
  to authenticated
  using (
    public.is_risk_reviewer()
    or public.is_risk_owner_of(risk_id)
    or exists (select 1 from public.risks r where r.id = risk_id and r.created_by = auth.uid())
  );

drop policy if exists "risk_monitorings_insert" on public.risk_monitorings;
create policy "risk_monitorings_insert"
  on public.risk_monitorings for insert
  to authenticated
  with check (public.is_risk_reviewer() or public.is_risk_owner_of(risk_id));

drop policy if exists "risk_monitorings_delete" on public.risk_monitorings;
create policy "risk_monitorings_delete"
  on public.risk_monitorings for delete
  to authenticated
  using (public.is_risk_reviewer());

-- ── risk_reviews ───────────────────────────────────────────────────────
alter table public.risk_reviews enable row level security;

drop policy if exists "risk_reviews_select" on public.risk_reviews;
create policy "risk_reviews_select"
  on public.risk_reviews for select
  to authenticated
  using (
    public.is_risk_reviewer()
    or public.is_risk_owner_of(risk_id)
    or exists (select 1 from public.risks r where r.id = risk_id and r.created_by = auth.uid())
  );

drop policy if exists "risk_reviews_write" on public.risk_reviews;
create policy "risk_reviews_write"
  on public.risk_reviews for all
  to authenticated
  using (public.is_risk_reviewer() or public.is_risk_owner_of(risk_id))
  with check (public.is_risk_reviewer() or public.is_risk_owner_of(risk_id));

-- ── risk_attachments ───────────────────────────────────────────────────
alter table public.risk_attachments enable row level security;

drop policy if exists "risk_attachments_select" on public.risk_attachments;
create policy "risk_attachments_select"
  on public.risk_attachments for select
  to authenticated
  using (
    public.is_risk_reviewer()
    or public.is_risk_owner_of(risk_id)
    or exists (select 1 from public.risks r where r.id = risk_id and r.created_by = auth.uid())
  );

drop policy if exists "risk_attachments_insert" on public.risk_attachments;
create policy "risk_attachments_insert"
  on public.risk_attachments for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and (
      public.is_risk_reviewer()
      or public.is_risk_owner_of(risk_id)
      or exists (select 1 from public.risks r where r.id = risk_id and r.created_by = auth.uid())
    )
  );

drop policy if exists "risk_attachments_delete" on public.risk_attachments;
create policy "risk_attachments_delete"
  on public.risk_attachments for delete
  to authenticated
  using (public.is_admin() or uploaded_by = auth.uid());

-- ── risk_history (read-only dari aplikasi; ditulis hanya oleh trigger) ─
alter table public.risk_history enable row level security;

drop policy if exists "risk_history_select" on public.risk_history;
create policy "risk_history_select"
  on public.risk_history for select
  to authenticated
  using (
    public.is_risk_reviewer()
    or public.is_risk_owner_of(risk_id)
    or exists (select 1 from public.risks r where r.id = risk_id and r.created_by = auth.uid())
  );

-- ── Supabase Storage bucket + policy untuk attachment ────────────────────
insert into storage.buckets (id, name, public)
values ('risk-attachments', 'risk-attachments', false)
on conflict (id) do nothing;

drop policy if exists "risk_storage_select" on storage.objects;
create policy "risk_storage_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'risk-attachments'
    and (public.is_risk_reviewer() or owner = auth.uid())
  );

drop policy if exists "risk_storage_insert" on storage.objects;
create policy "risk_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'risk-attachments');

drop policy if exists "risk_storage_delete" on storage.objects;
create policy "risk_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'risk-attachments'
    and (public.is_admin() or owner = auth.uid())
  );

-- ============================================================================
-- 15. REALTIME
-- ============================================================================
do $$
begin
  alter publication supabase_realtime add table public.risks;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.risk_assessments;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.risk_mitigations;
exception when duplicate_object then null;
end $$;

-- ============================================================================
-- 16. SEED DATA — HANYA dari data eksplisit di "RISK REGISTER .pdf" (poin 24
--     & 45.8: dilarang mengarang nilai risiko baru). Diisi sebagai contoh
--     awal Risk Register tahun 2023 per unit yang disebutkan dokumen instruksi.
--     Jalankan blok ini SEKALI SAJA (idempotent lewat risk_code unik) —
--     ganti/comment-out bagian ini bila RS tidak ingin memakai data contoh.
-- ============================================================================
do $$
declare
  v_risk_id uuid;
  seed_row record;
begin
  for seed_row in
    select * from (values
      ('IGD', 'igd', 'Gagal melakukan pemasangan infus', 'Kurangnya keterampilan petugas medis atau kurangnya konsentrasi akibat long shift', 'Komplain pasien', 2, 3, 2, 'Kepala Keperawatan'),
      ('IGD', 'igd', 'Penumpukan pasien', 'Belum adanya alur dan lama waktu tunggu pasien di IGD sebelum dilakukan transfer ke ruangan atau RS rujukan', 'Komplain pasien', 3, 4, 1, 'Kepala Keperawatan'),
      ('IGD', 'igd', 'Salah mentransfer pasien ke ruangan', 'Pasien tidak dilakukan identifikasi', 'Pasien komplain, pasien cidera', 2, 1, 1, 'Kepala Keperawatan'),
      ('IGD', 'igd', 'Kesalahan tindakan medis', 'Miscommunication antar petugas', 'Pasien komplain, pasien cidera', 4, 3, 1, 'Kepala Keperawatan'),
      ('PPI', 'ppi', 'Safety box tidak tertutup sempurna', 'Perakitan safety box yang tidak tepat', 'Tertusuk jarum, limbah medis berserakan', 4, 1, 1, 'IPCN'),
      ('PPI', 'ppi', 'Tempat sampah infeksius penuh', 'Tidak ada pengawasan dari cleaning service', 'Kontaminasi sumber infeksi', 3, 4, 1, 'IPCN'),
      ('PPI', 'ppi', 'Petugas tidak menerapkan 6 langkah cuci tangan', 'Petugas lupa tahapan cuci tangan menurut WHO dan Five Moment', 'Penyebaran infeksi nosokomial', 4, 4, 1, 'IPCN'),
      ('Farmasi', 'farmasi', 'Salah pemberian obat pada pasien', 'Tidak dilakukan identifikasi pasien', 'Pasien dapat keracunan, memperburuk keadaan/kesakitan pasien', 4, 3, 3, 'Ka Unit Farmasi'),
      ('Farmasi', 'farmasi', 'Obat/cairan infus kadaluarsa', 'Tidak rutin dilakukan pengisian kartu kendali dan pengecekan kadaluarsa', 'Pasien mendapatkan obat/terapi cairan yang telah kadaluarsa', 4, 3, 2, 'Kabid Jangmed'),
      ('Farmasi', 'farmasi', 'Penempatan obat/BMHP/alkes tidak beraturan', 'Ruangan farmasi kecil, tidak ada tempat penyimpanan khusus', 'Kerusakan dan kekeliruan pengambilan obat/barang/alat kesehatan', 4, 3, 2, 'Kabid Jangmed'),
      ('Laboratorium', 'laboratorium', 'Kesalahan jenis pemeriksaan laboratorium', 'Tidak dilakukan identifikasi pasien, pengisian form pemeriksaan tidak lengkap', 'Penatalaksanaan pasien terhambat, cidera, komplain pasien', 3, 2, 1, 'Kabid Jangmed'),
      ('Laboratorium', 'laboratorium', 'Kerusakan alat pemeriksaan laboratorium', 'Tidak dilakukan pemeliharaan rutin, gangguan listrik', 'Penatalaksanaan pasien terhambat, cidera, komplain pasien', 4, 3, 1, 'Kabid Jangmed'),
      ('Radiologi', 'radiologi', 'Kesalahan jenis pemeriksaan radiologi', 'Tidak dilakukan identifikasi pasien, pengisian form pemeriksaan tidak lengkap', 'Penatalaksanaan pasien terhambat, cidera, komplain pasien', 3, 2, 3, 'Kabid Jangmed'),
      ('Radiologi', 'radiologi', 'Kerusakan alat pemeriksaan radiologi', 'Tidak dilakukan pemeliharaan rutin, gangguan listrik', 'Penatalaksanaan pasien terhambat, cidera, komplain pasien', 4, 4, 2, 'Kabid Jangmed'),
      ('Gizi', 'gizi', 'Kesalahan pemberian diet', 'Dokter PJP tidak menginformasikan kondisi pasien kepada ahli gizi', 'Memperburuk kondisi pasien', 4, 3, 3, 'Manajer Medis dan Gizi'),
      ('Gizi', 'gizi', 'Makanan tidak matang', 'Petugas kurang memahami teknik pemasakan', 'Komplain pasien', 3, 2, 4, 'Gizi (jurumasak)'),
      ('Gizi', 'gizi', 'Alat makan tercampur', 'Petugas tidak teliti', 'Kontaminasi alat makan', 3, 3, 4, 'Gizi (pramusaji)'),
      ('Gizi', 'gizi', 'Gas bocor atau kebakaran akibat gas', 'Penempatan gas yang tidak sesuai standar (gas masih ditempatkan di dalam ruangan)', 'Kebakaran', 4, 2, 3, 'K3 RS, IPSRS dan Security'),
      ('Gizi', 'gizi', 'Limbah pembuangan dari pencucian mampet', 'Tidak adanya grease trap pada proses pembuangan limbah dari gizi', 'IPAL dari RS dapat merusak lingkungan masyarakat, ruangan gizi berbau', 4, 3, 3, 'K3 RS, IPSRS dan Security'),
      ('Laundry/Linen', 'laundry_linen', 'Kontaminasi dari jaringan tubuh pasien yang infeksius', 'Tidak ada pengelolaan limbah patologi sebelum dilakukan pencucian linen', 'Petugas dapat terinfeksi', 4, 2, 2, 'Manajer Medis'),
      ('Kesling', 'kesling', 'Mesin IPAL rusak', 'Kurangnya pengawasan maintenance', 'Tidak berjalannya IPAL rumah sakit dan berdampak terhadap buangan air limbah pada area sekitar masyarakat', 4, 1, 4, 'IPSRS dan Cleaning Service'),
      ('Kesling', 'kesling', 'Kualitas air bersih menurun', 'Tidak adanya penjadwalan pembersihan toren', 'Pengaruh terhadap kualitas air bersih rumah sakit dan hasil pemeriksaan mikrobiologi/kimia', 4, 3, 5, 'IPSRS dan Cleaning Service'),
      ('Kesling', 'kesling', 'Petugas membuang limbah jarum suntik bukan pada safety box', 'Habisnya stok safety box', 'Petugas tertusuk jarum', 4, 2, 1, 'IPSRS'),
      ('Keamanan', 'keamanan', 'Hp/benda berharga pasien hilang', 'Kurangnya SDM security', 'Kepuasan pasien menurun', 3, 2, 3, 'Bagian Keamanan'),
      ('IT', 'it', 'Aplikasi absensi tidak bisa digunakan', 'Tidak dilakukan maintenance secara rutin', 'Tidak bisa absen, data absensi hilang', 2, 3, 4, 'IT'),
      ('Perinatologi', 'pelayanan_klinis', 'Infant warmer rusak', 'Tidak dilakukan maintenance secara berkala', 'Bayi hipotermi', 4, 2, 2, 'Kordinator IPSRS'),
      ('Perinatologi', 'keselamatan_pasien', 'Bayi asfiksia', 'Saturasi oksigen bayi, T-Piece resusitator tidak ada', 'Bayi meninggal', 5, 2, 2, 'Manajer Medis')
    ) as t(unit_lokasi, category, risiko, sebab_insiden, efek_dampak, dampak, probabilitas, controllability, risk_owner_name)
  loop
    insert into public.risks (
      risk_year, unit_lokasi, category, risiko, sebab_insiden, efek_dampak,
      status, risk_owner_name, created_by
    )
    values (
      2023, seed_row.unit_lokasi, seed_row.category, seed_row.risiko, seed_row.sebab_insiden, seed_row.efek_dampak,
      'dianalisis', seed_row.risk_owner_name, null
    )
    returning id into v_risk_id;

    insert into public.risk_assessments (risk_id, probabilitas, dampak, controllability)
    values (v_risk_id, seed_row.probabilitas, seed_row.dampak, seed_row.controllability);
  end loop;
exception when unique_violation then
  -- Seed sudah pernah dijalankan sebelumnya — lewati tanpa error.
  null;
end $$;

-- ============================================================================
-- 17. SETUP MANUAL — jalankan sekali setelah user terkait sudah signup
-- ============================================================================
-- Contoh memberi peran Risiko tambahan ke seorang user:
--
--   update public.profiles
--   set risk_roles = array['pj_mutu']
--   where email = 'pj.mutu@example.com';
--
-- Nilai risk_roles yang dikenali aplikasi: 'manajemen', 'pj_mutu', 'risk_owner',
-- 'staff_unit', 'direktur'. User dengan role = 'admin' (existing) otomatis
-- punya semua akses reviewer Risiko.
