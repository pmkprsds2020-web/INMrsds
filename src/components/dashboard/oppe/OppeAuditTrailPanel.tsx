'use client';

import { Fragment, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { History, ChevronDown, ChevronRight } from 'lucide-react';
import { OPPE_AUDIT_ACTION_LABEL, type OppeAuditAction, type OppeAuditEntry } from '@/types/oppe';
import { getOppeAuditTrail, friendlyOppeError } from '@/lib/oppeData';
import { OppeLoading, OppeEmpty, OppeErrorState, OppePageHeader, OppePagination, ALL, fmtDateTime } from './OppeShared';

const PAGE_SIZE = 30;
const ENTITY_LABEL: Record<string, string> = {
  oppe_evaluations: 'Evaluasi', oppe_doctors: 'Dokter', oppe_indicators: 'Indikator', oppe_templates: 'Template', oppe_fppe: 'FPPE',
  oppe_settings: 'Pengaturan', oppe_indicator_categories: 'Kategori/Bobot', oppe_report: 'Laporan', oppe_export: 'Export', oppe_import_format: 'Export',
};

/** Audit trail OPPE (append-only — tidak bisa diubah/dihapus, dijaga trigger DB). */
export function OppeAuditTrailPanel({ onOpenEvaluation }: { onOpenEvaluation: (id: string) => void }) {
  const [rows, setRows] = useState<OppeAuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [action, setAction] = useState(ALL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await getOppeAuditTrail({ action: action === ALL ? undefined : (action as OppeAuditAction), page, pageSize: PAGE_SIZE });
      setRows(r.rows);
      setTotal(r.total);
    } catch (e) {
      setError(friendlyOppeError(e, 'Audit trail gagal dimuat.'));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { setPage(0); }, [action]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [action, page]);

  return (
    <div className="p-4 space-y-4">
      <OppePageHeader
        icon={History}
        title="Audit Trail OPPE"
        description="Seluruh aktivitas OPPE: create, update, delete, import, export, review, approve, finalize, reopen, FPPE. Catatan bersifat permanen."
        actions={
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Semua aksi</SelectItem>{(Object.keys(OPPE_AUDIT_ACTION_LABEL) as OppeAuditAction[]).map((a) => <SelectItem key={a} value={a}>{OPPE_AUDIT_ACTION_LABEL[a]}</SelectItem>)}</SelectContent>
          </Select>
        }
      />
      <Card>
        <CardContent className="pt-4">
          {loading ? <OppeLoading /> : error ? <OppeErrorState message={error} onRetry={load} /> : rows.length === 0 ? <OppeEmpty title="Belum ada aktivitas" /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead className="w-8" /><TableHead>Waktu</TableHead><TableHead>Pengguna</TableHead><TableHead>Aksi</TableHead><TableHead>Record</TableHead><TableHead>Alasan</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <Fragment key={r.id}>
                      <TableRow>
                        <TableCell>
                          {(r.oldData || r.newData) && (
                            <Button size="icon" variant="ghost" className="size-7" onClick={() => setOpen((s) => ({ ...s, [r.id]: !s[r.id] }))}>{open[r.id] ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</Button>
                          )}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(r.createdAt)}</TableCell>
                        <TableCell className="text-sm">{r.userName ?? r.userId?.slice(0, 8) ?? '—'}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{OPPE_AUDIT_ACTION_LABEL[r.action] ?? r.action}</Badge></TableCell>
                        <TableCell className="text-xs">
                          {ENTITY_LABEL[r.entityType] ?? r.entityType}
                          {r.evaluationId && <Button size="sm" variant="link" className="h-auto p-0 ml-1 text-xs" onClick={() => onOpenEvaluation(r.evaluationId!)}>buka</Button>}
                        </TableCell>
                        <TableCell className="text-xs max-w-[280px]">{r.reason ?? '—'}</TableCell>
                      </TableRow>
                      {open[r.id] && (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell />
                          <TableCell colSpan={5}>
                            <div className="grid md:grid-cols-2 gap-3 text-[11px]">
                              <div><p className="font-semibold mb-1">Nilai lama</p><pre className="whitespace-pre-wrap break-all bg-muted/40 rounded p-2 max-h-60 overflow-auto">{r.oldData ? JSON.stringify(r.oldData, null, 2) : '—'}</pre></div>
                              <div><p className="font-semibold mb-1">Nilai baru</p><pre className="whitespace-pre-wrap break-all bg-muted/40 rounded p-2 max-h-60 overflow-auto">{r.newData ? JSON.stringify(r.newData, null, 2) : '—'}</pre></div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <OppePagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}
