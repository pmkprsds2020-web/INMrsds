-- ============================================================================
-- HOTFIX — "Survei tidak ditemukan" padahal survei sudah Aktif dan
-- tanggal hari ini ada di dalam periode start_date..end_date.
--
-- PENYEBAB: kedua fungsi publik di bawah membandingkan periode survei
-- memakai `current_date`, yang di server Postgres/Supabase mengikuti UTC.
-- Karena WIB = UTC+7, pada jam-jam dini hari WIB (kira-kira 00:00-06:59
-- WIB) tanggal UTC MASIH tanggal kemarin — jadi survei yang start_date-nya
-- "hari ini" (menurut WIB) dianggap BELUM mulai oleh server. Contoh:
-- pukul 02:00 WIB tgl 3 Sep 2026 = 19:00 UTC tgl 2 Sep 2026, sehingga
-- `current_date` di server = 2 Sep 2026, padahal survei baru boleh diisi
-- mulai 3 Sep 2026.
--
-- PERBAIKAN: bandingkan periode dalam zona waktu Asia/Jakarta, bukan zona
-- waktu server. Aman dijalankan berulang (CREATE OR REPLACE FUNCTION),
-- tidak mengubah data yang sudah ada, dan tidak perlu menjalankan ulang
-- migration_kepuasan.sql dari awal — cukup jalankan file ini saja.
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
