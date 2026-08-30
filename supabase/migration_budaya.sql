-- ============================================================================
-- INMrsds — Modul Survey Budaya Keselamatan Pasien
-- Migration tambahan, dijalankan SETELAH supabase/migration.sql (dan boleh
-- sebelum/sesudah migration_ikp.sql / migration_risk.sql — tidak saling
-- bergantung, kecuali sama-sama menambah kolom pada `profiles`/`audit_logs`).
-- Aman dijalankan berulang (IF NOT EXISTS / idempotent DO blocks), dan TIDAK
-- mengubah struktur tabel existing kecuali penambahan kolom additive (bag. 0).
--
-- Instrumen: AHRQ Hospital Survey on Patient Safety Culture (HSOPSC) v1.0,
-- terjemahan Indonesia, sesuai file "KUESIONER SURVEY BUDAYA fix (2).doc".
-- 42 item berskor dikelompokkan ke 12 dimensi memakai crosswalk resmi AHRQ
-- (bukan hasil karangan) — lihat komentar pada bagian seed di bawah.
-- Wording pertanyaan mengikuti dokumen sumber; beberapa typo pengetikan pada
-- hasil ekstraksi (mis. "seolah0olah", "unik") dirapikan menjadi ejaan yang
-- benar TANPA mengubah substansi pertanyaan, sesuai batasan pada dokumen
-- instruksi (poin G / ATURAN MUTLAK #5).
-- ============================================================================

-- ============================================================================
-- 0. PERLUASAN ADDITIVE PADA TABEL EXISTING
-- ============================================================================

-- 0.a — Peran tambahan khusus modul ini, terpisah dari `role` ('user'/'admin')
--       dan dari `ikp_roles`/`risk_roles` (jika ada) supaya tidak mengubah
--       perilaku modul lain. Nilai yang dipakai aplikasi: 'komite_mutu',
--       'manajemen', 'kepala_unit', 'staff'. 'admin' (role dasar) otomatis
--       dianggap punya semua hak modul ini.
alter table public.profiles
  add column if not exists budaya_roles text[] not null default '{}'::text[];

comment on column public.profiles.budaya_roles is
  'Peran tambahan khusus modul Survey Budaya Keselamatan Pasien: komite_mutu, manajemen, kepala_unit, staff. Tidak memengaruhi role dasar (user/admin), ikp_roles, atau risk_roles.';

-- 0.b — audit_logs diperluas nilai type-nya agar modul ini bisa reuse tabel
--       yang sama (pola identik dengan modul IKP/Risk), bukan membuat tabel
--       audit baru.
alter table public.audit_logs drop constraint if exists audit_logs_type_check;
alter table public.audit_logs add constraint audit_logs_type_check
  check (type in ('block', 'login', 'input', 'mapping', 'ikp', 'risk', 'budaya'));

-- ============================================================================
-- 1. MASTER DATA
-- ============================================================================

-- 1.a — Dimensi budaya keselamatan (baku, 12 dimensi). Diseed sekali di bawah;
--       admin boleh mengubah teks keterangan lewat UI Master Data, TAPI kode
--       dan jumlah dimensi tidak berubah tanpa migrasi baru (poin BP —
--       versioning instrumen).
create table if not exists public.budaya_dimensions (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text not null,
  description text not null,
  sort_order  int not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.budaya_dimensions is
  '12 dimensi budaya keselamatan pasien (AHRQ HSOPSC 1.0). Baku — perubahan struktural butuh instrument_version baru.';

-- 1.b — Master unit kerja KHUSUS modul ini. Dibuat terpisah dari enum
--       profiles.unit_id (yang hanya berisi 9 unit operasional) karena
--       kuesioner Bagian A mendaftar 15 opsi unit yang berbeda, dan instruksi
--       sumber melarang hard-code + mewajibkan unit dikonfigurasi via Master
--       Data (poin F). PERLU KONFIRMASI RS jika daftar ini ingin disamakan/
--       dipetakan ke enum profiles.unit_id yang sudah ada.
create table if not exists public.budaya_units (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  name       text not null,
  is_active  boolean not null default true,
  sort_order int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.budaya_units is
  'Master unit kerja untuk pilihan Bagian A kuesioner budaya keselamatan. Admin dapat menambah/mengubah/menonaktifkan lewat Master Data.';

-- 1.c — Bank pertanyaan instrumen (semua bagian A–I dalam satu tabel supaya
--       urutan pengisian & validasi wajib-isi bisa dikelola seragam).
create table if not exists public.budaya_questions (
  id                uuid primary key default gen_random_uuid(),
  instrument_version text not null default 'BUDAYA-KESELAMATAN-v1.0',
  section           text not null check (section in ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I')),
  item_code         text not null,
  item_no           int,
  question_text     text not null,
  scale_type        text not null check (
    scale_type in ('likert_agree', 'likert_frequency', 'grade', 'category', 'background', 'free_text')
  ),
  is_reverse        boolean not null default false,
  dimension_id      uuid references public.budaya_dimensions (id),
  is_scored         boolean not null default true,
  is_required       boolean not null default true,
  sort_order        int not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (instrument_version, item_code)
);

comment on table public.budaya_questions is
  'Bank pertanyaan instrumen budaya keselamatan (Bagian A-I), verbatim dari dokumen sumber. dimension_id NULL untuk item non-skor (E/G/H/I).';

-- 1.d — Pilihan jawaban untuk item non-Likert (E, G, H4/H5, dan opsi unit
--       jika suatu saat dibutuhkan pilihan bebas teks "Lain-lain").
create table if not exists public.budaya_question_options (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references public.budaya_questions (id) on delete cascade,
  option_code   text not null,
  option_label  text not null,
  sort_order    int not null,
  created_at    timestamptz not null default now(),
  unique (question_id, option_code)
);

-- ============================================================================
-- 2. SURVEY
-- ============================================================================

create table if not exists public.budaya_surveys (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  year                   int not null,
  period                 text not null check (period in ('semester_1', 'semester_2', 'tahunan', 'custom')),
  start_date             date not null,
  end_date               date not null,
  target_respondents     int not null default 0,
  included_unit_ids      uuid[] not null default '{}'::uuid[],
  status                 text not null default 'draft' check (
    status in ('draft', 'aktif', 'ditutup', 'final', 'arsip')
  ),
  instrument_version     text not null default 'BUDAYA-KESELAMATAN-v1.0',
  anonymity_mode         text not null default 'anonymous' check (anonymity_mode in ('anonymous', 'identified')),
  min_respondent_threshold int not null default 10,
  created_by             uuid references auth.users (id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (end_date >= start_date)
);

comment on table public.budaya_surveys is
  'Satu baris = satu periode survei budaya keselamatan (mis. Semester II 2026).';

-- ============================================================================
-- 3. RESPONDEN & JAWABAN
-- ============================================================================

create table if not exists public.budaya_respondents (
  id                  uuid primary key default gen_random_uuid(),
  survey_id           uuid not null references public.budaya_surveys (id) on delete cascade,
  unit_id             uuid references public.budaya_units (id),
  respondent_user_id  uuid references auth.users (id), -- hanya diisi jika anonymity_mode = 'identified'
  token               text unique not null,
  status              text not null default 'not_started' check (
    status in ('not_started', 'in_progress', 'completed')
  ),
  consented           boolean not null default false,
  profession          text,
  position_other      text,
  started_at          timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.budaya_respondents is
  'Satu sesi pengisian. Jika survei anonim, respondent_user_id selalu NULL — identitas TIDAK disimpan.';

create table if not exists public.budaya_answers (
  id              uuid primary key default gen_random_uuid(),
  respondent_id   uuid not null references public.budaya_respondents (id) on delete cascade,
  question_id     uuid not null references public.budaya_questions (id),
  raw_answer      int check (raw_answer between 1 and 5),
  raw_answer_text text, -- untuk category/background/free_text/grade (mis. option_code atau isi bebas)
  scored_answer   int check (scored_answer between 1 and 5), -- hasil reverse bila is_reverse; NULL jika tidak berlaku/kosong
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (respondent_id, question_id)
);

comment on table public.budaya_answers is
  'raw_answer = jawaban asli responden (tidak pernah diubah). scored_answer = hasil pembalikan skor untuk item reverse, dipakai untuk agregasi (poin P/Q Anda — audit trail perhitungan).';

create table if not exists public.budaya_comments (
  id            uuid primary key default gen_random_uuid(),
  survey_id     uuid not null references public.budaya_surveys (id) on delete cascade,
  respondent_id uuid not null references public.budaya_respondents (id) on delete cascade,
  comment_text  text not null,
  theme         text, -- diisi AI clustering (opsional) atau manual oleh Komite Mutu; TIDAK memengaruhi skor
  created_at    timestamptz not null default now()
);

-- ============================================================================
-- 4. HASIL AGREGAT (dihitung ulang oleh aplikasi saat finalisasi survei —
--    lihat budayaData.ts `finalizeSurvey()` pada fase coding berikutnya;
--    BUKAN diisi manual dari UI)
-- ============================================================================

create table if not exists public.budaya_dimension_results (
  id                  uuid primary key default gen_random_uuid(),
  survey_id           uuid not null references public.budaya_surveys (id) on delete cascade,
  dimension_id        uuid not null references public.budaya_dimensions (id),
  positive_count      int not null default 0,
  negative_count      int not null default 0,
  neutral_count       int not null default 0,
  total_responses     int not null default 0,
  positive_percentage numeric(5, 2),
  category            text check (category in ('kuat', 'sedang', 'lemah')),
  computed_at         timestamptz not null default now(),
  unique (survey_id, dimension_id)
);

create table if not exists public.budaya_unit_results (
  id                  uuid primary key default gen_random_uuid(),
  survey_id           uuid not null references public.budaya_surveys (id) on delete cascade,
  unit_id             uuid not null references public.budaya_units (id),
  dimension_id        uuid not null references public.budaya_dimensions (id),
  positive_count      int not null default 0,
  negative_count      int not null default 0,
  neutral_count       int not null default 0,
  total_responses     int not null default 0,
  positive_percentage numeric(5, 2),
  category            text check (category in ('kuat', 'sedang', 'lemah')),
  computed_at         timestamptz not null default now(),
  unique (survey_id, unit_id, dimension_id)
);

create table if not exists public.budaya_period_results (
  id                 uuid primary key default gen_random_uuid(),
  survey_id          uuid not null unique references public.budaya_surveys (id) on delete cascade,
  overall_score      numeric(5, 2),
  overall_category   text check (overall_category in ('kuat', 'sedang', 'lemah')),
  total_respondents  int not null default 0,
  response_rate      numeric(5, 2),
  source             text not null default 'system' check (source in ('system', 'imported')),
  computed_at        timestamptz not null default now()
);

comment on table public.budaya_period_results is
  'Ringkasan overall per periode survei, dasar grafik trend antar periode (poin AN). source=imported dipakai oleh IMPORT HASIL SURVEY LAMA (poin BM).';

-- ============================================================================
-- 5. TINDAK LANJUT & MONITORING
-- ============================================================================

create table if not exists public.budaya_followups (
  id                 uuid primary key default gen_random_uuid(),
  survey_id          uuid not null references public.budaya_surveys (id) on delete cascade,
  dimension_id       uuid not null references public.budaya_dimensions (id),
  unit_id            uuid references public.budaya_units (id),
  problem_description text,
  root_cause         text,
  action_plan        text,
  pic_id             uuid references auth.users (id),
  target_date        date,
  start_date         date,
  deadline           date,
  success_indicator  text,
  status             text not null default 'belum_dimulai' check (
    status in ('belum_dimulai', 'dalam_proses', 'selesai', 'ditunda', 'tidak_efektif')
  ),
  progress_percentage int not null default 0 check (progress_percentage between 0 and 100),
  evidence_url       text,
  notes              text,
  created_by         uuid references auth.users (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.budaya_followup_monitorings (
  id                  uuid primary key default gen_random_uuid(),
  followup_id         uuid not null references public.budaya_followups (id) on delete cascade,
  monitoring_date     date not null,
  activity            text,
  pic_id              uuid references auth.users (id),
  progress_percentage int check (progress_percentage between 0 and 100),
  notes               text,
  evidence_url        text,
  created_by          uuid references auth.users (id),
  created_at          timestamptz not null default now()
);

-- ============================================================================
-- 6. LAPORAN & APPROVAL
-- ============================================================================

create table if not exists public.budaya_reports (
  id              uuid primary key default gen_random_uuid(),
  survey_id       uuid not null references public.budaya_surveys (id) on delete cascade,
  report_type     text not null check (
    report_type in ('survey', 'dimensi', 'unit', 'periode', 'trend', 'tindak_lanjut')
  ),
  status          text not null default 'draft' check (
    status in ('draft', 'diperiksa_komite', 'disetujui_manajemen', 'final')
  ),
  content_summary text,
  file_url        text,
  created_by      uuid references auth.users (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.budaya_approvals (
  id                uuid primary key default gen_random_uuid(),
  report_id         uuid not null references public.budaya_reports (id) on delete cascade,
  reviewer_id       uuid references auth.users (id),
  reviewer_name     text,
  reviewer_position text,
  approved_at       timestamptz,
  notes             text,
  created_at        timestamptz not null default now()
);

-- ============================================================================
-- 7. DISTRIBUSI (LINK / QR / ACCESS CODE)
-- ============================================================================

create table if not exists public.budaya_survey_tokens (
  id          uuid primary key default gen_random_uuid(),
  survey_id   uuid not null references public.budaya_surveys (id) on delete cascade,
  token       text unique not null,
  kind        text not null check (kind in ('public_link', 'qr', 'unique_invitation', 'access_code')),
  unit_id     uuid references public.budaya_units (id),
  max_uses    int,
  used_count  int not null default 0,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- ============================================================================
-- 8. INDEXES
-- ============================================================================

create index if not exists idx_budaya_questions_dimension on public.budaya_questions (dimension_id);
create index if not exists idx_budaya_questions_section on public.budaya_questions (section, sort_order);
create index if not exists idx_budaya_respondents_survey on public.budaya_respondents (survey_id);
create index if not exists idx_budaya_respondents_status on public.budaya_respondents (status);
create index if not exists idx_budaya_respondents_unit on public.budaya_respondents (unit_id);
create index if not exists idx_budaya_answers_respondent on public.budaya_answers (respondent_id);
create index if not exists idx_budaya_answers_question on public.budaya_answers (question_id);
create index if not exists idx_budaya_dimension_results_survey on public.budaya_dimension_results (survey_id);
create index if not exists idx_budaya_unit_results_survey on public.budaya_unit_results (survey_id);
create index if not exists idx_budaya_followups_survey on public.budaya_followups (survey_id);
create index if not exists idx_budaya_followups_status on public.budaya_followups (status);
create index if not exists idx_budaya_reports_survey on public.budaya_reports (survey_id);
create index if not exists idx_budaya_survey_tokens_survey on public.budaya_survey_tokens (survey_id);

-- ============================================================================
-- 9. updated_at TRIGGERS (reuse fungsi set_updated_at() dari migration.sql)
-- ============================================================================

drop trigger if exists trg_budaya_dimensions_updated_at on public.budaya_dimensions;
create trigger trg_budaya_dimensions_updated_at
  before update on public.budaya_dimensions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_budaya_units_updated_at on public.budaya_units;
create trigger trg_budaya_units_updated_at
  before update on public.budaya_units
  for each row execute function public.set_updated_at();

drop trigger if exists trg_budaya_questions_updated_at on public.budaya_questions;
create trigger trg_budaya_questions_updated_at
  before update on public.budaya_questions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_budaya_surveys_updated_at on public.budaya_surveys;
create trigger trg_budaya_surveys_updated_at
  before update on public.budaya_surveys
  for each row execute function public.set_updated_at();

drop trigger if exists trg_budaya_respondents_updated_at on public.budaya_respondents;
create trigger trg_budaya_respondents_updated_at
  before update on public.budaya_respondents
  for each row execute function public.set_updated_at();

drop trigger if exists trg_budaya_answers_updated_at on public.budaya_answers;
create trigger trg_budaya_answers_updated_at
  before update on public.budaya_answers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_budaya_followups_updated_at on public.budaya_followups;
create trigger trg_budaya_followups_updated_at
  before update on public.budaya_followups
  for each row execute function public.set_updated_at();

drop trigger if exists trg_budaya_reports_updated_at on public.budaya_reports;
create trigger trg_budaya_reports_updated_at
  before update on public.budaya_reports
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 10. ROLE HELPERS — perluasan is_admin() (dari migration.sql) untuk peran
--     modul ini, pola identik dengan has_ikp_role()/is_ikp_reviewer().
-- ============================================================================

create or replace function public.has_budaya_role(role_name text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'admin' or role_name = any(budaya_roles))
  );
$$;

-- "Reviewer" = boleh melihat semua hasil (bukan hanya milik sendiri),
-- membuat/mengelola survei, dan mengisi tindak lanjut lintas unit.
create or replace function public.is_budaya_reviewer()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'admin' or budaya_roles && array['komite_mutu', 'manajemen', 'kepala_unit'])
  );
$$;

-- ============================================================================
-- 11. SUBMISSION AMAN UNTUK RESPONDEN ANONIM (SECURITY DEFINER)
-- ============================================================================
-- Karena survei defaultnya ANONIM (poin AB) dan pengisi tidak harus login,
-- tabel budaya_respondents/budaya_answers TIDAK dibuka langsung untuk role
-- `anon`/`authenticated` (lihat RLS bag. 12). Sebagai gantinya, pengisian
-- dilakukan lewat fungsi SECURITY DEFINER di bawah, yang memvalidasi TOKEN
-- survei/respondent terlebih dulu sebelum menulis — pola ini menggantikan
-- akses tabel langsung khusus untuk alur publik, karena akses tabel langsung
-- (pola default proyek ini) tidak aman untuk endpoint yang diakses tanpa
-- login. Ini adalah KEPUTUSAN DESAIN tambahan di luar dokumen instruksi asli,
-- perlu direview oleh tim Anda sebelum dipakai di produksi.

create or replace function public.budaya_start_session(p_survey_token text, p_unit_id uuid)
returns table (respondent_id uuid, respondent_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_survey_id uuid;
  v_new_token text;
  v_new_id uuid;
begin
  select s.id into v_survey_id
  from public.budaya_survey_tokens t
  join public.budaya_surveys s on s.id = t.survey_id
  where t.token = p_survey_token
    and s.status = 'aktif'
    and (t.expires_at is null or t.expires_at > now())
    and (t.max_uses is null or t.used_count < t.max_uses);

  if v_survey_id is null then
    raise exception 'Token survei tidak valid, sudah kedaluwarsa, atau survei tidak aktif.';
  end if;

  v_new_token := encode(gen_random_bytes(16), 'hex');

  insert into public.budaya_respondents (survey_id, unit_id, token, status, consented, started_at)
  values (v_survey_id, p_unit_id, v_new_token, 'in_progress', true, now())
  returning id into v_new_id;

  update public.budaya_survey_tokens set used_count = used_count + 1 where token = p_survey_token;

  return query select v_new_id, v_new_token;
end;
$$;

create or replace function public.budaya_submit_answer(
  p_respondent_token text,
  p_question_id uuid,
  p_raw_answer int,
  p_raw_answer_text text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_respondent_id uuid;
  v_is_reverse boolean;
  v_scored int;
begin
  select r.id into v_respondent_id
  from public.budaya_respondents r
  where r.token = p_respondent_token and r.status = 'in_progress';

  if v_respondent_id is null then
    raise exception 'Sesi pengisian tidak ditemukan atau sudah selesai.';
  end if;

  select is_reverse into v_is_reverse from public.budaya_questions where id = p_question_id;

  v_scored := case
    when p_raw_answer is null then null
    when v_is_reverse then 6 - p_raw_answer
    else p_raw_answer
  end;

  insert into public.budaya_answers (respondent_id, question_id, raw_answer, raw_answer_text, scored_answer)
  values (v_respondent_id, p_question_id, p_raw_answer, p_raw_answer_text, v_scored)
  on conflict (respondent_id, question_id)
  do update set raw_answer = excluded.raw_answer,
                raw_answer_text = excluded.raw_answer_text,
                scored_answer = excluded.scored_answer,
                updated_at = now();
end;
$$;

create or replace function public.budaya_complete_session(p_respondent_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.budaya_respondents
  set status = 'completed', completed_at = now()
  where token = p_respondent_token and status = 'in_progress';
end;
$$;

-- ============================================================================
-- 12. ROW LEVEL SECURITY
-- ============================================================================

-- ── Master data (dimensi, unit, pertanyaan, opsi): baca bebas utk pengguna
--    login (dipakai form internal Master Data & preview kuesioner), tulis
--    hanya admin. Pengisian publik memakai fungsi SECURITY DEFINER di atas,
--    jadi tidak butuh akses anon di sini.
alter table public.budaya_dimensions enable row level security;
drop policy if exists "budaya_dimensions_select" on public.budaya_dimensions;
create policy "budaya_dimensions_select" on public.budaya_dimensions for select to authenticated using (true);
drop policy if exists "budaya_dimensions_write" on public.budaya_dimensions;
create policy "budaya_dimensions_write" on public.budaya_dimensions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.budaya_units enable row level security;
drop policy if exists "budaya_units_select" on public.budaya_units;
create policy "budaya_units_select" on public.budaya_units for select to authenticated using (true);
drop policy if exists "budaya_units_write" on public.budaya_units;
create policy "budaya_units_write" on public.budaya_units for all to authenticated
  using (public.is_admin() or public.has_budaya_role('komite_mutu'))
  with check (public.is_admin() or public.has_budaya_role('komite_mutu'));

alter table public.budaya_questions enable row level security;
drop policy if exists "budaya_questions_select" on public.budaya_questions;
create policy "budaya_questions_select" on public.budaya_questions for select to authenticated using (true);
drop policy if exists "budaya_questions_write" on public.budaya_questions;
create policy "budaya_questions_write" on public.budaya_questions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.budaya_question_options enable row level security;
drop policy if exists "budaya_question_options_select" on public.budaya_question_options;
create policy "budaya_question_options_select" on public.budaya_question_options for select to authenticated using (true);
drop policy if exists "budaya_question_options_write" on public.budaya_question_options;
create policy "budaya_question_options_write" on public.budaya_question_options for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── Survei: dibaca semua user login (untuk keperluan internal/preview);
--    dikelola oleh admin/komite_mutu.
alter table public.budaya_surveys enable row level security;
drop policy if exists "budaya_surveys_select" on public.budaya_surveys;
create policy "budaya_surveys_select" on public.budaya_surveys for select to authenticated using (true);
drop policy if exists "budaya_surveys_write" on public.budaya_surveys;
create policy "budaya_surveys_write" on public.budaya_surveys for all to authenticated
  using (public.is_admin() or public.has_budaya_role('komite_mutu'))
  with check (public.is_admin() or public.has_budaya_role('komite_mutu'));

-- ── Respondent & jawaban mentah: TIDAK ada akses select untuk role biasa
--    (menjaga anonimitas — poin AB); hanya reviewer/admin yang boleh melihat
--    baris mentah (mis. untuk audit), agregat dilihat lewat *_results.
--    Insert/update publik TIDAK lewat tabel ini — lewat fungsi bag. 11.
alter table public.budaya_respondents enable row level security;
drop policy if exists "budaya_respondents_select" on public.budaya_respondents;
create policy "budaya_respondents_select" on public.budaya_respondents for select to authenticated
  using (public.is_budaya_reviewer());
-- Tidak ada policy insert/update/delete untuk authenticated/anon: satu-satunya
-- jalur tulis adalah fungsi SECURITY DEFINER (budaya_start_session, dst.).

alter table public.budaya_answers enable row level security;
drop policy if exists "budaya_answers_select" on public.budaya_answers;
create policy "budaya_answers_select" on public.budaya_answers for select to authenticated
  using (public.is_budaya_reviewer());

alter table public.budaya_comments enable row level security;
drop policy if exists "budaya_comments_select" on public.budaya_comments;
create policy "budaya_comments_select" on public.budaya_comments for select to authenticated
  using (public.is_budaya_reviewer());

-- ── Hasil agregat: boleh dibaca semua user login (angka agregat, bukan data
--    individual) — pembatasan minimum-threshold per unit ditegakkan di
--    lapisan aplikasi (budayaData.ts) sesuai poin AC, karena bergantung pada
--    konfigurasi min_respondent_threshold per survei. Tulis hanya lewat
--    proses finalisasi (service role / admin).
alter table public.budaya_dimension_results enable row level security;
drop policy if exists "budaya_dimension_results_select" on public.budaya_dimension_results;
create policy "budaya_dimension_results_select" on public.budaya_dimension_results for select to authenticated using (true);
drop policy if exists "budaya_dimension_results_write" on public.budaya_dimension_results;
create policy "budaya_dimension_results_write" on public.budaya_dimension_results for all to authenticated
  using (public.is_admin() or public.has_budaya_role('komite_mutu'))
  with check (public.is_admin() or public.has_budaya_role('komite_mutu'));

alter table public.budaya_unit_results enable row level security;
drop policy if exists "budaya_unit_results_select" on public.budaya_unit_results;
create policy "budaya_unit_results_select" on public.budaya_unit_results for select to authenticated using (true);
drop policy if exists "budaya_unit_results_write" on public.budaya_unit_results;
create policy "budaya_unit_results_write" on public.budaya_unit_results for all to authenticated
  using (public.is_admin() or public.has_budaya_role('komite_mutu'))
  with check (public.is_admin() or public.has_budaya_role('komite_mutu'));

alter table public.budaya_period_results enable row level security;
drop policy if exists "budaya_period_results_select" on public.budaya_period_results;
create policy "budaya_period_results_select" on public.budaya_period_results for select to authenticated using (true);
drop policy if exists "budaya_period_results_write" on public.budaya_period_results;
create policy "budaya_period_results_write" on public.budaya_period_results for all to authenticated
  using (public.is_admin() or public.has_budaya_role('komite_mutu'))
  with check (public.is_admin() or public.has_budaya_role('komite_mutu'));

-- ── Tindak lanjut & monitoring: dilihat semua user login; ditulis reviewer
--    atau PIC yang bersangkutan.
alter table public.budaya_followups enable row level security;
drop policy if exists "budaya_followups_select" on public.budaya_followups;
create policy "budaya_followups_select" on public.budaya_followups for select to authenticated using (true);
drop policy if exists "budaya_followups_write" on public.budaya_followups;
create policy "budaya_followups_write" on public.budaya_followups for all to authenticated
  using (public.is_budaya_reviewer() or pic_id = auth.uid())
  with check (public.is_budaya_reviewer() or pic_id = auth.uid());

alter table public.budaya_followup_monitorings enable row level security;
drop policy if exists "budaya_followup_monitorings_select" on public.budaya_followup_monitorings;
create policy "budaya_followup_monitorings_select" on public.budaya_followup_monitorings for select to authenticated using (true);
drop policy if exists "budaya_followup_monitorings_write" on public.budaya_followup_monitorings;
create policy "budaya_followup_monitorings_write" on public.budaya_followup_monitorings for all to authenticated
  using (
    public.is_budaya_reviewer()
    or exists (select 1 from public.budaya_followups f where f.id = followup_id and f.pic_id = auth.uid())
  )
  with check (
    public.is_budaya_reviewer()
    or exists (select 1 from public.budaya_followups f where f.id = followup_id and f.pic_id = auth.uid())
  );

-- ── Laporan & approval: dilihat semua user login; ditulis reviewer.
alter table public.budaya_reports enable row level security;
drop policy if exists "budaya_reports_select" on public.budaya_reports;
create policy "budaya_reports_select" on public.budaya_reports for select to authenticated using (true);
drop policy if exists "budaya_reports_write" on public.budaya_reports;
create policy "budaya_reports_write" on public.budaya_reports for all to authenticated
  using (public.is_budaya_reviewer()) with check (public.is_budaya_reviewer());

alter table public.budaya_approvals enable row level security;
drop policy if exists "budaya_approvals_select" on public.budaya_approvals;
create policy "budaya_approvals_select" on public.budaya_approvals for select to authenticated using (true);
drop policy if exists "budaya_approvals_write" on public.budaya_approvals;
create policy "budaya_approvals_write" on public.budaya_approvals for all to authenticated
  using (public.is_budaya_reviewer()) with check (public.is_budaya_reviewer());

-- ── Token distribusi: hanya reviewer yang boleh melihat/membuat (berisi
--    kode akses survei — tidak untuk role biasa).
alter table public.budaya_survey_tokens enable row level security;
drop policy if exists "budaya_survey_tokens_select" on public.budaya_survey_tokens;
create policy "budaya_survey_tokens_select" on public.budaya_survey_tokens for select to authenticated
  using (public.is_budaya_reviewer());
drop policy if exists "budaya_survey_tokens_write" on public.budaya_survey_tokens;
create policy "budaya_survey_tokens_write" on public.budaya_survey_tokens for all to authenticated
  using (public.is_budaya_reviewer()) with check (public.is_budaya_reviewer());

-- ============================================================================
-- 13. SEED — 12 DIMENSI (nama & keterangan mengikuti gaya contoh laporan RS
--     Hermina Podomoro yang Anda lampirkan, dipetakan ke istilah resmi AHRQ)
-- ============================================================================

insert into public.budaya_dimensions (code, name, description, sort_order) values
  ('D01', 'Tindakan pimpinan unit dalam mempromosikan/mendukung keselamatan',
   'Menunjukkan sejauh mana tindakan para pimpinan di rumah sakit (kepala urusan/kepala instalasi) dalam mempromosikan/mendukung keselamatan pasien.', 1),
  ('D02', 'Pembelajaran organisasi dan perbaikan berkelanjutan',
   'Menunjukkan sejauh mana kesalahan yang terjadi digunakan untuk membuat perubahan positif dan dievaluasi efektivitasnya.', 2),
  ('D03', 'Kerjasama dalam satu unit',
   'Menunjukkan sejauh mana anggota suatu unit kerja kompak dan bekerja sama sebagai satu kesatuan tim.', 3),
  ('D04', 'Komunikasi terbuka',
   'Menunjukkan sejauh mana keterbukaan antar staf dan pimpinan unit kerja dalam menyampaikan hal yang dapat berdampak pada pelayanan pasien.', 4),
  ('D05', 'Umpan balik dan komunikasi tentang keselamatan',
   'Menunjukkan sejauh mana umpan balik/feedback diberikan oleh para pimpinan atas insiden yang telah terjadi.', 5),
  ('D06', 'Respon tidak menghukum terhadap kesalahan',
   'Menunjukkan sejauh mana pengakuan atas suatu kesalahan tidak ditanggapi dengan hukuman, sehingga pelapor insiden tidak merasa dipojokkan.', 6),
  ('D07', 'Staffing',
   'Menunjukkan sejauh mana rumah sakit menyediakan staf/SDM yang cukup dan sesuai beban kerja untuk pelayanan pasien.', 7),
  ('D08', 'Dukungan manajemen terhadap keselamatan pasien',
   'Menunjukkan sejauh mana manajemen RS memberikan dukungan terhadap penciptaan budaya keselamatan dan menunjukkan bahwa keselamatan pasien adalah prioritas utama.', 8),
  ('D09', 'Kerjasama antar unit',
   'Menunjukkan sejauh mana kekompakan dan kerjasama antar unit kerja/instalasi dalam memberikan pelayanan terbaik pada pasien.', 9),
  ('D10', 'Handsoffs dan transisi',
   'Menunjukkan sejauh mana pergantian shift dan perpindahan pasien antar unit/instalasi berjalan lancar tanpa kehilangan informasi.', 10),
  ('D11', 'Persepsi keseluruhan terhadap keselamatan',
   'Menunjukkan sejauh mana seluruh staf memahami dan merasakan bahwa prosedur/sistem di unit sudah baik dalam mencegah terjadinya error.', 11),
  ('D12', 'Frekuensi pelaporan kejadian',
   'Menunjukkan seberapa sering staf melaporkan kejadian/kesalahan/insiden keselamatan pasien (KTD/KNC/KPC) yang mereka temui.', 12)
on conflict (code) do nothing;

-- ============================================================================
-- 14. SEED — MASTER UNIT (15 opsi Bagian A, verbatim dari dokumen sumber)
-- ============================================================================

insert into public.budaya_units (code, name, sort_order) values
  ('bedah', 'Bedah', 1),
  ('gadar', 'Gawat Darurat', 2),
  ('rehab_medik', 'Rehab Medik', 3),
  ('radiologi', 'Radiologi', 4),
  ('rawat_inap', 'Rawat Inap', 5),
  ('anak', 'Kesehatan Anak', 6),
  ('maternal_perinatal', 'Maternal Perinatal', 7),
  ('icu', 'ICU', 8),
  ('penyakit_dalam', 'Penyakit Dalam (Non Bedah)', 9),
  ('cssd', 'CSSD', 10),
  ('anestesi', 'Anestesi', 11),
  ('sanitasi', 'Sanitasi', 12),
  ('farmasi', 'Farmasi', 13),
  ('gizi', 'Gizi', 14),
  ('lain_lain', 'Lain-lain', 15)
on conflict (code) do nothing;

-- ============================================================================
-- 15. SEED — 42 ITEM BERSKOR + item non-skor (E, G, H, I), dengan mapping
--     dimensi mengikuti crosswalk resmi AHRQ HSOPSC 1.0 (lihat dokumen
--     "ANALISIS STRUKTUR INMRSDS & IMPLEMENTATION PLAN", bagian 0).
-- ============================================================================

do $$
declare
  d01 uuid; d02 uuid; d03 uuid; d04 uuid; d05 uuid; d06 uuid;
  d07 uuid; d08 uuid; d09 uuid; d10 uuid; d11 uuid; d12 uuid;
begin
  select id into d01 from public.budaya_dimensions where code = 'D01';
  select id into d02 from public.budaya_dimensions where code = 'D02';
  select id into d03 from public.budaya_dimensions where code = 'D03';
  select id into d04 from public.budaya_dimensions where code = 'D04';
  select id into d05 from public.budaya_dimensions where code = 'D05';
  select id into d06 from public.budaya_dimensions where code = 'D06';
  select id into d07 from public.budaya_dimensions where code = 'D07';
  select id into d08 from public.budaya_dimensions where code = 'D08';
  select id into d09 from public.budaya_dimensions where code = 'D09';
  select id into d10 from public.budaya_dimensions where code = 'D10';
  select id into d11 from public.budaya_dimensions where code = 'D11';
  select id into d12 from public.budaya_dimensions where code = 'D12';

  -- ── BAGIAN A (18 item, skala Sangat Tidak Setuju..Sangat Setuju) ────────
  -- Dimensi: Kerjasama dalam satu unit = D03 (A1,A3,A4,A11,A14r)
  --          Staffing = D07 (A2,A5r,A7r)
  --          Pembelajaran organisasi = D02 (A6,A9,A13)
  --          Persepsi keseluruhan = D11 (A10r,A15,A17r,A18)
  --          Respon tidak menghukum = D06 (A8r,A12r,A16r)
  insert into public.budaya_questions
    (section, item_code, item_no, question_text, scale_type, is_reverse, dimension_id, is_scored, sort_order)
  values
    ('A', 'A1',  1,  'Karyawan di unit kami saling mendukung', 'likert_agree', false, d03, true, 101),
    ('A', 'A2',  2,  'Unit kami memiliki cukup staf untuk menangani beban kerja yang berlebihan', 'likert_agree', false, d07, true, 102),
    ('A', 'A3',  3,  'Bila di unit kami ada pekerjaan yang harus dilakukan dalam waktu cepat, karyawan di unit kami bekerja bersama sebagai tim untuk menyelesaikan pekerjaan tersebut', 'likert_agree', false, d03, true, 103),
    ('A', 'A4',  4,  'Petugas di unit kami saling menghargai', 'likert_agree', false, d03, true, 104),
    ('A', 'A5',  5,  'Karyawan di unit kami bekerja dengan waktu yang lebih lama dari normal untuk perawatan pasien', 'likert_agree', true, d07, true, 105),
    ('A', 'A6',  6,  'Unit kami secara aktif melakukan kegiatan untuk meningkatkan keselamatan pasien', 'likert_agree', false, d02, true, 106),
    ('A', 'A7',  7,  'Unit kami banyak menggunakan tenaga melebihi normal/tambahan untuk kegiatan pelayanan pasien', 'likert_agree', true, d07, true, 107),
    ('A', 'A8',  8,  'Karyawan unit kami sering merasa bahwa kesalahan yang mereka lakukan digunakan untuk menyalahkan mereka', 'likert_agree', true, d06, true, 108),
    ('A', 'A9',  9,  'Di unit kami, kesalahan yang terjadi digunakan untuk membuat perubahan ke arah yang positif', 'likert_agree', false, d02, true, 109),
    ('A', 'A10', 10, 'Hanya karena kebetulan saja bila insiden yang lebih serius tidak terjadi di unit kami', 'likert_agree', true, d11, true, 110),
    ('A', 'A11', 11, 'Bila salah satu area di unit kami sangat sibuk, area lain dari unit kami akan membantu', 'likert_agree', false, d03, true, 111),
    ('A', 'A12', 12, 'Bila unit kami melaporkan suatu insiden, yang dibicarakan adalah pelakunya bukan masalahnya', 'likert_agree', true, d06, true, 112),
    ('A', 'A13', 13, 'Sesudah membuat perubahan-perubahan untuk meningkatkan keselamatan pasien, kita melakukan evaluasi tentang efektivitasnya', 'likert_agree', false, d02, true, 113),
    ('A', 'A14', 14, 'Kami bekerja seolah-olah dalam keadaan "krisis": bertindak berlebihan dan terlalu cepat', 'likert_agree', true, d03, true, 114),
    ('A', 'A15', 15, 'Unit kami tidak pernah mengorbankan keselamatan pasien untuk menyelesaikan pekerjaan yang lebih banyak', 'likert_agree', false, d11, true, 115),
    ('A', 'A16', 16, 'Karyawan merasa khawatir kesalahan yang mereka buat akan dicatat di berkas pribadi mereka', 'likert_agree', true, d06, true, 116),
    ('A', 'A17', 17, 'Di unit kami banyak masalah keselamatan pasien', 'likert_agree', true, d11, true, 117),
    ('A', 'A18', 18, 'Prosedur dan sistem di unit kami sudah baik dalam mencegah terjadinya error', 'likert_agree', false, d11, true, 118)
  on conflict (instrument_version, item_code) do nothing;

  -- ── BAGIAN B (4 item) — Dimensi: Tindakan pimpinan unit = D01 ───────────
  insert into public.budaya_questions
    (section, item_code, item_no, question_text, scale_type, is_reverse, dimension_id, is_scored, sort_order)
  values
    ('B', 'B1', 1, 'Manajer/supervisor di unit kami memberi pujian jika melihat pekerjaan diselesaikan sesuai prosedur keselamatan pasien yang berlaku', 'likert_agree', false, d01, true, 201),
    ('B', 'B2', 2, 'Manajer/supervisor dengan serius mempertimbangkan masukan staf untuk meningkatkan keselamatan pasien', 'likert_agree', false, d01, true, 202),
    ('B', 'B3', 3, 'Bila beban kerja tinggi, manajer/supervisor kami meminta kami bekerja cepat meski dengan mengambil jalan pintas', 'likert_agree', true, d01, true, 203),
    ('B', 'B4', 4, 'Manajer/supervisor kami selalu mengabaikan masalah keselamatan pasien yang terjadi berulang kali di unit kami', 'likert_agree', true, d01, true, 204)
  on conflict (instrument_version, item_code) do nothing;

  -- ── BAGIAN C (6 item, skala Tidak Pernah..Selalu) ───────────────────────
  -- Dimensi: Umpan balik & komunikasi = D05 (C1,C3,C5); Komunikasi terbuka = D04 (C2,C4,C6r)
  insert into public.budaya_questions
    (section, item_code, item_no, question_text, scale_type, is_reverse, dimension_id, is_scored, sort_order)
  values
    ('C', 'C1', 1, 'Karyawan di unit kami mendapatkan umpan balik mengenai perubahan yang dilaksanakan atas dasar hasil laporan insiden', 'likert_frequency', false, d05, true, 301),
    ('C', 'C2', 2, 'Karyawan di unit kami bebas berbicara jika melihat sesuatu yang dapat berdampak negatif pada pelayanan pasien', 'likert_frequency', false, d04, true, 302),
    ('C', 'C3', 3, 'Karyawan di unit kami mendapat informasi mengenai insiden yang terjadi di unit ini', 'likert_frequency', false, d05, true, 303),
    ('C', 'C4', 4, 'Karyawan di unit kami merasa bebas untuk mempertanyakan keputusan atau tindakan yang diambil oleh atasannya', 'likert_frequency', false, d04, true, 304),
    ('C', 'C5', 5, 'Di unit kami, didiskusikan cara untuk mencegah agar insiden tidak terulang kembali', 'likert_frequency', false, d05, true, 305),
    ('C', 'C6', 6, 'Karyawan di unit kami takut bertanya jika terjadi hal yang kelihatannya tidak benar', 'likert_frequency', true, d04, true, 306)
  on conflict (instrument_version, item_code) do nothing;

  -- ── BAGIAN D (3 item) — Dimensi: Frekuensi pelaporan kejadian = D12 ─────
  insert into public.budaya_questions
    (section, item_code, item_no, question_text, scale_type, is_reverse, dimension_id, is_scored, sort_order)
  values
    ('D', 'D1', 1, 'Bila terjadi kesalahan tetapi sempat diketahui & dikoreksi sebelum berdampak pada pasien, seberapa sering hal ini dilaporkan', 'likert_frequency', false, d12, true, 401),
    ('D', 'D2', 2, 'Bila terjadi kesalahan, tetapi tidak berpotensi mencederai pasien, seberapa sering hal ini dilaporkan', 'likert_frequency', false, d12, true, 402),
    ('D', 'D3', 3, 'Bila terjadi kesalahan yang dapat mencederai pasien tetapi ternyata tidak terjadi cedera, seberapa sering hal ini dilaporkan', 'likert_frequency', false, d12, true, 403)
  on conflict (instrument_version, item_code) do nothing;

  -- ── BAGIAN E — Tingkat keselamatan pasien (non-skor, variabel terpisah) ─
  insert into public.budaya_questions
    (section, item_code, item_no, question_text, scale_type, is_reverse, dimension_id, is_scored, sort_order)
  values
    ('E', 'E1', null, 'Pilih tingkat keselamatan pasien pada unit anda', 'grade', false, null, false, 501)
  on conflict (instrument_version, item_code) do nothing;

  -- ── BAGIAN F (11 item) ───────────────────────────────────────────────
  -- Dimensi: Dukungan manajemen = D08 (F1,F8,F9r); Kerjasama antar unit = D09 (F2r,F4,F6r,F7r,F10); Handsoffs = D10 (F3r,F5r,F11r)
  insert into public.budaya_questions
    (section, item_code, item_no, question_text, scale_type, is_reverse, dimension_id, is_scored, sort_order)
  values
    ('F', 'F1',  1,  'Manajemen rumah sakit membuat suasana kerja yang mendukung keselamatan pasien', 'likert_agree', false, d08, true, 601),
    ('F', 'F2',  2,  'Antar unit di RS kami tidak saling berkoordinasi dengan baik', 'likert_agree', true, d09, true, 602),
    ('F', 'F3',  3,  'Bila terjadi pemindahan pasien dari unit satu ke unit lain, pasti menimbulkan masalah terkait dengan informasi pasien', 'likert_agree', true, d10, true, 603),
    ('F', 'F4',  4,  'Terdapat kerjasama yang baik antara unit di RS yang dibutuhkan untuk menyelesaikan pekerjaan bersama', 'likert_agree', false, d09, true, 604),
    ('F', 'F5',  5,  'Informasi penting mengenai pelayanan pasien sering hilang saat pergantian jaga (shift)', 'likert_agree', true, d10, true, 605),
    ('F', 'F6',  6,  'Sering kali tidak menyenangkan bekerja dengan staf dari unit lain di RS ini', 'likert_agree', true, d09, true, 606),
    ('F', 'F7',  7,  'Masalah sering timbul dalam pertukaran informasi antar unit di RS', 'likert_agree', true, d09, true, 607),
    ('F', 'F8',  8,  'Tindakan manajemen RS menunjukkan bahwa keselamatan pasien merupakan prioritas utama', 'likert_agree', false, d08, true, 608),
    ('F', 'F9',  9,  'Manajemen RS kelihatan tertarik pada keselamatan pasien hanya sesudah terjadi KTD (Kejadian yang Tidak Diharapkan)', 'likert_agree', true, d08, true, 609),
    ('F', 'F10', 10, 'Unit-unit di RS bekerja sama dengan baik untuk memberikan pelayanan yang terbaik untuk pasien', 'likert_agree', false, d09, true, 610),
    ('F', 'F11', 11, 'Pergantian shift merupakan masalah bagi pasien-pasien di RS ini', 'likert_agree', true, d10, true, 611)
  on conflict (instrument_version, item_code) do nothing;

  -- ── BAGIAN G — Jumlah laporan kejadian 12 bulan (kategorikal, non-skor) ─
  insert into public.budaya_questions
    (section, item_code, item_no, question_text, scale_type, is_reverse, dimension_id, is_scored, sort_order)
  values
    ('G', 'G1', null, 'Dalam 12 bulan terakhir jumlah laporan kejadian yang telah anda isi dan kirimkan', 'category', false, null, false, 701)
  on conflict (instrument_version, item_code) do nothing;

  -- ── BAGIAN H — Latar belakang responden (non-skor) ──────────────────────
  insert into public.budaya_questions
    (section, item_code, item_no, question_text, scale_type, is_reverse, dimension_id, is_scored, sort_order)
  values
    ('H', 'H1', 1, 'Berapa lama anda bekerja di RS ini?', 'background', false, null, false, 801),
    ('H', 'H2', 2, 'Berapa lama anda bekerja di unit ini?', 'background', false, null, false, 802),
    ('H', 'H3', 3, 'Tepatnya berapa jam dalam seminggu anda bekerja di RS ini?', 'background', false, null, false, 803),
    ('H', 'H4', 4, 'Apa posisi/jabatan anda di RS ini?', 'background', false, null, false, 804),
    ('H', 'H5', 5, 'Dalam posisi/jabatan anda, apakah anda berhubungan langsung dengan pasien?', 'background', false, null, false, 805),
    ('H', 'H6', 6, 'Berapa lama anda bekerja sesuai profesi saat ini?', 'background', false, null, false, 806)
  on conflict (instrument_version, item_code) do nothing;

  -- ── BAGIAN I — Komentar bebas (non-skor, free text) ─────────────────────
  insert into public.budaya_questions
    (section, item_code, item_no, question_text, scale_type, is_reverse, dimension_id, is_scored, is_required, sort_order)
  values
    ('I', 'I1', null, 'Tulis komentar anda mengenai keselamatan pasien, insiden, atau pelaporan insiden di RS anda', 'free_text', false, null, false, false, 901)
  on conflict (instrument_version, item_code) do nothing;
end $$;

-- ============================================================================
-- 16. SEED — PILIHAN JAWABAN untuk item non-Likert (E, G, H1/H2/H3/H4/H5/H6)
-- ============================================================================

do $$
declare q uuid;
begin
  -- E1: Grade tingkat keselamatan pasien
  select id into q from public.budaya_questions where item_code = 'E1';
  insert into public.budaya_question_options (question_id, option_code, option_label, sort_order) values
    (q, 'A', 'Sempurna', 1), (q, 'B', 'Sangat Baik', 2), (q, 'C', 'Bisa Diterima', 3),
    (q, 'D', 'Jelek/Buruk', 4), (q, 'E', 'Gagal', 5)
  on conflict (question_id, option_code) do nothing;

  -- G1: Jumlah laporan kejadian 12 bulan terakhir
  select id into q from public.budaya_questions where item_code = 'G1';
  insert into public.budaya_question_options (question_id, option_code, option_label, sort_order) values
    (q, 'none', 'Tidak ada', 1), (q, '1-2', '1-2 laporan', 2), (q, '3-5', '3-5 laporan', 3),
    (q, '6-10', '6-10 laporan', 4), (q, '11-20', '11-20 laporan', 5), (q, '21+', '21 atau lebih laporan', 6)
  on conflict (question_id, option_code) do nothing;

  -- H1, H2, H6: rentang lama bekerja (identik pilihannya)
  for q in select id from public.budaya_questions where item_code in ('H1', 'H2', 'H6') loop
    insert into public.budaya_question_options (question_id, option_code, option_label, sort_order) values
      (q, '<1', 'Kurang dari 1 tahun', 1), (q, '1-5', '1-5 tahun', 2), (q, '6-10', '6-10 tahun', 3),
      (q, '11-15', '11-15 tahun', 4), (q, '16-20', '16-20 tahun', 5), (q, '21+', '21 tahun atau lebih', 6)
    on conflict (question_id, option_code) do nothing;
  end loop;

  -- H3: Jam kerja per minggu
  select id into q from public.budaya_questions where item_code = 'H3';
  insert into public.budaya_question_options (question_id, option_code, option_label, sort_order) values
    (q, '<20', 'Kurang dari 20 jam seminggu', 1), (q, '20-39', '20-39 jam seminggu', 2), (q, '40+', '40 jam atau lebih seminggu', 3)
  on conflict (question_id, option_code) do nothing;

  -- H4: Posisi/jabatan
  select id into q from public.budaya_questions where item_code = 'H4';
  insert into public.budaya_question_options (question_id, option_code, option_label, sort_order) values
    (q, 'dokter', 'Dokter', 1), (q, 'perawat', 'Perawat', 2), (q, 'apoteker', 'Apoteker', 3),
    (q, 'asisten_apoteker', 'Asisten Apoteker', 4), (q, 'ahli_gizi', 'Ahli Gizi', 5),
    (q, 'administrasi_manajemen', 'Administrasi Manajemen', 6), (q, 'fisioterapis', 'Fisioterapis', 7),
    (q, 'analis_laboratorium', 'Analis Laboratorium', 8), (q, 'sanitarian', 'Sanitarian', 9),
    (q, 'teknisi', 'Teknisi', 10), (q, 'radiografer', 'Radiografer', 11), (q, 'satpam', 'Satpam', 12),
    (q, 'lain_lain', 'Lain-lain', 13)
  on conflict (question_id, option_code) do nothing;

  -- H5: Kontak langsung dengan pasien
  select id into q from public.budaya_questions where item_code = 'H5';
  insert into public.budaya_question_options (question_id, option_code, option_label, sort_order) values
    (q, 'ya', 'Ya', 1), (q, 'tidak', 'Tidak', 2)
  on conflict (question_id, option_code) do nothing;
end $$;

-- ============================================================================
-- 17. AKSES PUBLIK (role `anon`) UNTUK ALUR PENGISIAN RESPONDEN
-- ============================================================================
-- Halaman pengisian (/survey-budaya/[token]) diakses TANPA LOGIN (poin AB —
-- survei anonim). Bagian 12 di atas hanya membuka RLS untuk role
-- `authenticated`; bagian ini melengkapi akses baca yang MEMANG perlu
-- publik supaya form bisa dirender — bank pertanyaan itu sendiri bukan
-- data sensitif (harus terbaca oleh siapa pun yang mengisi survei).
-- budaya_units/budaya_surveys TIDAK dibuka langsung ke anon (supaya tidak
-- bocor field seperti target_respondents/min_respondent_threshold/
-- created_by) — sebagai gantinya disediakan RPC budaya_get_public_survey()
-- yang hanya mengembalikan field yang memang perlu ditampilkan.

drop policy if exists "budaya_questions_select_anon" on public.budaya_questions;
create policy "budaya_questions_select_anon" on public.budaya_questions for select to anon using (true);

drop policy if exists "budaya_question_options_select_anon" on public.budaya_question_options;
create policy "budaya_question_options_select_anon" on public.budaya_question_options for select to anon using (true);

create or replace function public.budaya_get_public_survey(p_token text)
returns table (
  survey_id uuid,
  name text,
  instrument_version text,
  anonymity_mode text,
  units jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  select
    s.id,
    s.name,
    s.instrument_version,
    s.anonymity_mode,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('id', u.id, 'code', u.code, 'name', u.name) order by u.sort_order)
        from public.budaya_units u
        where u.is_active = true
          and (s.included_unit_ids = '{}'::uuid[] or u.id = any (s.included_unit_ids))
      ),
      '[]'::jsonb
    ) as units
  from public.budaya_survey_tokens t
  join public.budaya_surveys s on s.id = t.survey_id
  where t.token = p_token
    and s.status = 'aktif'
    and (t.expires_at is null or t.expires_at > now())
    and (t.max_uses is null or t.used_count < t.max_uses);
$$;

comment on function public.budaya_get_public_survey is
  'Dipakai halaman publik /survey-budaya/[token] sebelum sesi dimulai (poin BR: halaman pembuka & persetujuan) — hanya mengembalikan field yang boleh dilihat publik, bukan seluruh baris budaya_surveys.';
