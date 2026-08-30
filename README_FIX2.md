# Perbaikan — Survey tidak bisa diisi (status Draft tidak bisa diaktifkan)

## Akar masalah
Sebelumnya TIDAK ADA cara di UI untuk mengubah status survei dari Draft
ke Aktif. Alur pengisian responden (/survey-budaya/[token]) sengaja hanya
mengizinkan survei berstatus Aktif (poin AE), jadi survei yang baru dibuat
(selalu mulai dari Draft) tidak pernah bisa diisi.

## Yang diperbaiki
1. src/components/dashboard/budaya/BudayaSurveyList.tsx
   - Tambah dropdown ubah status (Draft/Aktif/Ditutup/Arsip) langsung di
     kartu survei, khusus role Komite Mutu/Admin.
   - Tambah tombol "Buat/Lihat Link Pengisian" pada survei berstatus Aktif
     -> langsung ke tab Kuesioner > Distribusi untuk survei tsb.
2. src/components/dashboard/budaya/BudayaModule.tsx
   - PERBAIKAN BUG: sebelumnya survei yang dipilih (`detail`) langsung
     ke-reset tiap kali pindah tab, termasuk saat modul sendiri yang
     memindah tab (mis. tombol di atas, atau "Buat Laporan dari Hasil
     Ini" yang sudah ada sebelumnya) — akibatnya survei yang baru dipilih
     hilang tepat sebelum panel tujuan sempat memakainya. Sekarang tidak
     direset otomatis.
   - Tambah prop `canManageSurvey` (Komite Mutu/Admin saja) terpisah dari
     `canReview` (Komite Mutu/Manajemen/Kepala Unit/Admin) — supaya kontrol
     yang hanya boleh dipakai Komite Mutu/Admin tidak tampil ke role lain
     yang nanti akan gagal diam-diam kena RLS.
3. src/components/dashboard/budaya/BudayaQuestionnairePanel.tsx
   - Tab "Distribusi" langsung terbuka (bukan "Struktur Instrumen") kalau
     dibuka lewat tombol "Buat/Lihat Link Pengisian".
4. src/app/page.tsx
   - Tambah `canManageBudayaSurvey` dan diteruskan ke <BudayaModule>.

## Cara pakai
Timpa 4 file di atas ke project Anda, lalu:

git add .
git commit -m "fix: bisa ubah status survei budaya draft->aktif, perbaiki bug reset detail survei"
git push

## Setelah deploy — cara mengisi survei
1. Buka menu "Survey Aktif" di sidebar Survey Budaya Keselamatan.
2. Di kartu survei yang masih "Draft", ubah dropdown status ke "Aktif".
3. Klik tombol "Buat/Lihat Link Pengisian" yang muncul -> pilih "Buat
   Public Link" atau "Buat QR" -> salin link.
4. Buka link itu (boleh di tab/browser lain, tanpa login) untuk mengisi
   survei sebagai responden.
