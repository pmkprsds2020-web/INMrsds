# Modul OPPE — Ongoing Professional Practice Evaluation (Evaluasi Praktik Profesional Berkelanjutan)

Modul baru INMrsds, dibangun **mengikuti pola modul UIMU/IKP/Budaya yang sudah ada** (satu titik integrasi
`OppeModule`, data layer Supabase langsung dari klien, RLS sebagai penegak hak akses, audit ke tabel khusus +
mirror ke `audit_logs` untuk Notifikasi). Tidak ada aplikasi/database baru, tidak ada modul existing yang
dihapus atau ditulis ulang.

Referensi utama: **OPPE BARU By dr.Sri RSASM.xlsx** — 12 lembar (Dokter Umum, Non Bedah, Bedah, Obgyn,
Anestesi, Rehab Medik, Mata, THT, Dokter Gigi Umum, Laktasi, Patologi Klinik, Radiologi) → **12 KSM,
12 template, 168 indikator** di-seed otomatis dengan teks parameter/target/trigger/sumber data apa adanya.

---

## 1. File yang ditambahkan

| File | Isi |
|---|---|
| `supabase/migration_oppe.sql` | Skema, index, trigger, RLS, storage bucket, RPC import, seed konfigurasi + 168 indikator/12 template dari Excel |
| `supabase/seed_oppe_demo.sql` | **Opsional, bukan produksi** — 10 dokter fiktif (dr. Andi … dr. Joko), 18 evaluasi multi-periode, 3 FPPE; semua `is_demo = true` |
| `src/types/oppe.ts` | Tipe, enum workflow/operator, label, default pengaturan, preset Excel RSASM, `deriveOppeAccess()` |
| `src/lib/oppeScoring.ts` | **Engine murni**: status indikator, trigger, skor, skor berbobot, kategori, trend, rekomendasi, trigger override |
| `src/lib/oppeData.ts` | Data layer Supabase: master, dokter, indikator, template, evaluasi, workflow, FPPE, audit, evidence, integrasi Indikator Mutu |
| `src/lib/oppeExport.ts` | Export Excel (exceljs), CSV, PDF (lembar cetak A4), export format-import |
| `src/lib/import-engine/configs/oppe.ts` | ImportConfig OPPE untuk Import Engine existing (validasi per baris + solusi) |
| `src/lib/ai/oppePrompts.ts`, `src/app/api/oppe-ai/route.ts` | AI OPPE Analysis (decision support) memakai `generateAIResponse` existing |
| `src/app/oppe/[[...slug]]/page.tsx` | Route `/oppe/...` → diarahkan ke tab dashboard (`/?tab=oppe-...`) |
| `src/components/dashboard/oppe/*.tsx` | `OppeModule`, `OppeShared`, `OppeDashboardPanel`, `OppeDoctorList`(+Form), `OppeIndicatorList`(+Form), `OppeTemplateList`, `OppeEvaluationForm`, `OppeEvaluationDetail`, `OppeScoreSummary`, `OppeMonitoringList`, `OppeResultsPanel`(+TrendCard), `OppeFppePanel`(+Form), `OppeReportPanel`(+ExportPanel), `OppeImportPanel`, `OppeAuditTrailPanel`, `OppeSettingsPanel`, `OppeAiPanel` |
| `scripts/test-oppe-scoring.mjs` | 22 uji unit engine (`node scripts/test-oppe-scoring.mjs`) |

## 2. File existing yang diubah (semua additive)

| File | Perubahan |
|---|---|
| `src/components/dashboard/DashboardSidebar.tsx` | Section **OPPE** (12 submenu, aksen rose) + auto-expand grup `oppe-*` |
| `src/app/page.tsx` | Import & render `OppeModule` untuk tab `oppe-*`; pengecualian `oppe-` di guard yang sudah ada; deep link `?tab=` |
| `src/contexts/AuthContext.tsx` | `oppeRoles` (kolom `profiles.oppe_roles`) dengan fallback bila migrasi belum dijalankan |
| `src/components/import/ImportHistoryPanel.tsx` | Label modul `oppe` |
| `src/lib/import-engine/parseFile.ts` | **Perbaikan bug existing**: template resmi punya 4 baris metadata sehingga header ada di baris 5, tetapi parser membaca header dari baris 1 → file template tidak bisa diimport kembali (berlaku untuk semua modul). Sekarang header template resmi dideteksi otomatis; file tanpa metadata tetap dibaca seperti sebelumnya |
| `src/lib/import-engine/runImport.ts` | Nomor baris error memakai nomor baris Excel asli (`__rowNum__` SheetJS), mis. "Baris 15 — Realisasi harus berupa angka" |

## 3. Database migration

`supabase/migration_oppe.sql` — jalankan di Supabase SQL Editor **setelah** `migration.sql`
(disarankan juga setelah `migration_usulan_indikator.sql` dan `migration_import_export.sql`; bila belum,
bagian terkait dilewati otomatis). Idempotent: aman dijalankan ulang, tidak menimpa perubahan admin.

## 4. Tabel

`oppe_ksm`, `oppe_master_options` (profesi/spesialisasi/jenis layanan), `oppe_indicator_categories`,
`oppe_indicators`, `oppe_templates`, `oppe_template_indicators`, `oppe_settings`, `oppe_doctors`,
`oppe_evaluations`, `oppe_evaluation_items`, `oppe_fppe`, `oppe_audit_logs`, `oppe_counters`.
Unit **tidak** dibuat ulang — memakai master unit existing `uimu_units` (FK ditambahkan bila tabel ada).

Constraint penting: unique evaluasi `dokter + tahun + jenis periode (+ tanggal mulai custom)`;
unique `evaluasi + indikator`; FK di semua relasi; index pada doctor_id, ksm_id, evaluation_id,
indicator_id, year, period, status. Nomor otomatis `OPPE/2026/000001` dan `FPPE/2026/0001`.

## 5. RLS & peran

Peran baru di `profiles.oppe_roles` (pola sama `uimu_roles`); `role = 'admin'` otomatis full access.

| Peran | Akses |
|---|---|
| Admin | Semua, termasuk Pengaturan skor/kategori dan hapus evaluasi final |
| `komite_medik` | Lihat semua OPPE, review, approve, finalisasi, reopen, FPPE, kelola master indikator/template/KSM/bobot |
| `evaluator` | Membuat & mengisi evaluasi yang ditugaskan kepadanya (draft/dalam proses), mengajukan; tidak melihat evaluasi evaluator lain |
| `dokter` | Hanya hasil OPPE miliknya yang **sudah disetujui/final** (+ histori, rekomendasi, FPPE) — via `oppe_doctors.user_id` |

Penjagaan di database (bukan hanya UI): trigger `oppe_guard_evaluation` menolak perubahan evaluasi FINAL
kecuali reopen oleh Komite **dengan alasan**, dan menolak status review/approve/final oleh non-Komite;
`oppe_guard_items` mengunci item evaluasi final; `oppe_audit_immutable` membuat audit trail tidak bisa
diubah/dihapus siapa pun. Tidak ada `USING (true)`; semua akses dicek lewat fungsi peran.
Diuji di PostgreSQL 16 lokal (lihat bagian Testing).

```sql
update public.profiles set oppe_roles = array['komite_medik'] where email = 'komite.medik@rs.id';
update public.profiles set oppe_roles = array['evaluator']    where email = 'ketua.ksm@rs.id';
update public.profiles set oppe_roles = array['dokter']       where email = 'dokter@rs.id';
-- hubungkan akun dokter ke master dokter (atau isi "ID akun login" di menu Data Dokter)
update public.oppe_doctors set user_id = (select id from auth.users where email = 'dokter@rs.id') where name = 'dr. ...';
```

## 6. Routes

Aplikasi adalah dashboard satu halaman berbasis `activeTab`; menu ada di sidebar existing.
Alamat langsung tetap tersedia lewat `/oppe/[[...slug]]` yang mengarah ke tab yang sesuai:
`/oppe`, `/oppe/dashboard`, `/oppe/doctors`, `/oppe/indicators`, `/oppe/templates`, `/oppe/evaluations`,
`/oppe/evaluations/new`, `/oppe/evaluations/[id]`, `/oppe/monitoring`, `/oppe/results`, `/oppe/fppe`,
`/oppe/reports`, `/oppe/import`, `/oppe/export`, `/oppe/audit`, `/oppe/settings`.
API: `POST /api/oppe-ai`.

## 7. Logika penilaian (engine `oppeScoring.ts`)

- **Status indikator**: tanpa data → ABU-ABU; memenuhi kondisi trigger → MERAH; memenuhi target → HIJAU;
  di antara target dan trigger → KUNING. Contoh: target ≥95%, trigger <90% → 97 hijau, 92 kuning, 88 merah.
  Target ≤ dibalik; 0 kasus: 0 hijau, ≥1 merah; Baik/Cukup/Kurang, Lulus/Belum, Aktif/Mati, Ya/Tidak lewat
  nilai lulus/perhatian; SKP dibanding target SKP (target per evaluasi).
- **Skor**: default Memenuhi 100 / Perhatian 70 / Trigger 0 — dari Pengaturan, bisa ditimpa per indikator.
- **Skor kategori** = rata-rata berbobot skor indikator; **skor akhir** = Σ skor kategori × bobot (A 30, B 20,
  C 50 — configurable, total divalidasi 100%). Contoh prompt 90×30% + 80×20% + 95×50% = **90,5** lulus uji.
- **Kategori akhir** configurable (default ≥90 Sangat Baik, 80–<90 Baik, 70–<80 Perlu Perbaikan, <70 Tidak
  Memenuhi). Tersedia tombol **Preset Excel RSASM** (Baik ≥85, Cukup 75–<85, Kurang <75; skor = indikator
  terpenuhi/total×100) sesuai bagian II lembar Excel.
- **Trigger override**: indikator kritis yang terkena trigger memunculkan peringatan "Terdapat indikator kritis
  yang terkena trigger." dan rekomendasi FPPE walaupun skor tinggi (demo: dr. Andi 2026-S1 skor 91,67 Sangat
  Baik + Perioperative Cardiac Arrest = 1 → FPPE).
- **Rekomendasi otomatis** memakai skor, trigger, indikator kritis, jumlah trigger (ambang configurable),
  trend vs periode sebelumnya (naik/stabil/turun, warning penurunan signifikan), dan riwayat FPPE.
  Komite Medik dapat menulis rekomendasi final terpisah.

## 8. Catatan penyesuaian dari Excel (transparan)

- Indikator berstatus **kritis** (29) ditetapkan untuk indikator "0 kasus/insiden" di Kinerja Klinis dan
  kepatuhan kode etik — dapat diubah per indikator di Master Indikator.
- Trigger "[ ] Ya [ ] Tidak" pada kehadiran rapat/jam pelayanan dibaca sebagai "di bawah target".
- Indikator "0%"/"%" dengan trigger "≥ 1 kasus" (mis. henti jantung peri-anestesi, endoftalmitis) diinput
  sebagai **jumlah kasus**.
- Radiologi C6 (Time Out/Marking) di Excel tertulis target "0 Kasus" tetapi trigger "< 100%" → disimpan
  sebagai target 100% dengan catatan "(Excel: 0 Kasus)". Mohon dikonfirmasi ke dr. Sri.
- Target "Sesuai target" (SKP) dan "Sesuai Standar RS" (NDR) dibiarkan kosong di master → diisi per evaluasi
  atau oleh admin di Master Indikator; tanpa target, status indikator tetap abu-abu.

## 9. Integrasi

- **Indikator Mutu**: indikator OPPE dapat ditautkan (reference ID, tanpa duplikasi data) ke
  `custom_indicators`; di form evaluasi tersedia "Tarik dari Indikator Mutu" (Σnum/Σden periode).
  Catatan: data indikator mutu bersifat per unit, bukan per dokter — evaluator tetap bisa mengoreksi.
- **Import/Export**: memakai Import Engine existing (template DATA/PETUNJUK/REFERENSI, preview, deteksi
  duplikasi, riwayat import, RPC transaksional). Setelah import, skor dihitung ulang otomatis.
- **Notifikasi**: diajukan/direview/disetujui/final/reopen/FPPE/trigger masuk `audit_logs` (type `oppe`) →
  tampil di panel Notifikasi existing. Dashboard OPPE juga menampilkan daftar jatuh tempo, belum selesai,
  trigger, FPPE perlu dibuat, menunggu approval.
- **Evidence**: link (rekam medis/laporan audit) dan upload file ke bucket privat `oppe-evidence`.
- **PDF**: mengikuti pola modul lain ("Print / PDF") — lembar A4 "LEMBAR EVALUASI PRAKTIK PROFESIONAL
  BERKELANJUTAN" dibuka di jendela cetak → Simpan sebagai PDF. Tidak menambah dependensi.

## 10. Testing yang sudah dijalankan

- `node scripts/test-oppe-scoring.mjs` → **22/22 lulus** (status, trigger, 0 kasus, kategori, SKP, bobot 90,5,
  batas kategori, trigger override, normalisasi kategori kosong, trend).
- PostgreSQL 16 lokal + stub `auth`: seluruh migration existing → `migration_oppe.sql` (2×, idempotent) →
  `seed_oppe_demo.sql` (2×); juga skenario hanya `migration.sql` + OPPE. Uji RLS: user tanpa peran 0 baris;
  dokter hanya 3 evaluasi miliknya yang final; evaluator hanya evaluasi yang ditugaskan; evaluator tidak bisa
  approve; ubah evaluasi FINAL ditolak; reopen dengan alasan berhasil; duplikasi periode ditolak; audit log
  tidak bisa diubah/dihapus; pengaturan hanya admin; RPC import: evaluator OK, evaluator lain/non-peran ditolak.
- `npx tsc --noEmit`: **0 error baru** (27 error yang muncul identik dengan sebelum modul ditambahkan —
  firebase/framer-motion lama).
- `npm run build`: **berhasil** (route `/oppe/[[...slug]]` dan `/api/oppe-ai` terbentuk). Di sandbox
  saya Google Fonts tidak bisa diakses, jadi build diverifikasi dengan font di-stub sementara lalu
  `layout.tsx` dikembalikan persis seperti semula; di mesin/Vercel Anda build berjalan normal.
- Belum diuji: klik-klik UI di browser dengan Supabase sungguhan dan pemanggilan DeepSeek (butuh
  kredensial). Mohon uji alur: login → OPPE → Evaluasi Baru → isi realisasi → Ajukan → Review → Setujui →
  Finalisasi → FPPE → Export/Import.

## 11. Langkah setup

1. Jalankan `supabase/migration_oppe.sql` di SQL Editor.
2. (Opsional, lingkungan uji) jalankan `supabase/seed_oppe_demo.sql`. Hapus demo: lihat komentar di file.
3. Assign `oppe_roles` (bagian 5) dan isi nama RS di **OPPE → Pengaturan → Rekomendasi & Ambang**.
4. Lengkapi target SKP/NDR di Master Indikator bila ingin seragam.
5. `npm install` lalu `npm run build` / `npm run dev`.
