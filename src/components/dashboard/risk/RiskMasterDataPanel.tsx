'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database } from 'lucide-react';
import {
  RISK_CATEGORIES, RISK_UNITS, RISK_STATUS_LABEL, RISK_LEVEL_LABEL, RISK_LEVEL_COLOR,
  RISK_MITIGATION_STATUS_LABEL, RISK_ROLE_LABEL, RISK_YEARS,
} from '@/types/risk';

/**
 * Master data ditampilkan sebagai referensi (bukan tabel bebas-edit dari UI) —
 * konsisten dengan pola modul IKP: istilah baku dari dokumen acuan disimpan
 * sebagai konstanta TypeScript (src/types/risk.ts) supaya tidak berubah diam-
 * diam. Admin mengelola Risk Owner/PIC dan peran (risk_roles) langsung lewat
 * tabel profiles (lihat catatan di akhir supabase/migration_risk.sql).
 */
export function RiskMasterDataPanel({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Database className="size-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Master Data Risiko</h2>
          <p className="text-xs text-muted-foreground">
            Istilah baku dari Risk Register (kategori, unit, skala, status) — tetap sesuai dokumen acuan
            dan tidak dapat diubah bebas dari UI untuk menjaga konsistensi Risk Register lintas tahun.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Kategori Risiko ({RISK_CATEGORIES.length})</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {RISK_CATEGORIES.map((c) => <Badge key={c.id} variant="outline" className="text-[10px]">{c.label}</Badge>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Unit/Lokasi ({RISK_UNITS.length})</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {RISK_UNITS.map((u) => <Badge key={u} variant="outline" className="text-[10px]">{u}</Badge>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Level Risiko</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {Object.entries(RISK_LEVEL_LABEL).map(([k, v]) => (
              <Badge key={k} style={{ backgroundColor: RISK_LEVEL_COLOR[k as keyof typeof RISK_LEVEL_COLOR], color: 'white', border: 'none' }} className="text-[10px]">{v}</Badge>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Status Risiko</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {Object.entries(RISK_STATUS_LABEL).map(([k, v]) => <Badge key={k} variant="outline" className="text-[10px]">{v}</Badge>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Status Mitigasi</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {Object.entries(RISK_MITIGATION_STATUS_LABEL).map(([k, v]) => <Badge key={k} variant="outline" className="text-[10px]">{v}</Badge>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Periode Risk Register</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {RISK_YEARS.map((y) => <Badge key={y} variant="outline" className="text-[10px]">{y}</Badge>)}
          </CardContent>
        </Card>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Peran (Role) Modul Risiko</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Admin memberi peran tambahan ke user lewat kolom <code className="text-[10px] bg-muted px-1 py-0.5 rounded">risk_roles</code> pada
              tabel <code className="text-[10px] bg-muted px-1 py-0.5 rounded">profiles</code> (lihat contoh SQL di akhir <code className="text-[10px] bg-muted px-1 py-0.5 rounded">migration_risk.sql</code>).
              User dengan role dasar <code className="text-[10px] bg-muted px-1 py-0.5 rounded">admin</code> otomatis memiliki semua akses.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(RISK_ROLE_LABEL).map(([k, v]) => <Badge key={k} variant="outline" className="text-[10px]">{v}</Badge>)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
