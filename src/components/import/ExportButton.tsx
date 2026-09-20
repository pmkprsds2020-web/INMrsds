'use client';

import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import type { ImportConfig } from '@/lib/import-engine/types';
import { exportModuleData } from '@/lib/import-engine/exportData';

/**
 * Export data existing supaya bisa diedit lalu diimport kembali tanpa
 * mengubah struktur file (bagian 30). `rows` diberikan oleh pemanggil
 * (hasil query modul yang sedang ditampilkan) supaya filter yang sedang
 * aktif di layar (periode/unit/status) ikut terbawa ke hasil export.
 */
export function ExportButton({
  config, rows, size = 'sm', label = 'Export Excel',
}: { config: ImportConfig; rows: Record<string, unknown>[]; size?: 'sm' | 'default'; label?: string }) {
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    if (rows.length === 0) {
      toast.info('Tidak ada data untuk diexport.');
      return;
    }
    setLoading(true);
    try {
      await exportModuleData(supabase, config, rows);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button variant="outline" size={size} onClick={handleClick} disabled={loading} className="gap-1.5">
      {loading ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />} {label}
    </Button>
  );
}
