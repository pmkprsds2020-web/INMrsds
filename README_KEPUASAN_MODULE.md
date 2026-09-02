# Modul Survey Kepuasan Pasien — Paket File

Cara pakai: extract isi paket ini LANGSUNG ke root folder project
INMrsds-main Anda (timpa file yang sudah ada untuk file "MODIFIKASI" di
bawah — hanya bagian aditif, disarankan diff manual dulu).

Modul ini **mereuse** arsitektur Survey Budaya Keselamatan Pasien
(src/app/survey-budaya/, src/components/dashboard/budaya/, pola
migration_budaya.sql) persis seperti yang diminta di prompt Anda — routing
publik tanpa login, distribusi link/QR/kode akses, RLS, dan reuse penuh
tabel `custom_indicator_measurements` dari modul Master Indikator Mutu
Custom untuk integrasi otomatis ke Indikator Mutu (tidak ada tabel indikator
baru yang dibuat).

## PENTING — jalankan SQL dulu, urutan migrasi

```
supabase/migration.sql
supabase/migration_custom_indicators.sql   ← WAJIB sebelum migration_kepuasan.sql
                                              (untuk seed indikator "Kepuasan Pasien"
                                              dan integrasi custom_indicator_measurements)
supabase/migration_kepuasan.sql            ← BARU, paket ini
```

`migration_kepuasan.sql` idempotent (aman dijalankan ulang). Boleh
dijalankan sebelum/sesudah migration_budaya.sql/migration_ikp.sql/
migration_risk.sql/migration_usulan_indikator.sql — tidak saling bergantung
kecuali sama-sama menambah kolom pada `profiles`/`audit_logs` (additive).

Bila migration_custom_indicators.sql BELUM pernah dijalankan di project
Anda, bagian seed indikator otomatis dilewati (ada `raise notice`, tidak
error) — modul kepuasan tetap berfungsi penuh, hanya tanpa dorongan
otomatis ke Indikator Mutu sampai Anda menjalankan migrasi tsb. dan
menautkan `linked_indicator_id` lewat form Buat Survey.

## File BARU (aman ditambahkan)

```
supabase/migration_kepuasan.sql
src/types/kepuasan.ts
src/lib/kepuasanData.ts
src/components/survey-kepuasan/KepuasanPublicSurveyFlow.tsx   ← alur pengisian publik pasien
src/app/survey-kepuasan/page.tsx                              ← halaman masuk kode akses
src/app/survey-kepuasan/[token]/page.tsx                      ← route link/QR langsung
src/components/dashboard/kepuasan/KepuasanModule.tsx           ← titik integrasi tunggal
src/components/dashboard/kepuasan/KepuasanSurveyList.tsx
src/components/dashboard/kepuasan/KepuasanSurveyForm.tsx
src/components/dashboard/kepuasan/KepuasanDistribusiPanel.tsx  ← link, QR, kode akses
src/components/dashboard/kepuasan/KepuasanDashboardPanel.tsx
src/components/dashboard/kepuasan/KepuasanResponsesPanel.tsx   ← termasuk import/export Excel
src/components/dashboard/kepuasan/KepuasanKritikSaranPanel.tsx
src/components/dashboard/kepuasan/KepuasanMonevPanel.tsx
```

## File MODIFIKASI (menimpa file existing Anda)

Update: `src/app/page.tsx` dan `src/components/dashboard/DashboardSidebar.tsx`
di paket ini **SUDAH LENGKAP TERINTEGRASI** — tinggal timpa langsung file
Anda dengan dua file ini, TIDAK perlu tempel manual lagi. Sebelum menimpa,
disarankan tetap diff dulu dengan file Anda saat ini (terutama bila Anda
sudah menambah modul lain sejak versi yang saya proses), karena kedua file
ini sangat sentral (>1000 baris) — perubahan yang saya buat murni ADITIF
(import baru, satu blok dispatch `if (activeTab.startsWith('kepuasan-'))`,
satu section menu baru di sidebar) dan tidak menghapus/mengubah baris modul
lain manapun.

Ringkasan perubahan di kedua file (untuk keperluan diff manual bila Anda
memilih tidak langsung menimpa):

- `page.tsx`: import `KepuasanModule`; konstanta `canManageKepuasanSurvey`
  (baris ~156); blok render `if (activeTab.startsWith('kepuasan-')) {...}`;
  penambahan `|| activeTab.startsWith('kepuasan-')` di 3 pengecekan guard
  yang sudah memuat `activeTab.startsWith('budaya-')`.
- `DashboardSidebar.tsx`: 3 import ikon baru (`MessageSquare`, `QrCode`,
  `Gauge`); key `kepuasanSurvey` di `openGroups`; satu cabang di
  `useEffect` auto-expand; satu section `<Collapsible>` menu baru
  "Survey Kepuasan Pasien" (8 item) ditempatkan setelah section "Survey
  Budaya Keselamatan Pasien".

### (Opsional, untuk hak akses granular) `src/contexts/AuthContext.tsx`

Tambahkan `kepuasanRoles` dengan pola identik `budayaRoles` (state, kolom
`kepuasan_roles` di query cascading-fallback, dan field baru di value
context) — lihat blok `budayaRoles`/`budaya_roles` di file Anda sekitar
baris 35, 113, 127, 186, 325 sebagai contoh persis yang perlu diduplikasi
untuk `kepuasanRoles`/`kepuasan_roles`. Tidak wajib untuk MVP karena
`canManageKepuasanSurvey` di atas sudah jalan hanya dengan `role==='admin'`.

## Cara kerja alur publik (src/app/survey-kepuasan/)

1. Staf mendapat link/QR dari panel **Distribusi** di dashboard admin
   (`kepuasan-distribusi`):
   - Public link / QR → langsung ke `/survey-kepuasan/<token>`
   - Access code → ke `/survey-kepuasan` dulu, masukkan kode, redirect ke
     `/survey-kepuasan/<kode>` (route yang sama)
2. Pasien membuka link → info survei + (bila survei "Semua Unit") pilih
   unit pelayanan + nama opsional → **Mulai Mengisi**.
3. 9 unsur ditampilkan satu per satu (poin 37 dokumen: "1 pertanyaan per
   layar") dengan progress "Pertanyaan N dari 9".
4. Kritik/saran (opsional) + kesediaan dihubungi → **Kirim Survey**.
5. Tombol Kirim memanggil **SATU** RPC `kepuasan_submit_response` yang
   membuat SATU baris response baru — TIDAK ADA pengecekan
   perangkat/IP/cookie/localStorage/session apapun yang mencegah
   pengisian berikutnya (poin 14 dokumen instruksi — INI PRINSIP UTAMA).
6. Setelah berhasil: tombol **"Isi Survey Berikutnya"** (mode online)
   mengosongkan seluruh state form dan kembali ke langkah 2; atau, bila
   `survey_mode` = kiosk/both, form otomatis reset sendiri setelah
   `kiosk_reset_seconds` detik (default 5) tanpa perlu disentuh.

## Keputusan desain tambahan (di luar dokumen instruksi asli — mohon direview)

- **QR Code** dirender lewat gambar dari `api.qrserver.com` (parameter URL,
  tanpa dependency npm baru) di `buildKepuasanQrImageUrl()`
  (`src/lib/kepuasanData.ts`). Bila RS Anda memerlukan generate QR
  sepenuhnya offline (tanpa panggilan ke layanan eksternal), ganti fungsi
  ini dengan library seperti `qrcode`/`qrcode.react` — tinggal 1 fungsi
  yang perlu diganti, semua pemanggil lain tidak berubah.
- **Formula indikator "Kepuasan Pasien"** di-seed dengan `formula_type =
  'sum'` (lihat migration_kepuasan.sql bagian 11) karena mesin hitung
  `computeIndicatorValue()` yang sudah ada memperlakukan `sum`/`count`
  sebagai nilai langsung (pass-through), paling pas untuk nilai IKM yang
  memang bukan hasil rasio numerator/denominator — bukan berarti IKM benar
  benar dijumlahkan.
- **Model response** disederhanakan jadi SATU baris final per submit
  (bukan sesi multi-halaman ber-autosave seperti modul Budaya), karena
  instruksi Anda meminta alur sesederhana mungkin untuk pasien awam dan
  9 unsur cukup singkat untuk dikirim sekaligus di layar terakhir — jawaban
  tetap tersimpan di state React saat pasien berpindah antar
  pertanyaan/layar, dan baru ditulis ke database sekali saat "Kirim
  Survey" ditekan.
- **Import Excel** memetakan header persis seperti kolom di
  "INM 2025 MONEV FORM BARU.xlsx" (RESPONDEN, TGL, RUANGAN, lalu 9 kolom
  unsur) — lihat `IMPORT_COLUMN_MAP` di `KepuasanResponsesPanel.tsx`.
  Baris yang gagal validasi (nilai unsur di luar 1-4) TIDAK dimasukkan dan
  ditampilkan sebagai daftar error (poin 30 dokumen).
- **RLS response**: tidak ada policy SELECT/INSERT untuk role `anon`
  sama sekali pada tabel `kepuasan_responses` — satu-satunya jalur tulis
  publik adalah RPC `kepuasan_submit_response` (SECURITY DEFINER), sesuai
  poin 33 dokumen (keamanan public survey: endpoint publik tidak boleh
  bisa membaca data pasien lain atau menyentuh tabel admin).

## Pemetaan ke 20 Acceptance Test Anda (bagian 40 prompt)

| # | Test | Terpenuhi lewat |
|---|------|------------------|
| 1-3 | Buat survei, aktifkan, buka tanpa login | `KepuasanSurveyForm` → status Aktif → `/survey-kepuasan/[token]` |
| 4 | Nama kosong tetap terkirim | `respondent_name` nullable, tidak divalidasi wajib |
| 5 | Semua nilai 1-4 tersimpan | `kepuasan_submit_response()` (SQL bagian 9) |
| 6-8 | 1 perangkat dipakai berkali-kali, form kosong tiap kali | `resetForm()` di `KepuasanPublicSurveyFlow.tsx`, tidak ada guard sessionStorage yang memblokir submit ulang |
| 9-10 | Response bertambah, NI/IKM otomatis | `recomputeKepuasanPeriodResult()` dipanggil setiap Dashboard dibuka |
| 11-12 | Status Tercapai/Tidak Tercapai | `evaluateKepuasanTarget()` di `types/kepuasan.ts` |
| 13-14 | Dashboard & Monev sesuai database | `KepuasanDashboardPanel`, `KepuasanMonevPanel` |
| 15 | QR dibuka dari HP | `buildKepuasanQrImageUrl()` + route `/survey-kepuasan/[token]` |
| 16 | Survei ditutup menolak response baru | RPC memeriksa `s.status = 'aktif'` dan rentang tanggal |
| 17 | Export Excel | `handleExport()` di `KepuasanResponsesPanel.tsx` |
| 18 | Perubahan config tidak mengubah histori | `target_value`/`classification_thresholds` disimpan per survei (baris lama tidak diedit ulang otomatis); `custom_indicator_measurements` juga snapshot target saat input |
| 19 | Survey Budaya tidak regresi | Modul ini 100% file baru + penambahan aditif — tidak ada baris existing budaya/ikp/risk yang diubah |
| 20 | `npx tsc --noEmit` & build sukses | **BELUM dijalankan di sisi kami** — sandbox tidak memiliki `node_modules`/kredensial Supabase project Anda. Mohon jalankan langkah ini di environment Anda sebelum deploy; beri tahu bila ada error tipe yang perlu diperbaiki. |

## BELUM termasuk (menyusul bila dibutuhkan)

- Export PDF (Export Excel & CSV sudah ada; PDF butuh keputusan layout
  yang lebih spesifik — beri tahu format yang diinginkan)
- Versioning instrumen (`instrument_version`) baru hanya berupa kolom
  siap pakai — belum ada UI untuk membuat versi baru/migrasi data lama
  seperti `finalizeBudayaSurvey`; untuk MVP, ubah target/threshold cukup
  lewat edit langsung survei yang sama
- Panel Master Data / role management khusus `kepuasan_roles` (sementara
  gerbang akses memakai `role==='admin'` saja, lihat bagian AuthContext di
  atas)
