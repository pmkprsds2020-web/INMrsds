'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users, Plus, Search, Pencil, Trash2, Loader2, ClipboardPlus, History } from 'lucide-react';
import type { OppeDoctor } from '@/types/oppe';
import { getOppeDoctors, saveOppeDoctor, deleteOppeDoctor, friendlyOppeError } from '@/lib/oppeData';
import { toastSuccess, toastError } from '@/lib/toast-helpers';
import { OppeLoading, OppeEmpty, OppeErrorState, OppePageHeader, OppePagination, useDebounced, ALL, fmtDate, type OppeMasters } from './OppeShared';

const PAGE_SIZE = 15;

const EMPTY: Partial<OppeDoctor> = { name: '', status: 'aktif' };

interface Props {
  masters: OppeMasters;
  canManage: boolean;
  actor: { id: string; name: string };
  onCreateEvaluation: (doctorId: string) => void;
  onShowHistory: (doctorId: string) => void;
}

export function OppeDoctorList({ masters, canManage, actor, onCreateEvaluation, onShowHistory }: Props) {
  const [rows, setRows] = useState<OppeDoctor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [ksmId, setKsmId] = useState(ALL);
  const [status, setStatus] = useState('aktif');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<OppeDoctor> | null>(null);
  const [deleting, setDeleting] = useState<OppeDoctor | null>(null);
  const q = useDebounced(search);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await getOppeDoctors({ search: q || undefined, ksmId: ksmId === ALL ? undefined : ksmId, status: status === ALL ? undefined : status, page, pageSize: PAGE_SIZE });
      setRows(r.rows);
      setTotal(r.total);
    } catch (e) {
      setError(friendlyOppeError(e, 'Data dokter gagal dimuat.'));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { setPage(0); }, [q, ksmId, status]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [q, ksmId, status, page]);

  const expired = (d: string | null) => d && d < new Date().toISOString().slice(0, 10);

  return (
    <div className="p-4 space-y-4">
      <OppePageHeader
        icon={Users}
        title="Data Dokter / Staf Medis"
        description="Master dokter yang dievaluasi OPPE beserta KSM, unit, STR/SIP, dan kredensial."
        actions={canManage && <Button size="sm" className="gap-1.5" onClick={() => setEditing({ ...EMPTY })}><Plus className="size-4" />Tambah Dokter</Button>}
      />
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / SIP / STR…" className="pl-8 h-9" />
            </div>
            <Select value={ksmId} onValueChange={setKsmId}>
              <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>Semua KSM</SelectItem>{masters.ksm.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>Semua status</SelectItem><SelectItem value="aktif">Aktif</SelectItem><SelectItem value="nonaktif">Nonaktif</SelectItem></SelectContent>
            </Select>
          </div>

          {loading ? <OppeLoading /> : error ? <OppeErrorState message={error} onRetry={load} /> : rows.length === 0 ? (
            <OppeEmpty title="Belum ada data dokter" description="Tambahkan dokter/staf medis yang akan dievaluasi OPPE." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Profesi / Spesialisasi</TableHead>
                    <TableHead>KSM</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>STR / SIP</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">
                        {d.name}{d.title ? <span className="text-muted-foreground font-normal">, {d.title}</span> : null}
                        {d.isDemo && <Badge variant="outline" className="ml-1.5 text-[9px]">DEMO</Badge>}
                        {d.userId && <Badge variant="secondary" className="ml-1.5 text-[9px]">akun terhubung</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{[d.profession, d.specialty].filter(Boolean).join(' · ') || '—'}</TableCell>
                      <TableCell className="text-xs">{d.ksmName ?? '—'}</TableCell>
                      <TableCell className="text-xs">{d.unitName ?? '—'}</TableCell>
                      <TableCell className="text-xs">
                        <div>STR: {d.strNumber ?? '—'} {expired(d.strExpiry) && <Badge variant="destructive" className="text-[9px] ml-1">kedaluwarsa</Badge>}</div>
                        <div>SIP: {d.sipNumber ?? '—'} {expired(d.sipExpiry) && <Badge variant="destructive" className="text-[9px] ml-1">kedaluwarsa</Badge>}</div>
                      </TableCell>
                      <TableCell><Badge variant={d.status === 'aktif' ? 'secondary' : 'outline'} className="text-[10px]">{d.status}</Badge></TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="icon" variant="ghost" className="size-8" title="Histori OPPE" onClick={() => onShowHistory(d.id)}><History className="size-4" /></Button>
                        <Button size="icon" variant="ghost" className="size-8" title="Buat evaluasi" onClick={() => onCreateEvaluation(d.id)}><ClipboardPlus className="size-4" /></Button>
                        {canManage && <Button size="icon" variant="ghost" className="size-8" title="Edit" onClick={() => setEditing(d)}><Pencil className="size-4" /></Button>}
                        {canManage && <Button size="icon" variant="ghost" className="size-8 text-red-500" title="Hapus" onClick={() => setDeleting(d)}><Trash2 className="size-4" /></Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <OppePagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </CardContent>
      </Card>

      {editing && <OppeDoctorForm masters={masters} initial={editing} actor={actor} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data dokter?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.name} akan dihapus permanen. Dokter yang sudah memiliki evaluasi OPPE tidak dapat dihapus — ubah statusnya menjadi nonaktif.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                if (!deleting) return;
                try {
                  await deleteOppeDoctor(deleting.id, actor);
                  toastSuccess('Data dokter dihapus');
                  load();
                } catch (e) {
                  toastError(friendlyOppeError(e, 'Data dokter gagal dihapus.'));
                } finally {
                  setDeleting(null);
                }
              }}
            >Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function OppeDoctorForm({ masters, initial, actor, onClose, onSaved }: { masters: OppeMasters; initial: Partial<OppeDoctor>; actor: { id: string; name: string }; onClose: () => void; onSaved: (d: OppeDoctor) => void }) {
  const [form, setForm] = useState<Partial<OppeDoctor>>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof OppeDoctor>(k: K, v: OppeDoctor[K] | null) => setForm((f) => ({ ...f, [k]: v }));
  const professions = masters.options.filter((o) => o.kind === 'profession' && o.isActive);
  const specialties = masters.options.filter((o) => o.kind === 'specialty' && o.isActive);

  async function submit() {
    setErr(null);
    if (!form.name?.trim()) { setErr('Nama dokter wajib diisi.'); return; }
    if (!form.ksmId) { setErr('KSM wajib dipilih.'); return; }
    if (!form.profession) { setErr('Profesi wajib dipilih.'); return; }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) { setErr('Format email tidak valid.'); return; }
    setSaving(true);
    try {
      const unit = masters.units.find((u) => u.id === form.unitId);
      const saved = await saveOppeDoctor({ ...form, name: form.name.trim(), unitName: unit?.name ?? form.unitName ?? null }, actor);
      toastSuccess('Data dokter disimpan');
      onSaved(saved);
    } catch (e) {
      setErr(friendlyOppeError(e, 'Data dokter gagal disimpan. Silakan coba kembali.'));
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, el: React.ReactNode, required = false) => (
    <div className="space-y-1"><Label className="text-xs">{label}{required && <span className="text-red-500"> *</span>}</Label>{el}</div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Edit Data Dokter' : 'Tambah Dokter / Staf Medis'}</DialogTitle>
          <DialogDescription>Data identitas, kredensial, dan penempatan KSM/unit.</DialogDescription>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          {field('Nama dokter', <Input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="dr. Nama Lengkap" />, true)}
          {field('Gelar', <Input value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="Sp.An / Sp.M / drg" />)}
          {field('Profesi', (
            <Select value={form.profession ?? ''} onValueChange={(v) => set('profession', v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Pilih profesi" /></SelectTrigger>
              <SelectContent>{professions.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          ), true)}
          {field('Spesialisasi', (
            <Select value={form.specialty ?? '__none'} onValueChange={(v) => set('specialty', v === '__none' ? null : v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Pilih spesialisasi" /></SelectTrigger>
              <SelectContent><SelectItem value="__none">— Tidak ada —</SelectItem>{specialties.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          ))}
          {field('KSM', (
            <Select value={form.ksmId ?? ''} onValueChange={(v) => set('ksmId', v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Pilih KSM" /></SelectTrigger>
              <SelectContent>{masters.ksm.filter((k) => k.isActive || k.id === form.ksmId).map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
            </Select>
          ), true)}
          {field('Unit kerja', masters.units.length > 0 ? (
            <Select value={form.unitId ?? '__none'} onValueChange={(v) => set('unitId', v === '__none' ? null : v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Pilih unit" /></SelectTrigger>
              <SelectContent><SelectItem value="__none">— Tidak ada —</SelectItem>{masters.units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
            </Select>
          ) : <Input value={form.unitName ?? ''} onChange={(e) => set('unitName', e.target.value)} placeholder="Nama unit" />)}
          {field('NIK / NIP', <Input value={form.nikNip ?? ''} onChange={(e) => set('nikNip', e.target.value)} />)}
          {field('Status', (
            <Select value={form.status ?? 'aktif'} onValueChange={(v) => set('status', v as 'aktif' | 'nonaktif')}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="aktif">Aktif</SelectItem><SelectItem value="nonaktif">Nonaktif</SelectItem></SelectContent>
            </Select>
          ))}
          {field('Nomor STR', <Input value={form.strNumber ?? ''} onChange={(e) => set('strNumber', e.target.value)} />)}
          {field('Masa berlaku STR', <Input type="date" value={form.strExpiry ?? ''} onChange={(e) => set('strExpiry', e.target.value)} />)}
          {field('Nomor SIP', <Input value={form.sipNumber ?? ''} onChange={(e) => set('sipNumber', e.target.value)} />)}
          {field('Masa berlaku SIP', <Input type="date" value={form.sipExpiry ?? ''} onChange={(e) => set('sipExpiry', e.target.value)} />)}
          {field('Tanggal mulai praktik', <Input type="date" value={form.practiceStartDate ?? ''} onChange={(e) => set('practiceStartDate', e.target.value)} />)}
          {field('Email', <Input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />)}
          {field('Nomor telepon', <Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />)}
          {field('ID akun login dokter (opsional)', <Input value={form.userId ?? ''} onChange={(e) => set('userId', e.target.value || null)} placeholder="UUID auth user — agar dokter bisa melihat OPPE-nya" />)}
          <div className="sm:col-span-2">{field('Kredensial / kewenangan klinis', <Textarea rows={2} value={form.credentials ?? ''} onChange={(e) => set('credentials', e.target.value)} placeholder="Rincian kewenangan klinis / sertifikasi" />)}</div>
          <div className="sm:col-span-2">{field('Catatan', <Textarea rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />)}</div>
        </div>
        {form.strExpiry && <p className="text-[11px] text-muted-foreground">STR berlaku s/d {fmtDate(form.strExpiry)}{form.sipExpiry ? ` · SIP s/d ${fmtDate(form.sipExpiry)}` : ''}</p>}
        {err && <p className="text-sm text-red-500">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={saving} className="gap-1.5">{saving && <Loader2 className="size-4 animate-spin" />}Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
