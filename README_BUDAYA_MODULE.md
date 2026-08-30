# Modul Survey Budaya Keselamatan Pasien — Paket File

Cara pakai: extract isi zip ini LANGSUNG ke root folder project INMrsds-main
Anda (timpa file yang sudah ada untuk file "MODIFIKASI" di bawah).

## PENTING — jalankan/perbarui SQL dulu
`supabase/migration_budaya.sql` SUDAH BERUBAH dari paket sebelumnya (ada
tambahan bagian 17 — akses publik untuk halaman pengisian responden tanpa
login). File ini idempotent (aman dijalankan ulang dari awal) — jalankan
ULANG SELURUH file ini di Supabase SQL editor, jangan hanya bagian akhirnya.

## File BARU (aman ditambahkan)
- supabase/migration_budaya.sql — jalankan SETELAH migration.sql/migration_ikp.sql/migration_risk.sql
- src/types/budaya.ts
- src/lib/budayaData.ts
- src/components/dashboard/budaya/*.tsx (14 file — dashboard admin)
- src/components/survey-budaya/BudayaPublicSurveyFlow.tsx — BARU, alur pengisian publik/anonim
- src/app/survey-budaya/page.tsx — BARU, halaman masuk kode akses
- src/app/survey-budaya/[token]/page.tsx — BARU, route link/QR langsung

## File MODIFIKASI (menimpa file existing Anda)
- src/app/page.tsx — hanya bagian aditif (import BudayaModule, budayaRoles,
  canReviewBudaya/isBudayaAdmin, dispatch case). Disarankan diff manual dulu
  sebelum menimpa karena file ini sangat sentral (>1000 baris).

## Cara kerja alur publik (src/app/survey-budaya/)
1. Staf dapat link (dari panel Kuesioner → Distribusi di dashboard admin):
   - Public link / QR → langsung ke `/survey-budaya/<token>`
   - Access code → ke `/survey-budaya` dulu, masukkan kode, lalu redirect
     ke `/survey-budaya/<kode>` (route yang sama)
2. Halaman menampilkan info survei + persetujuan (checkbox wajib) → pilih
   unit kerja → mulai sesi (membuat baris `budaya_respondents` baru via RPC
   `budaya_start_session`, TANPA login).
3. Mengisi Bagian A-I satu per satu; tiap jawaban langsung tersimpan
   (autosave) lewat RPC `budaya_submit_answer`. Pertanyaan wajib yang belum
   diisi memblokir tombol "Berikutnya" (poin AF).
4. Review -> "Kirim Survey" -> RPC `budaya_complete_session` mengunci sesi.
   Status tersimpan di `sessionStorage` browser supaya tidak bisa mengisi
   ulang dari perangkat yang sama (poin AH) - INI PERLINDUNGAN SISI KLIEN
   SAJA; kalau butuh perlindungan lebih kuat (mis. satu token = satu
   pengisian lintas perangkat), tambahkan pengecekan `used_count`/`max_uses`
   di level `budaya_survey_tokens` untuk link sekali pakai.

## BELUM termasuk (menyusul di fase berikutnya)
- Export PDF/Excel sungguhan (tombol Export di Laporan masih placeholder)
- AI clustering komentar Bagian I
- Panel manajemen peran budaya_roles khusus (sementara reuse referensi
  read-only di Master Data)
- Layar konfirmasi visual QR code (generate/print) di panel Distribusi -
  saat ini hanya link teks + tombol salin

## TIDAK termasuk (sudah ada di zip Anda, jangan ditimpa)
- src/components/dashboard/DashboardSidebar.tsx
- src/contexts/AuthContext.tsx
