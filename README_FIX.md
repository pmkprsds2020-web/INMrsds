# Perbaikan — 2 file yang kelupaan di paket sebelumnya

Ini murni kesalahan saya: DashboardSidebar.tsx dan AuthContext.tsx sudah
saya kerjakan sebelumnya tapi tidak ikut ter-zip. Akibatnya menu "Survey
Budaya Keselamatan" tidak pernah muncul walau semua file lain sudah benar.

## Cara pakai
Extract, TIMPA 2 file ini di project Anda:
- src/components/dashboard/DashboardSidebar.tsx
- src/contexts/AuthContext.tsx

Sudah saya cross-check ulang SEMUA file budaya lain (types, lib, komponen,
page.tsx, migration SQL) terhadap project Anda yang baru diupload — semua
sudah identik dan benar, tidak perlu disentuh lagi.

## Setelah menimpa
git add .
git commit -m "fix: lengkapi wiring sidebar dan AuthContext untuk modul budaya"
git push

Tunggu Vercel build selesai (~1-3 menit), lalu refresh — menu "Survey
Budaya Keselamatan" akan muncul di sidebar.
