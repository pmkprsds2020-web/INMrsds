# Modul Usulan Indikator Mutu Unit (UIMU)

Modul baru untuk INMrsds: alur digital **Usulan → Review Kepala Unit/PJ Mutu →
Telaah Komite Mutu → Revisi (bila perlu) → Persetujuan → Penetapan → Master
Indikator → Aktif**, sesuai dokumen "USULAN INDIKATOR MUTU UNIT" dan SPO
Penetapan Indikator Mutu yang jadi acuan.

Dibangun **mengikuti pola arsitektur modul IKP/Risiko/Budaya yang sudah ada**
di repo ini — bukan sistem terpisah — supaya konsisten dengan struktur dan
terminologi aplikasi.

## Berkas yang ditambahkan

| Berkas | Isi |
|---|---|
| `supabase/migration_usulan_indikator.sql` | Skema DB: `uimu_units`, `uimu_proposals`, `uimu_revisions`, `uimu_approvals`, view `uimu_master_indikator`, RLS, nomor otomatis, seed unit awal. |
| `src/types/uimu.ts` | Tipe TS + semua daftar pilihan tetap (21 aspek SPO, dimensi mutu, checklist alasan, dst.) |
| `src/lib/uimuData.ts` | Layer Supabase: CRUD, transisi status/workflow, skor prioritas, duplikasi tahun sebelumnya, statistik dashboard, audit trail. |
| `src/components/dashboard/uimu/*.tsx` | `UimuModule` (titik integrasi) + `UimuDashboardPanel`, `UimuForm`, `UimuList`, `UimuDetail`, `UimuMasterPanel`, `UimuLaporanPanel`, `UimuAuditTrailPanel`. |

## Berkas yang diedit (existing, additive)

- `src/contexts/AuthContext.tsx` — tambah `uimuRoles`.
- `src/components/dashboard/DashboardSidebar.tsx` — tambah section menu "Usulan Indikator Mutu Unit" (9 item, warna violet).
- `src/app/page.tsx` — import & render `UimuModule` untuk tab `uimu-*`, plus pengecualian `uimu-` di semua guard yang sudah ada untuk `ikp-`/`risk-`/`budaya-`.

Sudah dicek dengan `npx tsc --noEmit` — **nol error baru** dari berkas modul ini (179 error yang ada di project berasal dari kode lama yang tidak disentuh, mis. `firebase/*` yang belum terpasang, isu tipe framer-motion `Variants` di LoginPage/SignupPage, dll — semua sudah ada sebelum modul ini ditambahkan).

## Langkah setup

1. Jalankan `supabase/migration_usulan_indikator.sql` di Supabase SQL Editor (boleh sebelum/sesudah migration_ikp.sql/migration_risk.sql/migration_budaya.sql — tidak saling bergantung, hanya butuh `supabase/migration.sql` sudah jalan lebih dulu).
2. Assign peran ke user yang perlu jadi reviewer, contoh:
   ```sql
   update public.profiles set uimu_roles = array['kepala_unit'] where email = 'kepala.pu@rsasm.id';
   update public.profiles set uimu_roles = array['komite_mutu'] where email = 'mutu@rsasm.id';
   update public.profiles set uimu_roles = array['manajemen']   where email = 'direktur@rsasm.id';
   ```
   Role `admin` (kolom `role` yang sudah ada) otomatis punya semua hak modul ini.
3. Cek/lengkapi daftar unit di menu **Master Indikator → Master Unit** (19 unit contoh sudah di-seed dari lampiran usulan — PU, PI, PA, KBBL, IGD, OK, ICU, RJ, Farmasi, Lab, Radiologi, Gizi, RM, CSSD, PPI, Komite Mutu, SDM, Keuangan, Rumah Tangga).
4. `npm install` lalu `npm run dev` seperti biasa.

## Keputusan desain yang perlu diketahui

- **Master Unit dibuat baru (`uimu_units`), bukan menumpangi `profiles.unit_id`.**
  `profiles.unit_id` adalah check-constraint 9 nilai tetap (IGD, Rawat Jalan,
  Rawat Inap, ICU, Kamar Operasi, VK, Laboratorium, Radiologi, Farmasi) yang
  dipakai modul INM/IKP/Risk/Budaya. Daftar itu tidak mencakup unit-unit pada
  lampiran usulan (Perawatan Umum, KBBL, PI, PA, dst.), dan dokumen acuan modul
  ini secara eksplisit meminta master unit yang **bisa dikelola admin**
  (poin 22), bukan hard-coded. Jadi modul ini punya master unit sendiri, dan
  RLS-nya mengizinkan SELECT untuk semua staf terautentikasi (perlu untuk
  memilih unit saat membuat usulan) tapi INSERT/UPDATE hanya admin.
- **Versioning usulan** disimpan sebagai kolom `version` yang naik di baris
  yang sama (bukan baris baru) setiap kali dikembalikan/direvisi lalu dikirim
  ulang; histori keputusan tiap versi ada di `uimu_revisions` (append-only,
  tidak pernah dihapus/ditimpa — sesuai poin 12 dokumen acuan).
- **Master Indikator** (poin 14) diimplementasikan sebagai **view**
  (`uimu_master_indikator`) di atas `uimu_proposals` yang berstatus
  `ditetapkan`/`aktif`, bukan tabel duplikat — supaya tidak ada risiko data
  tidak sinkron antara usulan dan "master".
- **Modul pengukuran indikator mutu** (poin 15, capaian/numerator/denominator
  per periode) **belum dibangun** — di luar cakupan yang diminta di prompt
  ini. View `uimu_master_indikator` sudah disiapkan sebagai sumber datanya
  supaya modul itu tinggal query dari sana ketika dikerjakan.
- **Export PDF/cetak lembar usulan & berita acara** (poin 20) baru sebatas
  Export Excel (CSV) dan `window.print()` bawaan browser pada Laporan.
  Cetak lembar usulan/berita acara dengan format khusus belum dibuat.
- **Notifikasi** (poin 18) mengikuti pola IKP: mendarat di `audit_logs`
  (`type='uimu'`) sehingga otomatis tampil di panel notifikasi/audit trail
  aplikasi yang sudah ada — belum ada notifikasi push/email terpisah.
- **Approval "Manajemen/Direktur"** (poin 13/4) diimplementasikan sebagai
  approval opsional pada status `disetujui` (dicatat di `uimu_approvals`),
  paralel dengan penetapan oleh Komite Mutu — bukan gerbang wajib yang
  memblokir penetapan, karena dokumen acuan menyebut peran manajemen sebagai
  "persetujuan akhir apabila diperlukan". Kalau RS ingin manajemen jadi gerbang
  wajib sebelum `ditetapkan`, ini bisa diketatkan di `establishUimuProposal`.

## Yang belum sempat dikerjakan (transparan)

- Belum ada test otomatis (unit/e2e) untuk modul ini — sama seperti modul
  IKP/Risk/Budaya di repo ini yang juga belum punya test.
- `npx next build` penuh belum dijalankan di lingkungan saya (keterbatasan
  jaringan sandbox ke font Google/Vercel saat build) — hanya `tsc --noEmit`
  yang dijalankan dan lolos bersih. Disarankan jalankan `npm run build`
  sekali di mesin kamu sebelum deploy.
