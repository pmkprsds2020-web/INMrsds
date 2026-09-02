# Modul Master Indikator Mutu Custom

Rumah sakit dapat membuat sendiri indikator mutu (Indikator Unit atau
Prioritas RS) **tanpa coding**: identitas → definisi operasional → formula →
target → field pengukuran → langsung punya form input, dashboard, trend, dan
laporan. Menonaktifkan indikator tidak menghapus data; mengubah target/definisi
membuat **versi baru** tanpa mengubah histori tahun-tahun sebelumnya.

Dibangun **tanpa menyentuh 11 indikator legacy** (`IndicatorType`,
`INDICATORS`, `UNIT_MAP`, `indicator_entries`, `IndicatorPanel.tsx`,
`getSections()` di sidebar) — lihat bagian "Keputusan desain" di bawah.

## Berkas yang ditambahkan

| Berkas | Isi |
|---|---|
| `supabase/migration_custom_indicators.sql` | `custom_indicators`, `custom_indicator_versions`, `custom_indicator_fields`, `custom_indicator_units`, `custom_indicator_measurements`, `custom_indicator_categories`, RLS, seed kategori default. |
| `src/types/customIndicators.ts` | Tipe TS + calculation engine (`computeIndicatorValue`, `computeAchievementStatus`, `computePeriodKey`) + semua konstanta pilihan. |
| `src/lib/customIndicatorData.ts` | CRUD indikator/versi/field/unit/pengukuran, lifecycle (aktif/nonaktif/arsip/clone/versioning baru), statistik dashboard, audit trail. |
| `src/components/dashboard/custom-indicators/*.tsx` | `CustomIndicatorModule` (titik integrasi) + `Dashboard`, `List`, `Form` (wizard 4 langkah), `Detail` (overview/input data/trend/analisis unit/versi), `AuditTrailPanel`. |

## Berkas yang diedit (existing, additive)

- `src/contexts/AuthContext.tsx` — tambah `customIndicatorRoles`.
- `src/components/dashboard/DashboardSidebar.tsx` — tambah section menu "Master Indikator Mutu" (8 item, warna teal) + import ikon `Trophy`.
- `src/app/page.tsx` — import & render `CustomIndicatorModule` untuk tab `custom-ind-*`, plus pengecualian `custom-ind-` di semua guard yang sudah ada.

Sudah dicek dengan `npx tsc --noEmit` (**0 error baru** — total error project tetap 179, sama seperti sebelum modul ini ditambahkan, semuanya di file lama yang tidak disentuh) dan `npx next build` (Turbopack berhasil mengompilasi seluruh kode; berhenti hanya di tahap fetch Google Fonts karena keterbatasan jaringan sandbox — bukan error kode).

## Langkah setup

1. Jalankan `supabase/migration_custom_indicators.sql` di Supabase SQL Editor (independen dari migration modul lain, hanya butuh `supabase/migration.sql` sudah jalan).
2. Assign peran ke user yang perlu mengelola master indikator:
   ```sql
   update public.profiles set custom_indicator_roles = array['komite_mutu'] where email = 'mutu@rsasm.id';
   update public.profiles set custom_indicator_roles = array['manajemen']   where email = 'direktur@rsasm.id';
   ```
   Role `admin` otomatis punya semua hak (kelola master). Kepala Unit/staff **tidak perlu role baru** untuk input data — siapa saja yang login boleh input (sama seperti `indicator_entries` existing); pembatasan "indikator harus aktif" ditegakkan di `recordCustomIndicatorMeasurement`.
3. `npm install` lalu `npm run dev`.
4. Coba alur acceptance test dari dokumen acuan: Master Indikator Mutu → + Buat Indikator Baru → isi 4 tab (Identitas, Unit, Definisi & Formula, Field Pengukuran) → Simpan & Aktifkan → buka indikatornya → tab Input Data → input Numerator/Denominator → cek nilai & status capaian otomatis di tab Input Data dan Trend.

## Keputusan desain yang perlu diketahui

- **Tidak ada migrasi/perubahan pada `indicator_entries` atau `IndicatorType`.**
  Modul ini 100% tabel baru. Dashboard/sidebar existing untuk 11 indikator
  legacy tidak disentuh sama sekali.
- **Menu terpisah, bukan disisipkan ke sidebar existing.** `getSections()` di
  `DashboardSidebar.tsx` (pengelompokan "Keselamatan Pasien"/"Proses Klinis")
  memfilter berdasarkan daftar `IndicatorType` yang hardcode — menyisipkan
  indikator custom ke situ butuh mengubah fungsi itu dan berisiko terhadap
  perilaku existing. Sesuai kesepakatan di audit sebelum coding, indikator
  custom punya section sidebar sendiri ("Master Indikator Mutu") dan dashboard
  sendiri, bukan dipaksakan masuk ke `INDICATORS`/`getSections()`. Kalau nanti
  RS memang ingin unifikasi tampilan, itu pekerjaan lanjutan yang lebih aman
  dilakukan lewat adapter (`IndicatorDefinition`) yang disebut di dokumen
  acuan — belum dibangun di iterasi ini.
- **Unit assignment memakai `UnitId` existing** (IGD, Rawat Jalan, Rawat Inap,
  ICU, Kamar Operasi, VK, Laboratorium, Radiologi, Farmasi — persis `UNIT_MAP`
  di `src/types/index.ts`), **bukan** tabel unit baru — sengaja beda dari
  keputusan di modul UIMU (yang punya master unit sendiri) karena dokumen
  acuan modul ini sendiri memakai daftar 9 unit itu sebagai contoh checkbox
  penetapan unit, dan indikator custom ini memang dimaksudkan terintegrasi ke
  struktur unit yang sama dipakai indikator legacy/`profiles.unit_id`.
- **Versioning**: `custom_indicator_versions` menyimpan definisi/formula/
  target LENGKAP per versi (bukan delta). Membuat versi baru menutup versi
  lama (`effective_to`) lalu insert versi baru — versi lama tidak pernah
  diubah/dihapus. Data pengukuran men-snapshot `target_value`/`target_operator`
  saat disimpan (kolom di `custom_indicator_measurements`), jadi laporan tahun
  lalu tidak berubah walau target tahun ini diedit.
- **Formula engine** ada di `src/types/customIndicators.ts`
  (`computeIndicatorValue`) — pure function, gampang di-unit-test, menolak
  `denominator = 0` dan nilai negatif dengan pesan error Bahasa Indonesia
  (bagian 28 dokumen acuan).
- **Field pengukuran dinamis**: field dengan `roleInFormula = 'numerator'`
  atau `'denominator'` otomatis dipakai calculation engine; field lain
  tersimpan di `measurement_data` (jsonb) sebagai data pendukung.
- **Approval workflow untuk Prioritas RS** (bagian 31): baru berupa role
  `manajemen` yang disiapkan di RLS/AuthContext, belum ada gerbang approval
  wajib di alur create/aktivasi — sesuai instruksi dokumen acuan sendiri
  ("jangan membuat approval wajib jika sistem existing belum punya mekanisme
  tersebut; buat extensible").

## Tambahan: Modul "Indikator Mutu Unit" (untuk PIC data entry)

Modul terpisah dari "Master Indikator Mutu" di atas — dibuat supaya PIC unit
tidak perlu membuka menu manajemen (yang penuh field admin) hanya untuk
input data harian/bulanan.

**Cara kerja:**
- Section sidebar baru **"Indikator Mutu Unit"** (warna cyan) muncul **secara
  dinamis** di bawah unit yang sedang aktif — isinya hanya indikator custom
  bertipe `unit` yang **status = aktif** dan **ditugaskan ke unit itu** (atau
  `is_all_units = true`). Diambil lewat `getActiveUnitIndicatorsForUnit(unitId)`
  di `customIndicatorData.ts`, dan berlangganan `subscribeToCustomIndicators`
  supaya sidebar refresh otomatis.
- **Begitu indikator dinonaktifkan** di Master Indikator Mutu, query itu
  otomatis tidak mengembalikannya lagi → hilang dari sidebar dan dari daftar
  "Indikator Mutu Unit" tanpa langkah tambahan apa pun (ini murni efek dari
  filter `status = 'active'`, bukan logika baru).
- Klik salah satu indikator → form input ringkas (unit sudah terkunci ke unit
  aktif, tidak perlu pilih-pilih) + riwayat input untuk unit tersebut. Form
  ini adalah komponen yang SAMA dengan tab "Input Data" di Master Indikator
  Mutu (`MeasurementForm.tsx`, diekstrak jadi komponen bersama supaya tidak
  ada logika ganda) — jadi tervalidasi dan tersimpan lewat jalur yang identik.

**Berkas baru:**
- `src/components/dashboard/custom-indicators/MeasurementForm.tsx` — diekstrak dari `CustomIndicatorDetail.tsx` (dipakai bersama).
- `src/components/dashboard/custom-indicators/UnitIndicatorModule.tsx` — daftar indikator aktif per unit + panel input ringkas.

**Berkas yang diedit:**
- `src/lib/customIndicatorData.ts` — tambah `getActiveUnitIndicatorsForUnit(unitId)`.
- `src/components/dashboard/custom-indicators/CustomIndicatorDetail.tsx` — memakai `MeasurementForm` dari file bersama (tidak ada perubahan perilaku).
- `src/components/dashboard/DashboardSidebar.tsx` — section dinamis baru + `useEffect` untuk fetch per `activeUnit`.
- `src/app/page.tsx` — render `UnitIndicatorModule` untuk tab `unit-ind-*` + pengecualian di semua guard existing.

Sudah dicek ulang dengan `npx tsc --noEmit` (0 error baru, tetap 179 baseline) dan `next build` (lolos kompilasi sampai batas fetch Google Fonts, sama seperti sebelumnya).

Tidak perlu migration SQL tambahan — modul ini murni membaca dari tabel yang sudah ada di `migration_custom_indicators.sql`.

## Yang belum sempat dikerjakan (transparan)

- **Import Excel** (bagian 34) belum dibuat — ditandai opsional di audit awal.
- **Export PDF** — baru Export Excel/CSV yang biasanya ditambahkan di
  `List`/`Detail`; kalau dibutuhkan segera saya bisa tambahkan pola yang sama
  seperti `UimuLaporanPanel.tsx`.
- **Ranking/perbandingan antarunit** (bagian 27) — flag
  `is_comparable_across_units` sudah ada di skema dan ditampilkan di tab
  Analisis Unit, tapi belum ada tampilan ranking terurut khusus.
- **`IndicatorDefinition` adapter** penuh (penyatuan legacy + custom untuk
  Dashboard Overview existing) belum dibangun — lihat poin di atas.
- Belum ada test otomatis, dan `npm run build` penuh belum tuntas di
  lingkungan saya (terhenti di fetch Google Fonts, bukan error kode —
  jalankan sekali di mesin kamu sebelum deploy).

## Tambahan #2: Modul "Indikator Mutu Prioritas" (untuk PIC data entry)

Padanan persis dari "Indikator Mutu Unit" (lihat Tambahan #1 di atas), tapi
untuk indikator bertipe **Prioritas RS**. Section sidebar dinamis baru
"Indikator Mutu Prioritas" (warna fuchsia) muncul di bawah unit yang aktif,
isinya hanya indikator Prioritas RS yang **aktif** dan **berlaku untuk unit
itu** (`is_all_units = true`, atau ditugaskan khusus sebagai "unit yang
berpartisipasi"). Kartu di daftar diurutkan berdasarkan Nomor Prioritas, dan
panel input menampilkan alasan prioritas selain definisi operasional.

Sama seperti modul Unit: begitu indikator prioritas dinonaktifkan di Master
Indikator Mutu, otomatis hilang dari sini pada refresh/subscription
berikutnya — tidak perlu langkah tambahan.

**Berkas baru:**
- `src/components/dashboard/custom-indicators/PriorityIndicatorModule.tsx`

**Berkas yang diedit:**
- `src/lib/customIndicatorData.ts` — tambah `getActivePriorityIndicatorsForUnit(unitId)`.
- `src/components/dashboard/DashboardSidebar.tsx` — section accordion dinamis baru + fetch per `activeUnit`.
- `src/app/page.tsx` — render `PriorityIndicatorModule` untuk tab `priority-ind-*` + pengecualian di semua guard existing.

Catatan: `tsc --noEmit` di lingkungan saya sempat menunjukkan 1 error tambahan
(`src/lib/db.ts: ... 'PrismaClient'`) — ini murni karena `prisma generate`
tidak saya jalankan (sandbox saya tidak bisa akses `binaries.prisma.sh`), jadi
`@prisma/client` belum ter-generate di `node_modules` saya. File `src/lib/db.ts`
tidak saya sentuh sama sekali dan tidak berhubungan dengan modul ini — begitu
kamu jalankan `npm install` normal (dengan akses internet penuh, seperti build
Vercel kamu yang sudah berhasil), ini akan hilang dengan sendirinya. Tidak ada
error baru di file-file modul ini sendiri.
