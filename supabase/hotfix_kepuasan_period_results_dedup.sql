-- ============================================================================
-- HOTFIX — Dashboard Survey Kepuasan Pasien menampilkan "Belum ada response
-- untuk survei ini" / "Total Responden: 0" padahal responden sudah mengisi
-- survei (terlihat di menu Responses).
--
-- PENYEBAB: kolom kepuasan_period_results.unit_id bernilai NULL untuk baris
-- "ringkasan gabungan semua unit". Constraint `unique (survey_id, unit_id)`
-- TIDAK mencegah duplikat pada kasus ini, karena di Postgres dua nilai NULL
-- tidak pernah dianggap sama untuk keperluan unique constraint. Akibatnya:
--   1. recomputeKepuasanPeriodResult() dipanggil setiap kali Dashboard/Monev
--      dibuka (lihat komentar di kepuasanData.ts) dan melakukan
--      `upsert(..., { onConflict: 'survey_id,unit_id' })`.
--   2. Karena NULL <> NULL, upsert tidak pernah menemukan baris lama untuk
--      di-update — setiap kali dashboard dibuka, baris BARU disisipkan.
--   3. Setelah beberapa kali dashboard dibuka, ada banyak baris
--      (survey_id, unit_id=NULL) untuk survei yang sama.
--   4. getKepuasanPeriodResult() memakai `.maybeSingle()`, yang menolak
--      permintaan begitu ada LEBIH DARI SATU baris yang cocok — error
--      PGRST116 "Results contain N rows ... requires 1 row" (persis error
--      yang muncul di console DevTools).
--   5. Error itu tidak tertangkap di KepuasanDashboardPanel, sehingga
--      `result` tetap null dan dashboard diam-diam menampilkan status
--      kosong walau data respondennya sudah ada dan valid di database.
--
-- PERBAIKAN:
--   A. Bersihkan duplikat yang sudah terlanjur ada (per survey_id, dengan
--      NULL unit_id disatukan sebagai satu grup), sisakan baris terbaru
--      (computed_at) saja.
--   B. Ganti representasi "ringkasan gabungan semua unit" dari unit_id NULL
--      menjadi nilai sentinel tetap ('__overall__') supaya unique
--      constraint yang sudah ada benar-benar menegakkan satu baris per
--      survei. (Kode aplikasi kepuasanData.ts turut diperbarui agar
--      konsisten memakai sentinel ini, lalu memetakannya kembali menjadi
--      `unitId: null` di boundary — tidak ada perubahan pada tipe/DTO yang
--      dipakai komponen.)
--   C. Tandai kolom unit_id NOT NULL supaya baris NULL tidak bisa muncul
--      lagi di masa depan bila ada jalur penulisan lain yang lolos.
--
-- Aman dijalankan berulang (idempotent). Tidak menghapus response pasien
-- (kepuasan_responses) — hanya tabel ringkasan hasil hitung ulang
-- (kepuasan_period_results), yang memang selalu dihitung ulang dari
-- kepuasan_responses sehingga aman dibersihkan/dihitung ulang kapan saja.
-- ============================================================================

-- A. Hapus duplikat: untuk tiap (survey_id, coalesce(unit_id, '__overall__')),
--    sisakan hanya baris dengan computed_at terbaru (tie-break: id terbesar).
with ranked as (
  select
    id,
    row_number() over (
      partition by survey_id, coalesce(unit_id, '__overall__')
      order by computed_at desc, id desc
    ) as rn
  from public.kepuasan_period_results
)
delete from public.kepuasan_period_results
where id in (select id from ranked where rn > 1);

-- B. Migrasikan baris "gabungan semua unit" dari NULL ke sentinel tetap.
update public.kepuasan_period_results
set unit_id = '__overall__'
where unit_id is null;

-- C. Cegah NULL muncul lagi di kolom ini.
alter table public.kepuasan_period_results
  alter column unit_id set not null;

-- Sanity check manual (opsional) — jalankan terpisah bila ingin memastikan
-- sudah tidak ada duplikat tersisa:
-- select survey_id, unit_id, count(*) from public.kepuasan_period_results
-- group by survey_id, unit_id having count(*) > 1;
