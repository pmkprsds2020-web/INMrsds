'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Settings, Save, Plus, Trash2, Loader2, FileSpreadsheet, ShieldAlert, CheckCircle2 } from 'lucide-react';
import {
  OPPE_DEFAULT_SETTINGS, OPPE_EXCEL_PRESET, OPPE_MASTER_KIND_LABEL,
  type OppeSettings, type OppeResultCategory, type OppeIndicatorCategory, type OppeKsm, type OppeMasterKind, type OppeMasterOption,
} from '@/types/oppe';
import { saveOppeSettings, saveOppeCategories, saveOppeKsm, saveOppeMasterOption, validateResultCategories, friendlyOppeError } from '@/lib/oppeData';
import { validateCategoryWeights, fmtNum } from '@/lib/oppeScoring';
import { toastSuccess, toastError } from '@/lib/toast-helpers';
import { OppePageHeader, type OppeMasters } from './OppeShared';

interface Props {
  masters: OppeMasters;
  isAdmin: boolean;
  isCommittee: boolean;
  actor: { id: string; name: string };
  onChanged: () => void;
}

export function OppeSettingsPanel({ masters, isAdmin, isCommittee, actor, onChanged }: Props) {
  const [s, setS] = useState<OppeSettings>(masters.settings);
  const [cats, setCats] = useState<OppeIndicatorCategory[]>(masters.categories);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { setS(masters.settings); setCats(masters.categories); }, [masters.settings, masters.categories]);

  const catErr = validateResultCategories(s.resultCategories);
  const weights = validateCategoryWeights(cats);
  const setRc = (idx: number, patch: Partial<OppeResultCategory>) => setS((p) => ({ ...p, resultCategories: p.resultCategories.map((c, i) => (i === idx ? { ...c, ...patch } : c)) }));
  const num = (v: string) => (v.trim() === '' ? 0 : Number(v.replace(',', '.')));

  async function saveSettings() {
    if (catErr) { toastError(catErr); return; }
    setBusy('settings');
    try { await saveOppeSettings(s, actor); toastSuccess('Pengaturan OPPE disimpan', { description: 'Berlaku untuk perhitungan berikutnya. Gunakan "Hitung ulang" pada evaluasi yang belum final.' }); onChanged(); }
    catch (e) { toastError(friendlyOppeError(e, 'Pengaturan gagal disimpan.')); }
    finally { setBusy(null); }
  }

  async function saveWeights() {
    if (!weights.ok) { toastError(`Total bobot kategori aktif harus 100% (saat ini ${weights.total}%).`); return; }
    setBusy('weights');
    try { await saveOppeCategories(cats, actor); toastSuccess('Bobot kategori disimpan'); onChanged(); }
    catch (e) { toastError(friendlyOppeError(e, 'Bobot gagal disimpan.')); }
    finally { setBusy(null); }
  }

  return (
    <div className="p-4 space-y-4 max-w-5xl">
      <OppePageHeader icon={Settings} title="Pengaturan OPPE" description="Skor, kategori hasil akhir, bobot kategori, ambang trigger/tren, teks rekomendasi, dan master KSM/profesi. Tidak ada nilai yang di-hard-code." />
      {!isAdmin && <p className="text-xs text-amber-600">Pengaturan skor & kategori hasil hanya dapat diubah Admin. {isCommittee ? 'Komite Medik dapat mengubah bobot kategori dan master KSM/profesi.' : ''}</p>}

      <Tabs defaultValue="score">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="score">Skor & Kategori Hasil</TabsTrigger>
          <TabsTrigger value="weights">Bobot Kategori</TabsTrigger>
          <TabsTrigger value="rules">Rekomendasi & Ambang</TabsTrigger>
          <TabsTrigger value="ksm">Master KSM</TabsTrigger>
          <TabsTrigger value="options">Profesi / Spesialisasi / Layanan</TabsTrigger>
        </TabsList>

        <TabsContent value="score" className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Skor default per status indikator</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-3">
              <NumField label="Memenuhi (hijau)" value={s.scoreMet} disabled={!isAdmin} onChange={(v) => setS({ ...s, scoreMet: num(v) })} />
              <NumField label="Perlu perhatian (kuning)" value={s.scoreAttention} disabled={!isAdmin} onChange={(v) => setS({ ...s, scoreAttention: num(v) })} />
              <NumField label="Trigger (merah)" value={s.scoreTrigger} disabled={!isAdmin} onChange={(v) => setS({ ...s, scoreTrigger: num(v) })} />
              <p className="sm:col-span-3 text-xs text-muted-foreground">Skor per indikator dapat ditimpa di Master Indikator. Skor kategori = rata-rata (berbobot) skor indikator; skor akhir = Σ skor kategori × bobot kategori.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">Kategori hasil akhir</CardTitle>
              {isAdmin && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setS({ ...s, ...OPPE_EXCEL_PRESET })}><FileSpreadsheet className="size-3.5" />Preset Excel RSASM</Button>
                  <Button size="sm" variant="outline" onClick={() => setS({ ...s, scoreMet: OPPE_DEFAULT_SETTINGS.scoreMet, scoreAttention: OPPE_DEFAULT_SETTINGS.scoreAttention, scoreTrigger: OPPE_DEFAULT_SETTINGS.scoreTrigger, resultCategories: OPPE_DEFAULT_SETTINGS.resultCategories })}>Default</Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-2 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Label</TableHead><TableHead>Min (≥)</TableHead><TableHead>Maks (&lt;)</TableHead><TableHead>Warna</TableHead><TableHead>Rekomendasi</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {s.resultCategories.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell><Input className="h-8 w-28 text-xs" value={c.code} disabled={!isAdmin} onChange={(e) => setRc(i, { code: e.target.value.replace(/\s+/g, '_').toLowerCase() })} /></TableCell>
                      <TableCell><Input className="h-8 w-32 text-xs" value={c.label} disabled={!isAdmin} onChange={(e) => setRc(i, { label: e.target.value })} /></TableCell>
                      <TableCell><Input className="h-8 w-20 text-xs" inputMode="decimal" value={c.min} disabled={!isAdmin} onChange={(e) => setRc(i, { min: num(e.target.value) })} /></TableCell>
                      <TableCell><Input className="h-8 w-20 text-xs" inputMode="decimal" placeholder="∞" value={c.max ?? ''} disabled={!isAdmin} onChange={(e) => setRc(i, { max: e.target.value.trim() === '' ? null : num(e.target.value) })} /></TableCell>
                      <TableCell><Input type="color" className="h-8 w-14 p-1" value={c.color} disabled={!isAdmin} onChange={(e) => setRc(i, { color: e.target.value })} /></TableCell>
                      <TableCell><Textarea rows={2} className="text-xs min-w-[260px]" value={c.recommendation} disabled={!isAdmin} onChange={(e) => setRc(i, { recommendation: e.target.value })} /></TableCell>
                      <TableCell>{isAdmin && s.resultCategories.length > 1 && <Button size="icon" variant="ghost" className="size-7" onClick={() => setS({ ...s, resultCategories: s.resultCategories.filter((_, j) => j !== i) })}><Trash2 className="size-3.5" /></Button>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {isAdmin && <Button size="sm" variant="outline" className="gap-1" onClick={() => setS({ ...s, resultCategories: [...s.resultCategories, { code: `kategori_${s.resultCategories.length + 1}`, label: 'Kategori baru', min: 0, max: null, color: '#94a3b8', recommendation: '' }] })}><Plus className="size-3.5" />Tambah kategori</Button>}
              <p className={`text-xs flex items-center gap-1 ${catErr ? 'text-red-500' : 'text-green-600'}`}>{catErr ? <ShieldAlert className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}{catErr ?? 'Rentang kategori valid & bersambung (0 → tak terbatas).'}</p>
              <p className="text-[11px] text-muted-foreground">Preset Excel RSASM mengikuti lembar referensi: skor = (indikator terpenuhi / total) × 100; Baik ≥ 85, Cukup 75–&lt;85, Kurang &lt;75.</p>
            </CardContent>
          </Card>
          {isAdmin && <Button onClick={saveSettings} disabled={busy === 'settings' || !!catErr} className="gap-1.5">{busy === 'settings' ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Simpan pengaturan</Button>}
        </TabsContent>

        <TabsContent value="weights">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <Table>
                <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Kategori</TableHead><TableHead>Bobot (%)</TableHead><TableHead>Urutan</TableHead><TableHead>Aktif</TableHead><TableHead>Deskripsi</TableHead></TableRow></TableHeader>
                <TableBody>
                  {cats.map((c, i) => (
                    <TableRow key={c.id || i}>
                      <TableCell><Input className="h-8 w-16 text-xs" value={c.code} disabled={!isCommittee || !!c.id} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, code: e.target.value.toUpperCase() } : x)))} /></TableCell>
                      <TableCell><Input className="h-8 text-xs" value={c.name} disabled={!isCommittee} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></TableCell>
                      <TableCell><Input className="h-8 w-20 text-xs" inputMode="decimal" value={c.weight} disabled={!isCommittee} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, weight: num(e.target.value) } : x)))} /></TableCell>
                      <TableCell><Input className="h-8 w-16 text-xs" inputMode="numeric" value={c.sortOrder} disabled={!isCommittee} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, sortOrder: num(e.target.value) } : x)))} /></TableCell>
                      <TableCell><Switch checked={c.isActive} disabled={!isCommittee} onCheckedChange={(v) => setCats(cats.map((x, j) => (j === i ? { ...x, isActive: v } : x)))} /></TableCell>
                      <TableCell><Input className="h-8 text-xs min-w-[220px]" value={c.description ?? ''} disabled={!isCommittee} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={weights.ok ? 'secondary' : 'destructive'}>Total bobot aktif: {fmtNum(weights.total)}%</Badge>
                {!weights.ok && <span className="text-xs text-red-500">Total bobot harus tepat 100%.</span>}
                {isCommittee && <Button size="sm" variant="outline" className="gap-1" onClick={() => setCats([...cats, { id: '', code: String.fromCharCode(65 + cats.length), name: 'Kategori baru', weight: 0, description: null, sortOrder: cats.length + 1, isActive: true }])}><Plus className="size-3.5" />Kategori</Button>}
                {isCommittee && <Button size="sm" onClick={saveWeights} disabled={busy === 'weights' || !weights.ok} className="gap-1.5">{busy === 'weights' ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Simpan bobot</Button>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardContent className="pt-4 grid sm:grid-cols-2 gap-3">
              <NumField label="Penurunan skor signifikan (poin)" value={s.significantDrop} disabled={!isAdmin} onChange={(v) => setS({ ...s, significantDrop: num(v) })} />
              <NumField label="Rentang 'stabil' trend (± poin)" value={s.stableBand} disabled={!isAdmin} onChange={(v) => setS({ ...s, stableBand: num(v) })} />
              <NumField label="Jumlah trigger yang menyarankan FPPE (0 = nonaktif)" value={s.fppeTriggerCountThreshold} disabled={!isAdmin} onChange={(v) => setS({ ...s, fppeTriggerCountThreshold: num(v) })} />
              <NumField label="Pengingat jatuh tempo (hari)" value={s.dueReminderDays} disabled={!isAdmin} onChange={(v) => setS({ ...s, dueReminderDays: num(v) })} />
              <div className="space-y-1"><Label className="text-xs">Nama RS (kop lembar PDF)</Label><Input value={s.hospitalName} disabled={!isAdmin} onChange={(e) => setS({ ...s, hospitalName: e.target.value })} /></div>
              <div className="flex items-center gap-2 pt-5"><Switch checked={s.requireCompleteBeforeSubmit} disabled={!isAdmin} onCheckedChange={(v) => setS({ ...s, requireCompleteBeforeSubmit: v })} /><Label className="text-xs">Wajib semua indikator terisi sebelum diajukan</Label></div>
              <div className="sm:col-span-2 space-y-1"><Label className="text-xs">Rekomendasi bila indikator kritis terkena trigger</Label><Textarea rows={2} value={s.recommendationCriticalTrigger} disabled={!isAdmin} onChange={(e) => setS({ ...s, recommendationCriticalTrigger: e.target.value })} /></div>
              <div className="sm:col-span-2 space-y-1"><Label className="text-xs">Rekomendasi bila jumlah trigger ≥ ambang</Label><Textarea rows={2} value={s.recommendationMultipleTrigger} disabled={!isAdmin} onChange={(e) => setS({ ...s, recommendationMultipleTrigger: e.target.value })} /></div>
              <div className="sm:col-span-2 space-y-1"><Label className="text-xs">Rekomendasi bila skor turun signifikan</Label><Textarea rows={2} value={s.recommendationDecline} disabled={!isAdmin} onChange={(e) => setS({ ...s, recommendationDecline: e.target.value })} /></div>
            </CardContent>
          </Card>
          {isAdmin && <Button onClick={saveSettings} disabled={busy === 'settings' || !!catErr} className="gap-1.5">{busy === 'settings' ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Simpan pengaturan</Button>}
        </TabsContent>

        <TabsContent value="ksm"><KsmEditor ksm={masters.ksm} canEdit={isCommittee} actorId={actor.id} onChanged={onChanged} /></TabsContent>
        <TabsContent value="options"><OptionsEditor options={masters.options} canEdit={isCommittee} onChanged={onChanged} /></TabsContent>
      </Tabs>
    </div>
  );
}

function NumField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: string) => void; disabled?: boolean }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label><Input inputMode="decimal" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} /></div>;
}

function KsmEditor({ ksm, canEdit, actorId, onChanged }: { ksm: OppeKsm[]; canEdit: boolean; actorId: string; onChanged: () => void }) {
  const [rows, setRows] = useState<Partial<OppeKsm>[]>(ksm);
  const [busy, setBusy] = useState<number | null>(null);
  useEffect(() => setRows(ksm), [ksm]);
  async function save(i: number) {
    const r = rows[i];
    if (!r.code?.trim() || !r.name?.trim()) { toastError('Kode dan nama KSM wajib diisi.'); return; }
    setBusy(i);
    try { await saveOppeKsm({ ...r, code: r.code, name: r.name }, actorId); toastSuccess('KSM disimpan'); onChanged(); }
    catch (e) { toastError(friendlyOppeError(e, 'KSM gagal disimpan.')); }
    finally { setBusy(null); }
  }
  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <Table>
          <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Nama KSM</TableHead><TableHead>Keterangan</TableHead><TableHead>Aktif</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.id ?? `new-${i}`}>
                <TableCell><Input className="h-8 w-24 text-xs" value={r.code ?? ''} disabled={!canEdit} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))} /></TableCell>
                <TableCell><Input className="h-8 text-xs min-w-[220px]" value={r.name ?? ''} disabled={!canEdit} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></TableCell>
                <TableCell><Input className="h-8 text-xs min-w-[220px]" value={r.description ?? ''} disabled={!canEdit} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} /></TableCell>
                <TableCell><Switch checked={r.isActive ?? true} disabled={!canEdit} onCheckedChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, isActive: v } : x)))} /></TableCell>
                <TableCell>{canEdit && <Button size="sm" variant="outline" disabled={busy === i} onClick={() => save(i)}>{busy === i ? <Loader2 className="size-3.5 animate-spin" /> : 'Simpan'}</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {canEdit && <Button size="sm" variant="outline" className="gap-1" onClick={() => setRows([...rows, { code: '', name: '', isActive: true }])}><Plus className="size-3.5" />Tambah KSM</Button>}
      </CardContent>
    </Card>
  );
}

function OptionsEditor({ options, canEdit, onChanged }: { options: OppeMasterOption[]; canEdit: boolean; onChanged: () => void }) {
  const [draft, setDraft] = useState<Record<OppeMasterKind, string>>({ profession: '', specialty: '', service_type: '' });
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid md:grid-cols-3 gap-3">
      {(Object.keys(OPPE_MASTER_KIND_LABEL) as OppeMasterKind[]).map((kind) => (
        <Card key={kind}>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{OPPE_MASTER_KIND_LABEL[kind]}</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {options.filter((o) => o.kind === kind).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 text-sm">
                <span className={o.isActive ? '' : 'line-through text-muted-foreground'}>{o.name}</span>
                {canEdit && <Switch checked={o.isActive} onCheckedChange={async (v) => { try { await saveOppeMasterOption({ ...o, isActive: v }); onChanged(); } catch (e) { toastError(friendlyOppeError(e)); } }} />}
              </div>
            ))}
            {canEdit && (
              <div className="flex gap-1 pt-2">
                <Input className="h-8 text-xs" placeholder={`Tambah ${OPPE_MASTER_KIND_LABEL[kind].toLowerCase()}…`} value={draft[kind]} onChange={(e) => setDraft({ ...draft, [kind]: e.target.value })} />
                <Button size="sm" className="h-8" disabled={busy || !draft[kind].trim()} onClick={async () => {
                  setBusy(true);
                  try { await saveOppeMasterOption({ kind, name: draft[kind], sortOrder: 99 }); setDraft({ ...draft, [kind]: '' }); toastSuccess('Ditambahkan'); onChanged(); }
                  catch (e) { toastError(friendlyOppeError(e, 'Gagal menambah — mungkin nama sudah ada.')); } finally { setBusy(false); }
                }}><Plus className="size-3.5" /></Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
