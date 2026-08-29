# Modul Pelaporan Insiden Keselamatan Pasien (IKP) — Analisis & Rancangan

Dokumen ini adalah keluaran STEP 1–5 sesuai instruksi di `PROMPT PENGEMBANGAN MODUL
PELAPORAN IKP PADA APLIKASI INMrsds`, ditulis sebelum implementasi kode (STEP 6+).

---

## A. Architecture Assessment (STEP 1)

**Stack aktual** (bukan asumsi dari nama file):
- Next.js 16 (App Router, tapi aplikasi berjalan sebagai **satu halaman** —
  `src/app/page.tsx`, ~968 baris — dengan routing berbasis state `activeTab`,
  bukan file-based routing per menu).
- **Supabase** adalah sumber data sebenarnya (Postgres + Auth + Realtime +
  Storage), diakses **langsung dari client** (`src/lib/supabaseData.ts`),
  diamankan lewat Row Level Security. Tidak ada server actions / API routes
  untuk data domain.
- **Prisma ada di package.json tapi TIDAK dipakai** — `prisma/schema.prisma`
  isinya cuma model default `User`/`Post` (boilerplate awal proyek). Semua
  skema nyata ada di `supabase/migration.sql`, dijalankan manual lewat
  Supabase SQL Editor.
- UI: Tailwind + shadcn/ui + Radix, chart pakai `chart.js`/`react-chartjs-2`,
  animasi pakai `framer-motion`.
- Auth & role: `AuthContext.tsx` membungkus Supabase Auth. Tabel `profiles`
  hanya punya `unit_id` dan `role` (`'user' | 'admin'`) — **tidak ada** role
  granular (verifikator/tim mutu/pimpinan) sebelum perubahan ini.
- Notifikasi = Audit Trail: `NotificationPanel.tsx` dan `AuditTrailPanel.tsx`
  sama-sama membaca tabel `audit_logs` (`type: 'block'|'login'|'input'|'mapping'`).
  Tidak ada sistem notifikasi terpisah (push/email) — **audit log adalah
  notifikasinya**.
- Pola CRUD existing (`supabaseData.ts`): akses langsung `supabase.from(...)`,
  mapping snake_case ⇄ camelCase manual, realtime lewat channel
  `postgres_changes`, fungsi `subscribeToX(...)` mengembalikan unsubscribe.

**Keputusan desain mengikuti pola di atas** (bukan arsitektur baru):
- Modul IKP memakai Supabase langsung + RLS, bukan Prisma, bukan API route baru.
- Notifikasi IKP memakai tabel `audit_logs` yang sama (`type = 'ikp'`), bukan
  sistem baru — otomatis muncul di `NotificationPanel`/`AuditTrailPanel` existing.
- Satu titik integrasi ke `page.tsx` (`<IkpModule activeTab=... />`) supaya
  risiko merusak 968 baris logika existing seminimal mungkin (lihat bagian F).

---

## B. Ekstraksi Dokumen IKP (STEP 2 — Tahap A)

Sumber: `FORMAT LAPORAN INSIDEN ke Tim Keselamatan Pasien RS Ali Sibroh Malisi`
(2 formulir dalam satu dokumen).

### B.1 — Ada di dokumen (dipakai apa adanya, istilah dijaga sama persis)
| Aspek | Isi dokumen |
|---|---|
| Jenis formulir | (1) Laporan Insiden KNC/KTC/KTD/Sentinel — melibatkan pasien tertentu; (2) Laporan KPC (Kondisi Potensial Cedera) — kondisi berbahaya, belum menyangkut pasien tertentu |
| Batas waktu lapor | Maksimal **2×24 jam** sejak kejadian/ditemukan |
| Kerahasiaan | "RAHASIA, TIDAK BOLEH DIFOTOCOPY" |
| Kelompok umur pasien | 0–1 bln, >1bln–1th, >1–5th, >5–15th, >15–30th, >30–65th, >65th (7 kelompok) |
| Jenis kelamin | Laki-laki / Perempuan |
| Penanggung biaya | Umum, Asuransi Swasta, BPJS Kesehatan, Perusahaan, BPJS PBI, Jaminan Kesehatan Daerah |
| Jenis insiden | KNC (Near miss), KTC (No harm), KTD (Adverse Event)/Kejadian Sentinel — **3 baris pilihan** |
| Orang pertama pelapor | Karyawan (Dokter/Perawat/Petugas lain), Pasien, Keluarga/Pendamping, Pengunjung, Lain-lain |
| Insiden terjadi pada | Pasien / Lain-lain (bila lain-lain → **diarahkan ke K3**, bukan Tim KP) |
| Jenis pelayanan pasien | Rawat Inap, Rawat Jalan, IGD, Lain-lain |
| Unit pelayanan (10 pilihan) | IGD, Poli Penyakit Dalam, Anak, Obsgyn, Paru, Mata, THT, Bedah, Rawat Inap, Lainnya |
| Akibat terhadap pasien | Kematian, Cedera Irreversibel/Berat, Cedera Reversibel/Sedang, Cedera Ringan, Tidak Ada Cedera |
| Tindakan dilakukan oleh | Tim, Dokter, Perawat, Petugas lainnya |
| Grading risiko | **Biru, Hijau, Kuning, Merah** — "dapat diisi atasan pelapor" (bukan pelapor sendiri) |
| Sign-off | Pembuat Laporan & Penerima Laporan (nama, paraf, tanggal) |

### B.2 — TIDAK ada di dokumen — ditandai **"Perlu konfirmasi"**
Sesuai instruksi Anda (bagian 3 Tahap B), hal berikut **tidak dikarang sebagai
aturan baku**, melainkan dibangun sebagai default operasional yang bisa
diubah, dan ditandai eksplisit di UI (`IkpMasterDataPanel`) serta di
`src/types/ikp.ts`:

1. **KTD vs Kejadian Sentinel** — dokumen menggabungkan keduanya jadi satu
   baris pilihan. Diimplementasikan sebagai satu nilai `ktd_sentinel` +
   checkbox terpisah "Tandai sebagai Kejadian Sentinel". *Perlu konfirmasi
   Tim KP: apakah Sentinel perlu jadi kategori berdiri sendiri dengan
   eskalasi/RCA wajib yang berbeda?*
2. **Definisi & matriks grading Biru/Hijau/Kuning/Merah** — dokumen hanya
   menyebut warnanya, tanpa kriteria probabilitas×dampak. Default yang
   dipakai mengikuti praktik umum RS Indonesia (Kuning/Merah → investigasi
   wajib). *Perlu konfirmasi matriks resmi RS.*
3. **Metode investigasi & faktor kontributor (RCA/5-Why/Fishbone)** — sama
   sekali tidak ada di dokumen (dokumen hanya formulir pelaporan, bukan SOP
   investigasi). Dibangun mengikuti praktik umum manajemen risiko RS.
4. **Routing insiden non-pasien ke K3** — dokumen menyebutkan ini di catatan
   kecil, tapi tidak menjelaskan mekanismenya. Belum diimplementasikan
   sebagai alur terpisah — saat ini insiden non-pasien tetap masuk sebagai
   laporan IKP biasa dengan `incidentSubject = 'lain_lain'`.
5. **Role granular** (Pelapor/Verifikator/Tim Mutu/Pimpinan) — tidak relevan
   dengan dokumen (dokumen hanya bicara "atasan pelapor" dan "Tim Keselamatan
   Pasien"), tapi diperlukan bagian 21 dari prompt Anda. Ditambahkan sebagai
   kolom `profiles.ikp_roles` yang terpisah dari `role` existing agar modul
   INM lama tidak terpengaruh.

---

## C. Mapping: Dokumen → Database → Form → Workflow → Dashboard → Report

| Dokumen | Kolom DB (`ikp_incidents` kecuali disebutkan) | Form | Dashboard/Laporan |
|---|---|---|---|
| Jenis formulir | `report_kind` (`insiden`\|`kpc`) | Step "Jenis Laporan" | Filter `reportKind` |
| Data pasien | `patient_*` | Step "Data Pasien" | Agregat dampak (bukan identitas) |
| Kronologi | `chronology`, `incident_summary` | Step "Rincian Kejadian" | Tab Kronologi |
| Jenis insiden | `incident_type`, `is_sentinel` | Radio pada Step "Rincian Kejadian" | Donut "Distribusi Jenis Insiden" |
| Grading risiko | `severity_grade`, `severity_set_by/at` | Tab Klasifikasi (khusus reviewer) | Donut "Distribusi Grading", KPI |
| Akibat pasien | `patient_impact` | Step "Dampak & Tindakan" | Donut "Distribusi Dampak" |
| Investigasi | tabel `ikp_investigations` | Tab Investigasi | Worklist "Investigasi" |
| Analisis/RCA | `ikp_investigations.root_cause`, `contributing_factors` | Tab Analisis | Worklist "Analisis IKP" |
| Tindak lanjut | tabel `ikp_actions` | Tab Tindak Lanjut | Worklist "Tindak Lanjut" |
| Attachment | tabel `ikp_attachments` + Storage bucket `ikp-attachments` | Tab Attachment | — |
| Sign-off/audit | `report_maker_name`, `report_receiver_*`; jejak lengkap di `audit_logs` (`type='ikp'`) | Tab Audit Trail | Notifikasi otomatis (reuse existing) |

---

## D. Rancangan Database (STEP 4 — ringkas; detail di `supabase/migration_ikp.sql`)

- `ikp_incidents` — satu tabel menaungi dua jenis formulir (`report_kind`),
  field spesifik salah satu jenis dibiarkan nullable. Nomor laporan
  `IKP-YYYY-000001` dibuat otomatis lewat trigger + tabel counter per tahun
  (aman untuk insert konkuren).
- `ikp_investigations`, `ikp_actions`, `ikp_attachments` — tabel anak,
  relasi `incident_id`.
- **Master data klasifikasi disimpan sebagai konstanta TypeScript**
  (`src/types/ikp.ts`), bukan tabel — konsisten dengan pola `INDICATORS`/
  `UNIT_MAP` yang sudah dipakai modul INM, dan mencegah istilah baku berubah
  diam-diam dari UI.
- **Perluasan additive** (tidak mengubah struktur existing):
  `profiles.ikp_roles` (baru), `audit_logs` ditambah kolom
  `entity_type/entity_id/old_value/new_value` + `type` diperluas menerima
  `'ikp'`.
- RLS: pelapor hanya melihat laporan miliknya (sesuai "RAHASIA" di dokumen);
  verifikator/tim_mutu/pimpinan/admin melihat semua. Draft hanya bisa diedit
  pemiliknya sendiri.

## E. Rancangan Workflow (STEP 5)

```
Laporan Insiden:
draft → dilaporkan → diverifikasi → investigasi → analisis
      → rencana_tindak_lanjut → pelaksanaan → verifikasi_penyelesaian → selesai

Business rule (bagian 27 prompt):
  severity_grade IN ('kuning','merah') → investigation_required = TRUE
  severity_grade IN ('biru','hijau')   → investigation_required = FALSE
                                          (investigasi sederhana opsional)
```

Transisi status di atas ditegakkan di lapisan aplikasi (`StatusActions` pada
`IkpIncidentDetail.tsx`, tombol "Lanjutkan ke: <status berikut>" — hanya
tampil untuk reviewer), bukan hanya di UI: RLS `ikp_incidents_update`
membatasi siapa yang boleh mengubah `status` sama sekali.

---

## F. Yang TIDAK diubah / risiko terhadap fitur existing (bagian 31 prompt)

Perubahan pada kode existing dijaga **seminimal dan seaditif mungkin**:

| File | Perubahan | Alasan aman |
|---|---|---|
| `src/types/index.ts` | `AuditLogEntry['type']` +`'ikp'` | Union type diperluas, nilai lama tetap valid |
| `src/lib/supabaseData.ts` | `AuditLogDocument['type']` +`'ikp'` | sama seperti di atas |
| `src/contexts/AuthContext.tsx` | tambah `role`, `ikpRoles` ke context; query profil tambah 2 kolom dengan **fallback otomatis** ke query lama jika `ikp_roles` belum ada (migrasi belum jalan) | `unitId` (dipakai luas di app) tidak pernah berhenti berfungsi |
| `src/components/dashboard/DashboardSidebar.tsx` | 1 blok section baru disisipkan sebelum "Analitik"; import ikon tambahan | Tidak menyentuh section indikator/analitik existing |
| `src/app/page.tsx` | 1 import, 1 baris state (`canReviewIkp`), 1 branch render (`activeTab.startsWith('ikp-')`), pengecualian `ikp-*` di 3 kondisi shortcut/entry-count yang sudah ada | Tidak mengubah logic existing untuk tab non-IKP |
| `NotificationPanel.tsx` / `AuditTrailPanel.tsx` | tambah 1 entri `TYPE_CONFIG['ikp']` + 1 opsi filter | Entri lama tidak berubah; fallback ke style 'input' sudah ada sejak awal jika tidak dipatch |

**Sudah divalidasi**: `tsc --noEmit` dijalankan atas seluruh proyek (dengan
dependency ter-install). Semua error yang tersisa adalah bug pre-existing
di kode asli (mis. `LoginPage.tsx`/`SignupPage.tsx` framer-motion variants,
`examples/websocket` module, `calculations.ts` typing) — **tidak ada error
baru dari modul IKP maupun dari file yang dipatch**.

`npm run build` **belum** dijalankan sampai selesai (Prisma postinstall
gagal karena sandbox ini tidak punya akses ke `binaries.prisma.sh`, di luar
kendali modul IKP — di environment Anda seharusnya lancar). Mohon jalankan
`bun run build` (atau `npm run build` setelah `prisma generate` berhasil)
di lingkungan Anda sebelum deploy.

---

## G. Kriteria yang sudah/​belum terpenuhi (bagian 33 prompt)

**Sudah**: menu sidebar, dashboard + filter, form pelaporan (draft/submit),
nomor otomatis, klasifikasi, grading, workflow status, investigasi, analisis
(ringkas), tindak lanjut + PIC + deadline + indikator terlambat, notifikasi
(via audit log existing), audit trail, role/permission (RLS + `ikp_roles`
+ **UI Manajemen Pengguna & Role untuk admin**), attachment (dengan validasi
tipe/ukuran & RLS Storage), statistik dashboard, filter, export CSV,
responsive (pakai komponen existing yang sudah responsif).

**Belum / perlu iterasi lanjutan** (di luar scope realistis satu batch ini):
- Export ke format **Excel (.xlsx)** asli dan **PDF** — saat ini export berupa
  **CSV** (dibuka Excel dengan baik, tapi bukan `.xlsx`/PDF sungguhan).
  `xlsx` package sudah ada di dependencies aplikasi, tinggal diarahkan.
- **Fishbone/Ishikawa diagram visual** — data faktor kontributor sudah
  tersimpan terstruktur, tapi belum ada kanvas diagram.
- **Automated testing** (bagian 30) belum dibuat.
- Alur khusus K3 untuk insiden non-pasien (lihat B.2 poin 4).
- `npm/bun run build` end-to-end di lingkungan Anda (lihat catatan di atas).

---

## H. Langkah setup di sisi Anda

1. Jalankan `supabase/migration_ikp.sql` di Supabase SQL Editor (setelah
   `migration.sql` yang lama, kalau belum pernah dijalankan).
2. **Bootstrap admin pertama (WAJIB, satu kali, lewat SQL)** — sebelum ini,
   tidak ada satupun pengguna yang bisa membuka menu "Manajemen Pengguna &
   Role", karena aksesnya memang dijaga ketat (least privilege): hanya admin
   yang boleh mengubah role. Jalankan di Supabase SQL Editor:
   ```sql
   update public.profiles set role = 'admin'
   where email = 'email_akun_anda@contoh.com';
   ```
   Setelah ini, login dengan akun tersebut → buka **IKP / Keselamatan Pasien
   → Master Data IKP** → akan muncul panel **"Manajemen Pengguna & Role"**
   di bagian atas (hanya terlihat oleh admin). Dari situ, admin bisa mengatur
   role `user`/`admin` dan peran IKP (`Verifikator`/`Tim Mutu`/`Pimpinan`)
   untuk semua pengguna lain **tanpa perlu SQL lagi**.
3. `bun install && bun run build` (atau `npm install && npm run build`) untuk
   verifikasi build penuh di lingkungan Anda.
4. Tinjau seluruh poin **"Perlu konfirmasi"** di atas bersama Tim
   Keselamatan Pasien sebelum go-live.

### Catatan keamanan soal role admin
Pencabutan/pemberian role `admin` **tidak bisa dilakukan pada akun sendiri**
lewat panel ini (tombol akan menolak) — mencegah admin tidak sengaja
mengunci dirinya sendiri dari sistem. Semua perubahan role juga tetap
ditegakkan oleh RLS di database (`profiles_update_own_or_admin`), jadi
proteksi ini bukan cuma di tampilan UI.

