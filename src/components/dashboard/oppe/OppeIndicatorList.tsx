'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Database, Plus, Search, Pencil, Loader2, ShieldAlert, Info, Layers } from 'lucide-react';
import {
  OPPE_DATA_TYPE_OPTIONS, OPPE_TARGET_OPERATOR_OPTIONS, OPPE_TRIGGER_OPERATOR_OPTIONS, OPPE_DEFAULT_OPTIONS, isCategoricalType,
  type OppeIndicator, type OppeDataType,
} from '@/types/oppe';
import { getOppeIndicators, saveOppeIndicator, validateIndicator, friendlyOppeError, getQualityIndicatorOptions } from '@/lib/oppeData';
import { describeTarget, fmtNum, validateCategoryWeights } from '@/lib/oppeScoring';
import { toastSuccess, toastError } from '@/lib/toast-helpers';
import { OppeLoading, OppeEmpty, OppeErrorState, OppePageHeader, useDebounced, ALL, type OppeMasters } from './OppeShared';
import { OppeTemplateList } from './OppeTemplateList';

interface Props {
  masters: OppeMasters;
  canManage: boolean;
  actor: { id: string; name: string };
  onMastersChanged: () => void;
  initialTab?: 'indicators' | 'templates';
}

export function OppeIndicatorList({ masters, canManage, actor, onMastersChanged, initialTab = 'indicators' }: Props) {
  const [rows, setRows] = useState<OppeIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState(ALL);
  const [ksmId, setKsmId] = useState(ALL);
  const [active, setActive] = useState('true');
  const [editing, setEditing] = useState<Partial<OppeIndicator> | null>(null);
  const q = useDebounced(search);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows(await getOppeIndicators({
        search: q || undefined,
        categoryId: categoryId === ALL ? undefined : categoryId,
        ksmId: ksmId === ALL ? undefined : ksmId === '__none' ? undefined : ksmId,
        active: active === ALL ? undefined : active === 'true',
      }));
    } catch (e) {
      setError(friendlyOppeError(e, 'Master indikator gagal dimuat.'));
    } finally {
      setLoading(false);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [q, categoryId, ksmId, active]);

  const visible = ksmId === '__none' ? rows.filter((r) => !r.ksmId) : rows;
  const catById = useMemo(() => new Map(masters.categories.map((c) => [c.id, c])), [masters.categories]);
  const ksmById = useMemo(() => new Map(masters.ksm.map((k) => [k.id, k])), [masters.ksm]);
  const weights = validateCategoryWeights(masters.categories);

  return (
    <div className="p-4 space-y-4">
      <OppePageHeader
        icon={Database}
        title="Master Indikator OPPE"
        description="Indikator, target, trigger, bobot, dan template per KSM. Seed awal diambil dari file referensi OPPE BARU (dr. Sri, RSASM)."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {masters.categories.filter((c) => c.isActive).map((c) => (
          <Card key={c.id}>
            <CardContent className="pt-4 pb-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Kategori {c.code}</p>
              <p className="text-sm font-semibold">{c.name}</p>
              <p className="text-2xl font-bold">{fmtNum(c.weight)}%</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {!weights.ok && (
        <p className="text-sm text-red-500 flex items-center gap-1.5"><ShieldAlert className="size-4" />Total bobot kategori aktif {weights.total}% — harus 100%. Perbaiki di Pengaturan OPPE.</p>
      )}

      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="indicators" className="gap-1.5"><Database className="size-3.5" />Indikator</TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5"><Layers className="size-3.5" />Template OPPE per KSM</TabsTrigger>
        </TabsList>

        <TabsContent value="indicators">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kode / nama indikator…" className="pl-8 h-9" />
                </div>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="w-[220px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={ALL}>Semua kategori</SelectItem>{masters.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.code}. {c.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={ksmId} onValueChange={setKsmId}>
                  <SelectTrigger className="w-[220px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={ALL}>Semua KSM</SelectItem><SelectItem value="__none">Umum (tanpa KSM)</SelectItem>{masters.ksm.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={active} onValueChange={setActive}>
                  <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={ALL}>Semua</SelectItem><SelectItem value="true">Aktif</SelectItem><SelectItem value="false">Nonaktif</SelectItem></SelectContent>
                </Select>
                {canManage && (
                  <Button size="sm" className="gap-1.5 h-9" onClick={() => setEditing({ isActive: true, dataType: 'percent', targetOperator: 'gte', triggerOperator: 'lt', weight: 1, options: [], passValues: [], attentionValues: [], isCritical: false, unitLabel: '%' })}>
                    <Plus className="size-4" />Indikator Baru
                  </Button>
                )}
              </div>

              {loading ? <OppeLoading /> : error ? <OppeErrorState message={error} onRetry={load} /> : visible.length === 0 ? (
                <OppeEmpty title="Tidak ada indikator" description="Ubah filter atau tambahkan indikator baru." />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[90px]">Kode</TableHead>
                        <TableHead>Indikator</TableHead>
                        <TableHead>KSM</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Trigger</TableHead>
                        <TableHead>Sumber Data</TableHead>
                        <TableHead className="text-right">Bobot</TableHead>
                        <TableHead>Status</TableHead>
                        {canManage && <TableHead className="text-right">Aksi</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((r) => (
                        <TableRow key={r.id} className={r.isActive ? '' : 'opacity-50'}>
                          <TableCell className="font-mono text-xs">{r.code}</TableCell>
                          <TableCell className="text-sm max-w-[360px]">
                            <span className="text-[10px] text-muted-foreground mr-1">{catById.get(r.categoryId)?.code}</span>
                            {r.name}
                            {r.isCritical && <Badge variant="destructive" className="ml-1.5 text-[9px]">KRITIS</Badge>}
                            {r.referenceNote && r.referenceNote.includes('—') && (
                              <Tooltip><TooltipTrigger asChild><Info className="inline size-3.5 ml-1 text-amber-500" /></TooltipTrigger><TooltipContent className="max-w-xs text-xs">{r.referenceNote}</TooltipContent></Tooltip>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{r.ksmId ? ksmById.get(r.ksmId)?.name : 'Umum'}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{r.targetText || describeTarget(r, r.unitLabel)}</TableCell>
                          <TableCell className="text-xs">{r.triggerText ?? '—'}</TableCell>
                          <TableCell className="text-xs">{r.sourceData ?? '—'}</TableCell>
                          <TableCell className="text-right text-xs">{fmtNum(r.weight)}</TableCell>
                          <TableCell><Badge variant={r.isActive ? 'secondary' : 'outline'} className="text-[10px]">{r.isActive ? 'Aktif' : 'Nonaktif'}</Badge></TableCell>
                          {canManage && (
                            <TableCell className="text-right whitespace-nowrap">
                              <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditing(r)}><Pencil className="size-4" /></Button>
                              <Switch
                                checked={r.isActive}
                                onCheckedChange={async (v) => {
                                  try { await saveOppeIndicator({ ...r, isActive: v }, actor); toastSuccess(v ? 'Indikator diaktifkan' : 'Indikator dinonaktifkan'); load(); }
                                  catch (e) { toastError(friendlyOppeError(e)); }
                                }}
                                className="ml-1 align-middle"
                              />
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="text-xs text-muted-foreground pt-2">{visible.length} indikator</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <OppeTemplateList masters={masters} canManage={canManage} actor={actor} onChanged={onMastersChanged} />
        </TabsContent>
      </Tabs>

      {editing && <OppeIndicatorForm masters={masters} initial={editing} actor={actor} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function L({ children, req }: { children: React.ReactNode; req?: boolean }) {
  return <Label className="text-xs">{children}{req && <span className="text-red-500"> *</span>}</Label>;
}

const csv = (a: string[] | undefined) => (a ?? []).join(', ');
const parseCsv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export function OppeIndicatorForm({ masters, initial, actor, onClose, onSaved }: { masters: OppeMasters; initial: Partial<OppeIndicator>; actor: { id: string; name: string }; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Partial<OppeIndicator>>(initial);
  const [optionsText, setOptionsText] = useState(csv(initial.options));
  const [passText, setPassText] = useState(csv(initial.passValues));
  const [attText, setAttText] = useState(csv(initial.attentionValues));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [qiOptions, setQiOptions] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const set = <K extends keyof OppeIndicator>(k: K, v: OppeIndicator[K] | null) => setF((p) => ({ ...p, [k]: v }));
  const categorical = isCategoricalType((f.dataType ?? 'percent') as OppeDataType) || f.targetOperator === 'category';

  useEffect(() => { getQualityIndicatorOptions().then(setQiOptions); }, []);

  function onDataType(v: OppeDataType) {
    const def = OPPE_DEFAULT_OPTIONS[v];
    const unit = OPPE_DATA_TYPE_OPTIONS.find((o) => o.value === v)?.unit ?? '';
    setF((p) => ({
      ...p, dataType: v, unitLabel: isCategoricalType(v) ? 'kategori' : unit,
      ...(isCategoricalType(v) ? { targetOperator: 'category', triggerOperator: 'not_pass', targetValue: null, triggerValue: null } : {}),
      ...(!isCategoricalType(v) && p.targetOperator === 'category' ? { targetOperator: 'gte', triggerOperator: 'lt' } : {}),
    }));
    if (def) { setOptionsText(def.options.join(', ')); setPassText(def.pass.join(', ')); setAttText(def.attention.join(', ')); }
  }

  const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));

  async function submit() {
    const payload: Partial<OppeIndicator> = {
      ...f,
      options: categorical ? parseCsv(optionsText) : [],
      passValues: categorical ? parseCsv(passText) : [],
      attentionValues: categorical ? parseCsv(attText) : [],
    };
    const invalid = validateIndicator(payload);
    if (invalid) { setErr(invalid); return; }
    setSaving(true);
    setErr(null);
    try {
      const qi = qiOptions.find((o) => o.id === payload.qualityIndicatorId);
      await saveOppeIndicator({ ...payload, code: payload.code!.trim().toUpperCase(), qualityIndicatorName: qi?.name ?? null }, actor);
      toastSuccess('Indikator disimpan');
      onSaved();
    } catch (e) {
      setErr(friendlyOppeError(e, 'Indikator gagal disimpan. Silakan coba kembali.'));
    } finally {
      setSaving(false);
    }
  }

  const professions = masters.options.filter((o) => o.kind === 'profession' && o.isActive);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{f.id ? `Edit Indikator ${f.code}` : 'Indikator OPPE Baru'}</DialogTitle>
          <DialogDescription>Perubahan master hanya berlaku untuk evaluasi yang dibuat setelahnya — evaluasi lama menyimpan snapshot aturan saat dibuat.</DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1"><L req>Kode</L><Input value={f.code ?? ''} onChange={(e) => set('code', e.target.value)} placeholder="ANS-C7" /></div>
          <div className="space-y-1"><L req>Kategori</L>
            <Select value={f.categoryId ?? ''} onValueChange={(v) => set('categoryId', v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Pilih" /></SelectTrigger>
              <SelectContent>{masters.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.code}. {c.name} ({fmtNum(c.weight)}%)</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><L>Jenis indikator</L>
            <Select value={f.indicatorType ?? '__none'} onValueChange={(v) => set('indicatorType', v === '__none' ? null : v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="__none">—</SelectItem><SelectItem value="struktur">Struktur</SelectItem><SelectItem value="proses">Proses</SelectItem><SelectItem value="outcome">Outcome</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-3"><L req>Nama indikator / parameter</L><Input value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} /></div>
          <div className="space-y-1"><L>KSM</L>
            <Select value={f.ksmId ?? '__none'} onValueChange={(v) => set('ksmId', v === '__none' ? null : v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="__none">Umum (semua KSM)</SelectItem>{masters.ksm.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><L>Profesi</L>
            <Select value={f.profession ?? '__none'} onValueChange={(v) => set('profession', v === '__none' ? null : v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="__none">Semua profesi</SelectItem>{professions.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><L>Unit</L>
            <Select value={f.unitId ?? '__none'} onValueChange={(v) => set('unitId', v === '__none' ? null : v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="__none">Semua unit</SelectItem>{masters.units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-3"><L>Deskripsi / definisi operasional</L><Textarea rows={2} value={f.operationalDefinition ?? ''} onChange={(e) => set('operationalDefinition', e.target.value)} /></div>
          <div className="space-y-1"><L>Numerator</L><Input value={f.numerator ?? ''} onChange={(e) => set('numerator', e.target.value)} /></div>
          <div className="space-y-1"><L>Denominator</L><Input value={f.denominator ?? ''} onChange={(e) => set('denominator', e.target.value)} /></div>
          <div className="space-y-1"><L>Satuan</L><Input value={f.unitLabel ?? ''} onChange={(e) => set('unitLabel', e.target.value)} placeholder="%, kasus, SKP, kali" /></div>

          <div className="sm:col-span-3 border-t pt-3 text-xs font-semibold text-muted-foreground">TARGET & TRIGGER</div>
          <div className="space-y-1"><L req>Tipe data realisasi</L>
            <Select value={f.dataType ?? 'percent'} onValueChange={(v) => onDataType(v as OppeDataType)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{OPPE_DATA_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><L req>Jenis target</L>
            <Select value={f.targetOperator ?? 'gte'} onValueChange={(v) => set('targetOperator', v as OppeIndicator['targetOperator'])}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{OPPE_TARGET_OPERATOR_OPTIONS.filter((o) => categorical ? o.value === 'category' : o.value !== 'category').map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {!categorical && (
            <div className="space-y-1"><L>Nilai target</L><Input inputMode="decimal" value={f.targetValue ?? ''} onChange={(e) => set('targetValue', numOrNull(e.target.value))} disabled={f.targetOperator === 'zero' || f.targetOperator === 'pct100'} placeholder={f.targetOperator === 'zero' ? '0' : f.targetOperator === 'pct100' ? '100' : 'mis. 95'} /></div>
          )}
          <div className="space-y-1"><L>Teks target (tampilan)</L><Input value={f.targetText ?? ''} onChange={(e) => set('targetText', e.target.value)} placeholder={describeTarget({ targetOperator: f.targetOperator ?? 'gte', targetValue: f.targetValue ?? null, passValues: parseCsv(passText), dataType: f.dataType ?? 'percent' }, f.unitLabel)} /></div>
          <div className="space-y-1"><L req>Jenis trigger</L>
            <Select value={f.triggerOperator ?? 'lt'} onValueChange={(v) => set('triggerOperator', v as OppeIndicator['triggerOperator'])}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{OPPE_TRIGGER_OPERATOR_OPTIONS.filter((o) => categorical ? ['not_pass'].includes(o.value) : o.value !== 'not_pass').map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {!categorical && ['lt', 'lte', 'gt', 'gte', 'eq', 'neq'].includes(f.triggerOperator ?? '') && (
            <div className="space-y-1"><L req>Nilai trigger</L><Input inputMode="decimal" value={f.triggerValue ?? ''} onChange={(e) => set('triggerValue', numOrNull(e.target.value))} placeholder="mis. 90" /></div>
          )}
          <div className="space-y-1"><L>Teks trigger (tampilan)</L><Input value={f.triggerText ?? ''} onChange={(e) => set('triggerText', e.target.value)} placeholder="< 90%" /></div>
          {!categorical && (
            <>
              <div className="space-y-1"><L>Nilai minimum valid</L><Input inputMode="decimal" value={f.minValue ?? ''} onChange={(e) => set('minValue', numOrNull(e.target.value))} /></div>
              <div className="space-y-1"><L>Nilai maksimum valid</L><Input inputMode="decimal" value={f.maxValue ?? ''} onChange={(e) => set('maxValue', numOrNull(e.target.value))} /></div>
            </>
          )}
          {categorical && (
            <>
              <div className="space-y-1"><L req>Pilihan nilai (pisah koma)</L><Input value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder="Baik, Cukup, Kurang" /></div>
              <div className="space-y-1"><L req>Nilai memenuhi</L><Input value={passText} onChange={(e) => setPassText(e.target.value)} placeholder="Baik" /></div>
              <div className="space-y-1"><L>Nilai perlu perhatian</L><Input value={attText} onChange={(e) => setAttText(e.target.value)} placeholder="Cukup" /></div>
            </>
          )}
          <div className="sm:col-span-3 flex items-center gap-2 rounded-md border p-2.5">
            <Switch checked={!!f.isCritical} onCheckedChange={(v) => set('isCritical', v)} />
            <div>
              <p className="text-sm font-medium">Indikator kritis</p>
              <p className="text-xs text-muted-foreground">Bila terkena trigger, sistem memberi peringatan & merekomendasikan FPPE walaupun skor total tinggi.</p>
            </div>
          </div>

          <div className="sm:col-span-3 border-t pt-3 text-xs font-semibold text-muted-foreground">PENGUKURAN & SKOR</div>
          <div className="space-y-1"><L>Sumber data</L><Input value={f.sourceData ?? ''} onChange={(e) => set('sourceData', e.target.value)} /></div>
          <div className="space-y-1"><L>Metode pengukuran</L><Input value={f.measurementMethod ?? ''} onChange={(e) => set('measurementMethod', e.target.value)} /></div>
          <div className="space-y-1"><L>Frekuensi</L><Input value={f.frequency ?? ''} onChange={(e) => set('frequency', e.target.value)} placeholder="Bulanan / Semester" /></div>
          <div className="space-y-1"><L>Periode evaluasi</L><Input value={f.evaluationPeriod ?? ''} onChange={(e) => set('evaluationPeriod', e.target.value)} placeholder="Semester / Tahunan" /></div>
          <div className="space-y-1"><L>Bobot dalam kategori</L><Input inputMode="decimal" value={f.weight ?? 1} onChange={(e) => set('weight', numOrNull(e.target.value) ?? 1)} /></div>
          <div className="space-y-1"><L>Aktif</L><div className="h-9 flex items-center"><Switch checked={f.isActive ?? true} onCheckedChange={(v) => set('isActive', v)} /></div></div>
          <div className="space-y-1"><L>Skor memenuhi (kosong = default {masters.settings.scoreMet})</L><Input inputMode="decimal" value={f.scoreMet ?? ''} onChange={(e) => set('scoreMet', numOrNull(e.target.value))} /></div>
          <div className="space-y-1"><L>Skor perlu perhatian (default {masters.settings.scoreAttention})</L><Input inputMode="decimal" value={f.scoreAttention ?? ''} onChange={(e) => set('scoreAttention', numOrNull(e.target.value))} /></div>
          <div className="space-y-1"><L>Skor trigger (default {masters.settings.scoreTrigger})</L><Input inputMode="decimal" value={f.scoreTrigger ?? ''} onChange={(e) => set('scoreTrigger', numOrNull(e.target.value))} /></div>
          <div className="space-y-1 sm:col-span-3"><L>Gunakan indikator mutu klinis sebagai sumber data (opsional)</L>
            <Select value={f.qualityIndicatorId ?? '__none'} onValueChange={(v) => set('qualityIndicatorId', v === '__none' ? null : v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="__none">— Tidak ditautkan —</SelectItem>{qiOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.code ? `${o.code} · ` : ''}{o.name}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Ditautkan lewat reference ID ke modul Master Indikator Mutu (tanpa menggandakan data). Evaluator dapat menarik nilainya saat mengisi realisasi.</p>
          </div>
          {f.referenceNote && <p className="sm:col-span-3 text-[11px] text-amber-600">{f.referenceNote}</p>}
        </div>
        {err && <p className="text-sm text-red-500">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={saving} className="gap-1.5">{saving && <Loader2 className="size-4 animate-spin" />}Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
