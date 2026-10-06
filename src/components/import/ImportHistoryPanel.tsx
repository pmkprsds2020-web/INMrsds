'use client';

/**
 * Riwayat Import (MASTER PROMPT bagian 18) — bisa dipasang per modul
 * (filter by module) atau lintas modul (Import Center, bagian 33).
 */
import { useEffect, useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase/client';

interface ImportHistoryRow {
  id: string;
  module: string;
  file_name: string;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  duplicate_rows: number;
  status: string;
  created_at: string;
  user_id: string | null;
}

const MODULE_LABEL: Record<string, string> = {
  risk: 'Manajemen Risiko',
  ikp: 'IKP',
  budaya: 'Survei Budaya Keselamatan',
  kepuasan: 'Survei Kepuasan Pasien',
  uimu: 'UIMU',
  custom_indicator: 'Indikator Mutu Custom',
  oppe: 'OPPE',
};

const STATUS_STYLE: Record<string, string> = {
  SUCCESS: 'bg-emerald-500/20 text-emerald-400',
  PARTIAL: 'bg-amber-500/20 text-amber-400',
  FAILED: 'bg-red-500/20 text-red-400',
  PROCESSING: 'bg-sky-500/20 text-sky-400',
  CANCELLED: 'bg-muted text-muted-foreground',
};

export function ImportHistoryPanel({ module }: { module?: string }) {
  const [rows, setRows] = useState<ImportHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let query = supabase.from('import_history').select('*').order('created_at', { ascending: false }).limit(100);
      if (module) query = query.eq('module', module);
      const { data } = await query;
      if (!cancelled) {
        setRows((data as ImportHistoryRow[]) ?? []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [module]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground text-xs gap-2">
        <Loader2 className="size-4 animate-spin" /> Memuat riwayat import...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-xs gap-2">
        <History className="size-6 opacity-40" />
        Belum ada riwayat import.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[10px]">Tanggal</TableHead>
            {!module && <TableHead className="text-[10px]">Modul</TableHead>}
            <TableHead className="text-[10px]">Nama File</TableHead>
            <TableHead className="text-[10px] text-right">Total</TableHead>
            <TableHead className="text-[10px] text-right">Berhasil</TableHead>
            <TableHead className="text-[10px] text-right">Error</TableHead>
            <TableHead className="text-[10px] text-right">Duplikat</TableHead>
            <TableHead className="text-[10px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-xs whitespace-nowrap">{format(new Date(r.created_at), 'dd MMM yyyy HH:mm', { locale: localeId })}</TableCell>
              {!module && <TableCell className="text-xs">{MODULE_LABEL[r.module] ?? r.module}</TableCell>}
              <TableCell className="text-xs max-w-[220px] truncate">{r.file_name}</TableCell>
              <TableCell className="text-xs text-right">{r.total_rows}</TableCell>
              <TableCell className="text-xs text-right text-emerald-400">{r.success_rows}</TableCell>
              <TableCell className="text-xs text-right text-red-400">{r.error_rows}</TableCell>
              <TableCell className="text-xs text-right text-amber-400">{r.duplicate_rows}</TableCell>
              <TableCell>
                <Badge className={`border-0 text-[10px] ${STATUS_STYLE[r.status] ?? ''}`}>{r.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
