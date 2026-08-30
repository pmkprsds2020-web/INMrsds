# Modul MANAJEMEN RISIKO — INMrsds

Modul ini ditambahkan mengikuti pola arsitektur modul IKP yang sudah ada di
aplikasi (satu titik integrasi, migration SQL additive, RLS per tabel).
**Tidak ada file existing yang dihapus atau di-restructure** — hanya
penambahan (lihat daftar "File yang diubah" di bawah).

## 1. Jalankan migration

Di Supabase SQL Editor, jalankan **setelah** `supabase/migration.sql` (dan
`supabase/migration_ikp.sql` jika modul IKP sudah dipakai):

```
supabase/migration_risk.sql
```

Migration ini aman dijalankan berulang (idempotent). Migration ini:
- Menambah kolom `risk_roles` pada `profiles` (additive).
- Membuat 8 tabel baru: `risks`, `risk_assessments`, `risk_mitigations`,
  `risk_monitorings`, `risk_reviews`, `risk_attachments`, `risk_history`,
  `risk_report_counters`.
- Membuat generated column untuk **Skor Risiko** (Dampak × Probabilitas ×
  Controllability) dan **Risk Matrix** (Dampak × Probabilitas) — dihitung
  otomatis di database, tidak bisa diinput manual.
- Mengaktifkan RLS + storage bucket `risk-attachments`.
- Mengisi seed data dari `RISK REGISTER .pdf` (RS Ali Sibroh Malisi, tahun
  2023) — hapus/komentari bagian 16 di file SQL bila tidak diperlukan.

## 2. Beri peran (role) ke user

```sql
update public.profiles
set risk_roles = array['pj_mutu']
where email = 'pj.mutu@example.com';
```

Nilai yang dikenali: `manajemen`, `pj_mutu`, `risk_owner`, `staff_unit`,
`direktur`. User dengan `role = 'admin'` (existing) otomatis punya semua
akses reviewer.

## 3. Jalankan aplikasi seperti biasa

```
npm install   # jika belum
npm run dev
```

Menu **MANAJEMEN RISIKO** akan muncul di sidebar setelah section IKP, berisi:
Dashboard Risiko, Risk Register, Identifikasi Risiko, Risk Matrix,
Pengelolaan Risiko, Monitoring Risiko, Review Risiko, Analisis Trend,
Laporan Risiko, Master Data Risiko, Audit Trail Risiko.

## File yang ditambahkan

```
supabase/migration_risk.sql
src/types/risk.ts
src/lib/riskData.ts
src/components/dashboard/risk/RiskModule.tsx
src/components/dashboard/risk/RiskDashboardPanel.tsx
src/components/dashboard/risk/RiskRegisterList.tsx
src/components/dashboard/risk/RiskIdentificationForm.tsx
src/components/dashboard/risk/RiskDetail.tsx
src/components/dashboard/risk/RiskMatrixPanel.tsx
src/components/dashboard/risk/RiskWorklistPanel.tsx
src/components/dashboard/risk/RiskLaporanPanel.tsx
src/components/dashboard/risk/RiskMasterDataPanel.tsx
src/components/dashboard/risk/RiskAuditTrailPanel.tsx
src/components/dashboard/risk/RiskTrendComparisonPanel.tsx
```

## File existing yang diedit (additive)

- `src/app/page.tsx` — import `RiskModule`, deklarasi `canReviewRisk`/
  `isRiskAdmin`, satu blok routing `if (activeTab.startsWith('risk-'))`,
  dan perluasan kondisi pengecualian tab INM (4 titik) supaya tab `risk-*`
  tidak memicu logic entri indikator INM.
- `src/components/dashboard/DashboardSidebar.tsx` — satu section menu baru
  "Manajemen Risiko" (11 item), ditempatkan setelah section IKP.
- `src/contexts/AuthContext.tsx` — field `riskRoles` baru (pola sama persis
  seperti `ikpRoles`), dengan fallback query bertingkat supaya aplikasi
  tetap jalan walau migration belum dijalankan.
- `src/components/dashboard/ikp/IkpIncidentDetail.tsx` — tombol **"Jadikan
  Risiko"** (poin 22): menyalin insiden IKP menjadi draft Risk Register.

## Catatan desain penting

- **Skor Risiko** (Dampak × Probabilitas × Controllability) dan **Risk
  Matrix** (Dampak × Probabilitas saja) adalah dua logika terpisah sesuai
  instruksi — jangan dicampur.
- **Risiko Residual** disimpan di tabel terpisah (`risk_reviews`), tidak
  menimpa data **Risiko Inheren/Awal** (`risk_assessments`).
- Riwayat status (`risk_history`) diisi otomatis oleh trigger database —
  tidak ada mekanisme untuk menghapusnya dari UI.
- Modul Identifikasi + Analisis digabung dalam satu form multi-step
  (`RiskIdentificationForm`) karena keduanya satu siklus pengisian; Evaluasi
  dipisah ke tab tersendiri di halaman Detail karena biasanya dilakukan
  pihak berbeda (reviewer) pada waktu berbeda.
- Fase 4 (Notifikasi otomatis & AI Risk Assistant) belum diimplementasikan
  penuh — dashboard sudah menampilkan warning visual untuk risiko
  sangat tinggi, tapi notifikasi terjadwal (deadline mendekat/terlewat)
  perlu diintegrasikan dengan `NotificationPanel` existing sebagai langkah
  lanjutan.
