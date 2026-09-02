-- ============================================================================
-- INMrsds — Modul Survey Kepuasan Pasien
-- Migration tambahan, dijalankan SETELAH supabase/migration.sql dan
-- supabase/migration_custom_indicators.sql (dibutuhkan untuk integrasi
-- otomatis ke Indikator Mutu — bagian 9 di bawah). Boleh dijalankan sebelum
-- atau sesudah migration_budaya.sql/migration_ikp.sql/migration_risk.sql —
-- tidak saling bergantung kecuali sama-sama menambah kolom pada
-- `profiles`/`audit_logs` (additive, aman).
-- Aman dijalankan berulang (IF NOT EXISTS / idempotent DO blocks).
--
-- Instrumen: 9 unsur pelayanan sesuai Permenpan RB No. 14/2017 (SKM/IKM),
-- skala 1-4, sama seperti pada "INM 2025 MONEV FORM BARU.xlsx" yang
-- dilampirkan. Rumus dan tabel konversi (25-64,99=D, 65-76,60=C,
-- 76,61-88,30=B, 88,31-100=A) mengikuti persis file sumber tersebut.
--
-- PRINSIP UTAMA (mengikuti dokumen instruksi):
--   - 1 perangkat = boleh mengisi survey berkali-kali (TIDAK ada pembatasan
--     device fingerprint/IP/cookie/localStorage/session di level DB).
--   - Nama responden OPSIONAL (nullable, bukan primary/unique key).
--   - Setiap submit = 1 baris response baru, langsung final (tidak ada sesi
--     "in_progress" multi-halaman seperti modul Budaya — pengisian 9 unsur
--     dikirim sekaligus dalam SATU pemanggilan RPC, sesuai instruksi bahwa
--     alur harus sesederhana mungkin untuk pasien).
--   - Reuse tabel `custom_indicator_measurements` (modul Master Indikator
--     Mutu Custom yang sudah ada) sebagai tujuan akhir data, BUKAN membuat
--     sistem indikator baru yang berdiri sendiri.
-- ============================================================================

-- ============================================================================
-- 0. PERLUASAN ADDITIVE PADA TABEL EXISTING
-- ============================================================================

alter table public.profiles
  add column if not exists kepuasan_roles text[] not null default '{}'::text[];

comment on column public.profiles.kepuasan_roles is
  'Peran tambahan khusus modul Survey Kepuasan Pasien: admin_mutu, unit. ''admin'' (role dasar) otomatis punya semua hak modul ini.';

-- CATATAN: daftar ini HARUS memuat seluruh nilai `type` yang sudah pernah
-- ditulis oleh migrasi modul lain di project Anda (migration_ikp.sql,
-- migration_risk.sql, migration_budaya.sql, migration_usulan_indikator.sql,
-- migration_custom_indicators.sql), bukan hanya subset yang relevan untuk
-- modul kepuasan — karena constraint ini menimpa (drop+recreate) constraint
-- yang sama di tabel `audit_logs` yang dipakai bersama semua modul. Bila
-- Anda menambah migrasi baru lain di kemudian hari yang memakai nilai
-- `type` baru, tambahkan juga di sini (dan sebaliknya).
alter table public.audit_logs drop constraint if exists audit_logs_type_check;
alter table public.audit_logs add constraint audit_logs_type_check
  check (type in ('block', 'login', 'input', 'mapping', 'ikp', 'risk', 'budaya', 'uimu', 'custom_indicator', 'kepuasan'));

-- ============================================================================
-- 1. SURVEY
-- ============================================================================

create table if not exists public.kepuasan_surveys (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  description            text,
  -- Kode unit memakai daftar UnitId yang SUDAH ADA di aplikasi
  -- (src/types/index.ts: IGD, Rawat Jalan, Rawat Inap, ICU, Kamar Operasi,
  -- VK, Laboratorium, Radiologi, Farmasi) atau 'all' untuk Semua Unit —
  -- TIDAK membuat master unit baru (reuse, sesuai instruksi bagian 3 & 40
  -- dokumen acuan Anda). Bila 'all', pasien memilih unit sendiri saat mengisi.
  unit_id                text not null default 'all',
  start_date             date not null,
  end_date               date not null,
  target_respondents     int,                          -- null = tidak dibatasi
  survey_mode            text not null default 'online' check (survey_mode in ('online', 'kiosk', 'both')),
  status                 text not null default 'draft' check (status in ('draft', 'aktif', 'ditutup', 'arsip')),
  instrument_version     text not null default 'KEPUASAN-PASIEN-v1.0',

  -- Target & klasifikasi mutu — dikonfigurasi per survei (bagian 18/19
  -- dokumen: "batas klasifikasi dikonfigurasi, bukan hard-coded"). Default
  -- mengikuti Permenpan RB 14/2017 persis seperti file Excel sumber.
  target_value           numeric not null default 76.61,
  target_operator        text not null default 'gt' check (target_operator in ('gt', 'gte', 'lt', 'lte', 'eq')),
  classification_thresholds jsonb not null default '[
    {"grade": "D", "label": "Tidak baik",  "min": 25.00, "max": 64.99},
    {"grade": "C", "label": "Kurang baik", "min": 65.00, "max": 76.60},
    {"grade": "B", "label": "Baik",        "min": 76.61, "max": 88.30},
    {"grade": "A", "label": "Sangat baik", "min": 88.31, "max": 100.00}
  ]'::jsonb,

  -- Mode kiosk (bagian 16/38): reset otomatis ke form kosong N detik
  -- setelah submit berhasil, dijalankan sepenuhnya di sisi klien.
  kiosk_reset_seconds    int not null default 5,

  -- Tautan opsional ke Master Indikator Mutu Custom (bagian 26-28) — hasil
  -- IKM periode ini otomatis didorong ke custom_indicator_measurements pada
  -- indikator yang ditunjuk di sini. NULL = survei berjalan berdiri sendiri
  -- tanpa didorong ke indikator manapun (admin dapat menautkan belakangan).
  linked_indicator_id    uuid references public.custom_indicators (id) on delete set null,

  created_by             uuid references auth.users (id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (end_date >= start_date)
);

comment on table public.kepuasan_surveys is
  'Satu baris = satu periode Survey Kepuasan Pasien untuk satu unit (atau Semua Unit). Instrumen 9 unsur Permenpan RB 14/2017, skala 1-4.';

-- ============================================================================
-- 2. DISTRIBUSI (LINK / QR / ACCESS CODE) — pola identik budaya_survey_tokens
-- ============================================================================

create table if not exists public.kepuasan_survey_tokens (
  id          uuid primary key default gen_random_uuid(),
  survey_id   uuid not null references public.kepuasan_surveys (id) on delete cascade,
  token       text unique not null,
  kind        text not null check (kind in ('public_link', 'qr', 'access_code')),
  -- Boleh membatasi token ke satu unit (mis. tablet khusus Farmasi) ketika
  -- survei induk unit_id = 'all'. NULL = ikut unit_id survei.
  unit_id     text,
  max_uses    int,          -- NULL = tak terbatas — INI SENGAJA TIDAK DIPAKAI
                             -- untuk membatasi satu perangkat (bagian 14), hanya
                             -- opsional untuk kasus lain (mis. link sekali pakai).
  used_count  int not null default 0,
  expires_at  timestamptz,
  created_by  uuid references auth.users (id),
  created_at  timestamptz not null default now()
);

comment on table public.kepuasan_survey_tokens is
  'Token distribusi (link publik / QR / kode akses). used_count TIDAK dipakai untuk mencegah pengisian berulang dari perangkat yang sama — hanya penghitung pemakaian link.';

-- ============================================================================
-- 3. RESPONSE — satu baris = satu pengisian pasien, SUDAH FINAL saat insert
--    (tidak ada status in_progress; lihat fungsi kepuasan_submit_response di
--    bagian 7 — seluruh 9 unsur dikirim sekaligus dalam satu transaksi).
-- ============================================================================

create table if not exists public.kepuasan_responses (
  id                uuid primary key default gen_random_uuid(),
  response_code     text unique not null,       -- 'KP-000001', dst. — lihat bagian 6
  survey_id         uuid not null references public.kepuasan_surveys (id) on delete cascade,
  token_id          uuid references public.kepuasan_survey_tokens (id) on delete set null,
  unit_id           text not null,              -- disalin dari survei, atau dipilih pasien bila survei 'all'

  respondent_name   text,                       -- NULLABLE — nama OPSIONAL (bagian 8), bukan kunci apapun

  -- 9 unsur pelayanan, skala 1 (Tidak baik) .. 4 (Sangat baik) — wajib diisi
  -- semua (bagian 11/36), urutan & label persis Permenpan RB 14/2017.
  u1_persyaratan            smallint not null check (u1_persyaratan between 1 and 4),
  u2_prosedur               smallint not null check (u2_prosedur between 1 and 4),
  u3_waktu                  smallint not null check (u3_waktu between 1 and 4),
  u4_biaya                  smallint not null check (u4_biaya between 1 and 4),
  u5_produk_layanan         smallint not null check (u5_produk_layanan between 1 and 4),
  u6_kompetensi_pelaksana   smallint not null check (u6_kompetensi_pelaksana between 1 and 4),
  u7_perilaku_pelaksana     smallint not null check (u7_perilaku_pelaksana between 1 and 4),
  u8_penanganan_pengaduan   smallint not null check (u8_penanganan_pengaduan between 1 and 4),
  u9_sarana_prasarana       smallint not null check (u9_sarana_prasarana between 1 and 4),

  kritik_saran        text,                     -- opsional (bagian 12)
  willing_to_contact   boolean not null default false,
  contact_phone       text,                     -- opsional, hanya relevan bila willing_to_contact

  -- Tindak lanjut kritik/saran (bagian 32) — TIDAK memengaruhi perhitungan IKM.
  followup_status     text not null default 'belum_ditindaklanjuti'
                       check (followup_status in ('belum_ditindaklanjuti', 'dalam_proses', 'selesai')),
  followup_pic        uuid references auth.users (id),
  followup_note        text,
  followup_date        date,

  source              text not null default 'online' check (source in ('online', 'kiosk', 'import')),
  is_valid            boolean not null default true,   -- baris import yang gagal validasi TIDAK dimasukkan (bagian 30), kolom ini untuk soft-invalidate manual bila perlu
  submitted_at         timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.kepuasan_responses is
  'Satu baris = satu pengisian survei kepuasan pasien, final sejak insert. respondent_name NULLABLE dan TIDAK PERNAH dipakai untuk membatasi pengisian ulang dari perangkat yang sama.';

-- ============================================================================
-- 4. HASIL AGREGAT PER PERIODE (dihitung ulang oleh aplikasi — lihat
--    kepuasanData.ts `recomputeKepuasanPeriodResult()` — BUKAN diisi manual)
-- ============================================================================

create table if not exists public.kepuasan_period_results (
  id                 uuid primary key default gen_random_uuid(),
  survey_id          uuid not null references public.kepuasan_surveys (id) on delete cascade,
  -- unit_id = NULL berarti ringkasan gabungan seluruh unit pada survei ini;
  -- baris tambahan per unit_id spesifik dibuat ketika survei unit_id='all'
  -- dan pasien memilih unit berbeda-beda, supaya dashboard bisa difilter
  -- per unit (bagian 21/23/29).
  unit_id            text,
  total_respondents  int not null default 0,
  unsur_averages     jsonb not null default '{}'::jsonb,   -- { "u1_persyaratan": 3.40, ... } — NRR per unsur
  nilai_indeks       numeric(6, 4),                        -- NI = rata-rata NRR tertimbang (bobot 1/9 tiap unsur)
  ikm                numeric(6, 2),                        -- IKM/NIK = NI x 25
  grade              text,                                 -- 'A'..'D', dari classification_thresholds survei
  grade_label        text,                                 -- 'Sangat baik', dst.
  status_capaian     text check (status_capaian in ('tercapai', 'tidak_tercapai')),
  computed_at        timestamptz not null default now(),
  unique (survey_id, unit_id)
);

comment on table public.kepuasan_period_results is
  'Ringkasan per periode (dan opsional per unit). Dasar Dashboard, trend Monev, dan snapshot yang didorong ke custom_indicator_measurements.';

-- ============================================================================
-- 5. INDEXES
-- ============================================================================

create index if not exists idx_kepuasan_surveys_status on public.kepuasan_surveys (status);
create index if not exists idx_kepuasan_surveys_unit on public.kepuasan_surveys (unit_id);
create index if not exists idx_kepuasan_tokens_survey on public.kepuasan_survey_tokens (survey_id);
create index if not exists idx_kepuasan_responses_survey on public.kepuasan_responses (survey_id);
create index if not exists idx_kepuasan_responses_unit on public.kepuasan_responses (unit_id);
create index if not exists idx_kepuasan_responses_submitted on public.kepuasan_responses (submitted_at);
create index if not exists idx_kepuasan_responses_followup on public.kepuasan_responses (followup_status);
create index if not exists idx_kepuasan_period_results_survey on public.kepuasan_period_results (survey_id);

-- ============================================================================
-- 6. RESPONSE CODE GENERATOR (bagian 3/24 — 'KP-00001', dst., global berurut)
-- ============================================================================

create sequence if not exists public.kepuasan_response_code_seq;

create or replace function public.kepuasan_next_response_code()
returns text
language sql
as $$
  select 'KP-' || lpad(nextval('public.kepuasan_response_code_seq')::text, 6, '0');
$$;

-- ============================================================================
-- 7. updated_at TRIGGERS (reuse fungsi set_updated_at() dari migration.sql)
-- ============================================================================

drop trigger if exists trg_kepuasan_surveys_updated_at on public.kepuasan_surveys;
create trigger trg_kepuasan_surveys_updated_at
  before update on public.kepuasan_surveys
  for each row execute function public.set_updated_at();

drop trigger if exists trg_kepuasan_responses_updated_at on public.kepuasan_responses;
create trigger trg_kepuasan_responses_updated_at
  before update on public.kepuasan_responses
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 8. ROLE HELPERS — pola identik has_budaya_role()/is_budaya_reviewer()
-- ============================================================================

create or replace function public.has_kepuasan_role(role_name text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'admin' or role_name = any(kepuasan_roles))
  );
$$;

create or replace function public.is_kepuasan_reviewer()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'admin' or kepuasan_roles && array['admin_mutu', 'unit'])
  );
$$;

-- ============================================================================
-- 9. SUBMISSION PUBLIK AMAN (SECURITY DEFINER) — pola identik
--    budaya_start_session/budaya_submit_answer/budaya_complete_session, tapi
--    disederhanakan jadi SATU pemanggilan karena 9 unsur dikirim sekaligus
--    (bagian 14/36 dokumen: TIDAK boleh ada pembatasan per-perangkat, dan
--    setiap tombol Kirim Survey harus menghasilkan TEPAT SATU response baru).
-- ============================================================================

create or replace function public.kepuasan_get_public_survey(p_token text)
returns table (
  survey_id           uuid,
  name                text,
  description         text,
  unit_id             text,
  survey_mode         text,
  status              text,
  kiosk_reset_seconds int
)
language sql
security definer
stable
set search_path = public
as $$
  select s.id, s.name, s.description, s.unit_id, s.survey_mode, s.status, s.kiosk_reset_seconds
  from public.kepuasan_survey_tokens t
  join public.kepuasan_surveys s on s.id = t.survey_id
  where t.token = p_token
    and s.status = 'aktif'
    -- Dibandingkan dalam zona waktu Asia/Jakarta (bukan current_date server
    -- yang defaultnya UTC) supaya survei yang di-set mulai "hari ini" oleh
    -- admin di Indonesia langsung aktif, bukan baru aktif besok pagi UTC.
    and (now() at time zone 'Asia/Jakarta')::date between s.start_date and s.end_date
    and (t.expires_at is null or t.expires_at > now())
    and (t.max_uses is null or t.used_count < t.max_uses);
$$;

create or replace function public.kepuasan_submit_response(
  p_token               text,
  p_unit_id             text,
  p_respondent_name     text,
  p_u1                  smallint,
  p_u2                  smallint,
  p_u3                  smallint,
  p_u4                  smallint,
  p_u5                  smallint,
  p_u6                  smallint,
  p_u7                  smallint,
  p_u8                  smallint,
  p_u9                  smallint,
  p_kritik_saran        text,
  p_willing_to_contact  boolean,
  p_contact_phone       text,
  p_source              text
)
returns table (response_id uuid, response_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_survey_id   uuid;
  v_survey_unit text;
  v_token_id    uuid;
  v_effective_unit text;
  v_code        text;
  v_id          uuid;
begin
  select s.id, s.unit_id, t.id
    into v_survey_id, v_survey_unit, v_token_id
  from public.kepuasan_survey_tokens t
  join public.kepuasan_surveys s on s.id = t.survey_id
  where t.token = p_token
    and s.status = 'aktif'
    -- Dibandingkan dalam zona waktu Asia/Jakarta (bukan current_date server
    -- yang defaultnya UTC) supaya survei yang di-set mulai "hari ini" oleh
    -- admin di Indonesia langsung aktif, bukan baru aktif besok pagi UTC.
    and (now() at time zone 'Asia/Jakarta')::date between s.start_date and s.end_date
    and (t.expires_at is null or t.expires_at > now())
    and (t.max_uses is null or t.used_count < t.max_uses);

  if v_survey_id is null then
    raise exception 'Survei tidak ditemukan, tidak aktif, atau di luar periode pengisian.';
  end if;

  if p_u1 is null or p_u2 is null or p_u3 is null or p_u4 is null or p_u5 is null
     or p_u6 is null or p_u7 is null or p_u8 is null or p_u9 is null then
    raise exception 'Seluruh 9 unsur pelayanan wajib diisi.';
  end if;

  v_effective_unit := case when v_survey_unit = 'all' then coalesce(p_unit_id, 'all') else v_survey_unit end;
  v_code := public.kepuasan_next_response_code();

  insert into public.kepuasan_responses (
    response_code, survey_id, token_id, unit_id, respondent_name,
    u1_persyaratan, u2_prosedur, u3_waktu, u4_biaya, u5_produk_layanan,
    u6_kompetensi_pelaksana, u7_perilaku_pelaksana, u8_penanganan_pengaduan, u9_sarana_prasarana,
    kritik_saran, willing_to_contact, contact_phone, source
  ) values (
    v_code, v_survey_id, v_token_id, v_effective_unit, nullif(trim(p_respondent_name), ''),
    p_u1, p_u2, p_u3, p_u4, p_u5, p_u6, p_u7, p_u8, p_u9,
    nullif(trim(p_kritik_saran), ''), coalesce(p_willing_to_contact, false), nullif(trim(p_contact_phone), ''),
    coalesce(p_source, 'online')
  )
  returning id into v_id;

  update public.kepuasan_survey_tokens set used_count = used_count + 1 where id = v_token_id;

  return query select v_id, v_code;
end;
$$;

comment on function public.kepuasan_submit_response is
  'Satu-satunya jalur tulis untuk pengisian publik/anonim. SENGAJA TIDAK memeriksa perangkat/IP/cookie apapun — 1 perangkat boleh memanggil fungsi ini berkali-kali (bagian 14 dokumen instruksi). Setiap panggilan = 1 response baru.';

-- ============================================================================
-- 10. ROW LEVEL SECURITY
-- ============================================================================

alter table public.kepuasan_surveys enable row level security;
drop policy if exists "kepuasan_surveys_select" on public.kepuasan_surveys;
create policy "kepuasan_surveys_select" on public.kepuasan_surveys for select to authenticated using (true);
drop policy if exists "kepuasan_surveys_write" on public.kepuasan_surveys;
create policy "kepuasan_surveys_write" on public.kepuasan_surveys for all to authenticated
  using (public.is_kepuasan_reviewer()) with check (public.is_kepuasan_reviewer());

alter table public.kepuasan_survey_tokens enable row level security;
drop policy if exists "kepuasan_tokens_select" on public.kepuasan_survey_tokens;
create policy "kepuasan_tokens_select" on public.kepuasan_survey_tokens for select to authenticated
  using (public.is_kepuasan_reviewer());
drop policy if exists "kepuasan_tokens_write" on public.kepuasan_survey_tokens;
create policy "kepuasan_tokens_write" on public.kepuasan_survey_tokens for all to authenticated
  using (public.is_kepuasan_reviewer()) with check (public.is_kepuasan_reviewer());

-- Response mentah: TIDAK ada akses select/insert untuk anon/authenticated
-- biasa — satu-satunya jalur tulis publik adalah kepuasan_submit_response()
-- (bagian 9). Reviewer boleh SELECT (untuk daftar response/kritik-saran) dan
-- UPDATE (hanya untuk kolom tindak lanjut — ditegakkan di aplikasi, sama pola
-- dengan modul lain di repo ini) serta INSERT (dipakai oleh fitur Import Excel
-- bagian 30, yang berjalan sebagai user login, bukan lewat RPC publik).
alter table public.kepuasan_responses enable row level security;
drop policy if exists "kepuasan_responses_select" on public.kepuasan_responses;
create policy "kepuasan_responses_select" on public.kepuasan_responses for select to authenticated
  using (public.is_kepuasan_reviewer());
drop policy if exists "kepuasan_responses_insert" on public.kepuasan_responses;
create policy "kepuasan_responses_insert" on public.kepuasan_responses for insert to authenticated
  with check (public.is_kepuasan_reviewer() and source = 'import');
drop policy if exists "kepuasan_responses_update" on public.kepuasan_responses;
create policy "kepuasan_responses_update" on public.kepuasan_responses for update to authenticated
  using (public.is_kepuasan_reviewer()) with check (public.is_kepuasan_reviewer());

alter table public.kepuasan_period_results enable row level security;
drop policy if exists "kepuasan_period_results_select" on public.kepuasan_period_results;
create policy "kepuasan_period_results_select" on public.kepuasan_period_results for select to authenticated using (true);
drop policy if exists "kepuasan_period_results_write" on public.kepuasan_period_results;
create policy "kepuasan_period_results_write" on public.kepuasan_period_results for all to authenticated
  using (public.is_kepuasan_reviewer()) with check (public.is_kepuasan_reviewer());

-- Akses anon untuk halaman publik: HANYA lewat RPC SECURITY DEFINER di atas
-- (kepuasan_get_public_survey, kepuasan_submit_response) — TIDAK ada policy
-- select/insert langsung untuk role anon pada tabel manapun di modul ini,
-- supaya endpoint publik tidak bisa dipakai untuk membaca data pasien lain
-- (bagian 33 dokumen: keamanan public survey).

-- ============================================================================
-- 11. SEED — Master Indikator Mutu "Kepuasan Pasien" (bagian 26) —
--     HANYA dijalankan bila migration_custom_indicators.sql SUDAH ada
--     (tabel custom_indicators tersedia). Dibuat idempotent lewat kode unik.
-- ============================================================================

do $$
declare
  v_indicator_id uuid;
  v_exists       boolean;
begin
  if to_regclass('public.custom_indicators') is null then
    raise notice 'custom_indicators belum ada — lewati seed indikator Kepuasan Pasien (jalankan migration_custom_indicators.sql dulu jika ingin integrasi otomatis, bagian 26-28).';
    return;
  end if;

  select exists(select 1 from public.custom_indicators where code = 'KEPUASAN-PASIEN-RS') into v_exists;
  if v_exists then
    return;
  end if;

  insert into public.custom_indicators (
    code, name, description, purpose, indicator_type, category, status,
    is_all_units, is_comparable_across_units, is_permanent
  ) values (
    'KEPUASAN-PASIEN-RS', 'Kepuasan Pasien',
    'Indeks Kepuasan Masyarakat (IKM) terhadap pelayanan rumah sakit, dihitung otomatis dari Survey Kepuasan Pasien (9 unsur Permenpan RB 14/2017).',
    'Mengukur dan memantau tingkat kepuasan pasien terhadap pelayanan sebagai bagian dari indikator mutu prioritas rumah sakit.',
    'priority_rs', 'Kepuasan', 'active', true, true, true
  )
  returning id into v_indicator_id;

  insert into public.custom_indicator_versions (
    indicator_id, version_number, operational_definition, numerator_label, source_of_data, collection_method,
    formula_type, formula_multiplier, target_value, target_operator, target_direction,
    unit_of_measure, unit_of_measure_custom, frequency, allow_multiple_per_period
  ) values (
    v_indicator_id, 1,
    'Nilai Indeks Kepuasan Masyarakat (IKM), hasil konversi Nilai Indeks (NI) rata-rata 9 unsur pelayanan dikali 25, dari Survey Kepuasan Pasien. DIISI OTOMATIS oleh sistem setiap Dashboard/Monev Survey Kepuasan Pasien dibuka — jangan input manual di sini, kecuali untuk mengoreksi data.',
    'Nilai IKM (0-100)', 'Survey Kepuasan Pasien', 'Survei elektronik (link/QR) dan/atau kiosk tablet, isi mandiri oleh pasien',
    'sum', 1, 76.61, 'gt', 'higher_better',
    'indeks', null, 'bulanan', false
  );

  raise notice 'Indikator "Kepuasan Pasien" (%) dibuat dan siap ditautkan ke Survey Kepuasan Pasien lewat kolom kepuasan_surveys.linked_indicator_id.', v_indicator_id;
end $$;
