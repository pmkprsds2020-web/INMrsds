'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, Loader2, ClipboardList } from 'lucide-react';
import {
  type CustomIndicator, type CustomIndicatorStatus,
  STATUS_LABEL, STATUS_COLOR, INDICATOR_KIND_LABEL, ASSIGNABLE_UNIT_IDS, DEFAULT_CATEGORIES,
} from '@/types/customIndicators';
import { getCustomIndicators } from '@/lib/customIndicatorData';

type ListScope = 'all' | 'active' | 'inactive' | 'unit' | 'priority_rs';

const SCOPE_META: Record<ListScope, { title: string; description: string }> = {
  all: { title: 'Semua Indikator', description: 'Seluruh indikator mutu custom, semua status.' },
  active: { title: 'Indikator Aktif', description: 'Indikator yang sedang berjalan dan dapat menerima data pengukuran baru.' },
  inactive: { title: 'Indikator Nonaktif', description: 'Indikator yang dinonaktifkan — data historis tetap tersimpan dan dapat dilihat.' },
  unit: { title: 'Indikator Unit', description: 'Indikator mutu yang dikelola di tingkat unit.' },
  priority_rs: { title: 'Indikator Prioritas RS', description: 'Indikator prioritas rumah sakit, umumnya lintas unit.' },
};

function StatusBadge({ status }: { status: CustomIndicatorStatus }) {
  return (
    <Badge variant="outline" style={{ borderColor: STATUS_COLOR[status], color: STATUS_COLOR[status] }} className="text-[10px]">
      {STATUS_LABEL[status]}
    </Badge>
  );
}

interface CustomIndicatorListProps {
  scope: ListScope;
  isManager: boolean;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
}

export function CustomIndicatorList({ scope, isManager, onSelect, onCreateNew }: CustomIndicatorListProps) {
  const [rows, setRows] = useState<CustomIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const meta = SCOPE_META[scope];

  async function load() {
    setLoading(true);
    try {
      const filters: any = {};
      if (scope === 'active') filters.status = 'active';
      if (scope === 'inactive') filters.status = 'inactive';
      if (scope === 'unit') filters.indicatorType = 'unit';
      if (scope === 'priority_rs') filters.indicatorType = 'priority_rs';
      if (unitFilter !== 'all') filters.unitId = unitFilter;
      const data = await getCustomIndicators(filters);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [scope, unitFilter]);

  const filtered = useMemo(() => {
    let list = rows;
    if (category !== 'all') list = list.filter((r) => r.category === category);
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || (r.picName ?? '').toLowerCase().includes(q));
  }, [rows, search, category]);

  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{meta.title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">{meta.description}</p>
        </div>
        {isManager && (
          <Button size="sm" onClick={onCreateNew} className="gap-1.5"><Plus className="size-4" /> Buat Indikator Baru</Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Cari kode, nama indikator, PIC…" className="pl-8 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Kategori" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {DEFAULT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={unitFilter} onValueChange={setUnitFilter}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Unit" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Unit</SelectItem>
            {ASSIGNABLE_UNIT_IDS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-2 text-center">
              <ClipboardList className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">Belum ada indikator mutu custom.</p>
              <p className="text-xs text-muted-foreground max-w-sm">Buat indikator mutu sesuai kebutuhan unit atau prioritas Rumah Sakit.</p>
              {isManager && <Button size="sm" onClick={onCreateNew} className="gap-1.5 mt-1"><Plus className="size-4" /> Buat Indikator Baru</Button>}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Indikator</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>PIC</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onSelect(r.id)}>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell className="max-w-[260px] truncate">{r.name}</TableCell>
                    <TableCell className="text-xs">{INDICATOR_KIND_LABEL[r.indicatorType]}</TableCell>
                    <TableCell className="text-xs">{r.category}</TableCell>
                    <TableCell className="text-xs">{r.picName ?? '—'}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
