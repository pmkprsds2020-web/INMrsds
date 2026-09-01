'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Loader2, CheckCircle2, XCircle, RotateCcw, Pencil, Stamp, Power, PowerOff, Copy,
} from 'lucide-react';
import {
  type UimuProposal, type UimuRevision, type UimuApproval,
  UIMU_STATUS_LABEL, UIMU_STATUS_COLOR, UIMU_WORKFLOW_STEPS,
  INDICATOR_CATEGORY_OPTIONS, QUALITY_DIMENSION_OPTIONS, ASPECT_AREA_OPTIONS, REASON_CHECKLIST_OPTIONS,
  computeUimuPriority, PRIORITY_CATEGORY_LABEL, PRIORITY_CATEGORY_COLOR,
} from '@/types/uimu';
import {
  getUimuProposalById, getUimuRevisions, getUimuApprovals,
  reviewUimuProposalByUnit, telaahUimuProposalByCommittee, approveUimuProposalByManagement,
  establishUimuProposal, activateUimuIndicator, deactivateUimuIndicator, duplicateUimuProposalToNewYear,
} from '@/lib/uimuData';
import { toastSuccess, toastError } from '@/lib/toast-helpers';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';

interface UimuDetailProps {
  proposalId: string;
  userId: string;
  userName: string;
  isKepalaUnit: boolean;
  isKomiteMutu: boolean;
  isManajemen: boolean;
  isAdmin: boolean;
  onBack: () => void;
  onEdit: (id: string) => void;
}

function StatusBadge({ status }: { status: UimuProposal['status'] }) {
  return (
    <Badge variant="outline" style={{ borderColor: UIMU_STATUS_COLOR[status], color: UIMU_STATUS_COLOR[status] }}>
      {UIMU_STATUS_LABEL[status]}
    </Badge>
  );
}

function WorkflowStepper({ status }: { status: UimuProposal['status'] }) {
  const failed = ['dikembalikan', 'revisi', 'tidak_disetujui', 'tidak_aktif'].includes(status);
  const activeIdx = UIMU_WORKFLOW_STEPS.findIndex((s) => s.status === status);
  const effectiveIdx = activeIdx >= 0 ? activeIdx : status === 'dikembalikan' ? 1 : status === 'revisi' ? 2 : status === 'tidak_disetujui' ? 2 : 0;
  return (
    <div className="flex items-center overflow-x-auto py-1">
      {UIMU_WORKFLOW_STEPS.map((step, i) => (
        <div key={step.status} className="flex items-center shrink-0">
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            i < effectiveIdx || (i === effectiveIdx && !failed) ? 'bg-emerald-500/10 text-emerald-600' :
            i === effectiveIdx && failed ? 'bg-rose-500/10 text-rose-600' : 'bg-muted text-muted-foreground'
          }`}>
            <span className="flex size-4 items-center justify-center rounded-full border text-[10px]">{i + 1}</span>
            {step.label}
          </div>
          {i < UIMU_WORKFLOW_STEPS.length - 1 && <div className="w-6 h-px bg-border shrink-0" />}
        </div>
      ))}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm border-b last:border-0">
      <span className="text-muted-foreground col-span-1">{label}</span>
      <span className="col-span-2">{value}</span>
    </div>
  );
}

export function UimuDetail({ proposalId, userId, userName, isKepalaUnit, isKomiteMutu, isManajemen, isAdmin, onBack, onEdit }: UimuDetailProps) {
  const [proposal, setProposal] = useState<UimuProposal | null>(null);
  const [revisions, setRevisions] = useState<UimuRevision[]>([]);
  const [approvals, setApprovals] = useState<UimuApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');
  const [decreeNumber, setDecreeNumber] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [p, revs, apps] = await Promise.all([
        getUimuProposalById(proposalId),
        getUimuRevisions(proposalId),
        getUimuApprovals(proposalId),
      ]);
      setProposal(p);
      setRevisions(revs);
      setApprovals(apps);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [proposalId]);

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      await load();
      setComment('');
    } catch (err) {
      toastError('Gagal memproses aksi', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  if (!proposal) return <div className="p-4 text-sm text-muted-foreground">Usulan tidak ditemukan.</div>;

  const isOwner = proposal.createdBy === userId || proposal.proposerId === userId;
  const priorityCat = computeUimuPriority(proposal.totalScore);

  return (
    <div className="p-4 space-y-4 max-w-4xl">
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" className="size-8" onClick={onBack}><ArrowLeft className="size-4" /></Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold truncate">{proposal.indicatorName || '(Belum diberi nama)'}</h2>
            <StatusBadge status={proposal.status} />
            {proposal.totalScore ? (
              <Badge variant="outline" style={{ borderColor: PRIORITY_CATEGORY_COLOR[priorityCat], color: PRIORITY_CATEGORY_COLOR[priorityCat] }} className="text-[10px]">
                {PRIORITY_CATEGORY_LABEL[priorityCat]} · Skor {proposal.totalScore}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground font-mono">{proposal.proposalNumber} · v{proposal.version} · {proposal.unitNameSnapshot}</p>
        </div>
        {isOwner && ['draft', 'dikembalikan', 'revisi'].includes(proposal.status) && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onEdit(proposal.id)}>
            <Pencil className="size-3.5" /> Edit
          </Button>
        )}
      </div>

      <Card><CardContent className="pt-4"><WorkflowStepper status={proposal.status} /></CardContent></Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Ringkasan Usulan</CardTitle></CardHeader>
        <CardContent>
          <DetailRow label="Pengusul" value={`${proposal.proposerName ?? '—'}${proposal.proposerPosition ? ' · ' + proposal.proposerPosition : ''}`} />
          <DetailRow label="Jenis Indikator" value={INDICATOR_CATEGORY_OPTIONS.find((o) => o.value === proposal.indicatorCategory)?.label} />
          <DetailRow label="Dimensi Mutu" value={QUALITY_DIMENSION_OPTIONS.find((o) => o.value === proposal.qualityDimension)?.label} />
          <DetailRow label="Area/Aspek Mutu" value={ASPECT_AREA_OPTIONS.find((o) => o.value === proposal.aspectArea)?.label} />
          <DetailRow label="Alasan Pemilihan" value={proposal.reasonChecklist.map((c) => REASON_CHECKLIST_OPTIONS.find((o) => o.value === c)?.label ?? c).join(', ')} />
          <DetailRow label="Uraian Gap" value={proposal.gapDescription} />
          <DetailRow label="Rekomendasi Kelayakan" value={proposal.eligibilityRecommendation} />
        </CardContent>
      </Card>

      {(proposal.operationalDefinition || proposal.numerator || proposal.formula) && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Definisi Operasional</CardTitle></CardHeader>
          <CardContent>
            <DetailRow label="Definisi Operasional" value={proposal.operationalDefinition} />
            <DetailRow label="Tujuan" value={proposal.indicatorGoal} />
            <DetailRow label="Jenis" value={proposal.indicatorKind} />
            <DetailRow label="Numerator" value={proposal.numerator} />
            <DetailRow label="Denominator" value={proposal.denominator} />
            <DetailRow label="Formula" value={proposal.formula} />
            <DetailRow label="Sumber Data" value={proposal.dataSource} />
            <DetailRow label="Frekuensi Pengumpulan" value={proposal.collectionFrequency} />
            <DetailRow label="PIC" value={proposal.picName} />
            <DetailRow label="Target" value={proposal.targetValue ? `${proposal.targetValue} ${proposal.targetUnit ?? ''}` : null} />
          </CardContent>
        </Card>
      )}

      {/* ── Aksi sesuai tahap & peran ─────────────────────────── */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Aksi</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea placeholder="Catatan/komentar (opsional untuk persetujuan, wajib untuk pengembalian/penolakan)" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />

          {proposal.status === 'review_unit' && isKepalaUnit && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} className="gap-1.5" onClick={() => withBusy(async () => {
                await reviewUimuProposalByUnit({ id: proposal.id, decision: 'setuju', reviewerId: userId, reviewerName: userName, reviewerRole: 'kepala_unit', comment });
                toastSuccess('Usulan diteruskan ke Telaah Komite Mutu');
              })}><CheckCircle2 className="size-4" /> Setujui & Teruskan</Button>
              <Button size="sm" variant="destructive" disabled={busy || !comment.trim()} className="gap-1.5" onClick={() => withBusy(async () => {
                await reviewUimuProposalByUnit({ id: proposal.id, decision: 'kembalikan', reviewerId: userId, reviewerName: userName, reviewerRole: 'kepala_unit', comment });
                toastSuccess('Usulan dikembalikan ke pengusul');
              })}><RotateCcw className="size-4" /> Kembalikan</Button>
            </div>
          )}

          {proposal.status === 'telaah_mutu' && isKomiteMutu && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} className="gap-1.5" onClick={() => withBusy(async () => {
                await telaahUimuProposalByCommittee({ id: proposal.id, decision: 'setuju', reviewerId: userId, reviewerName: userName, reviewerRole: 'komite_mutu', comment });
                toastSuccess('Usulan disetujui Komite Mutu');
              })}><CheckCircle2 className="size-4" /> Setujui</Button>
              <Button size="sm" variant="outline" disabled={busy || !comment.trim()} className="gap-1.5" onClick={() => withBusy(async () => {
                await telaahUimuProposalByCommittee({ id: proposal.id, decision: 'revisi', reviewerId: userId, reviewerName: userName, reviewerRole: 'komite_mutu', comment });
                toastSuccess('Usulan dikembalikan untuk revisi');
              })}><RotateCcw className="size-4" /> Minta Revisi</Button>
              <Button size="sm" variant="destructive" disabled={busy || !comment.trim()} className="gap-1.5" onClick={() => withBusy(async () => {
                await telaahUimuProposalByCommittee({ id: proposal.id, decision: 'tolak', reviewerId: userId, reviewerName: userName, reviewerRole: 'komite_mutu', comment, rejectionReason: comment });
                toastSuccess('Usulan ditolak');
              })}><XCircle className="size-4" /> Tolak</Button>
            </div>
          )}

          {proposal.status === 'disetujui' && (isManajemen || isKomiteMutu) && (
            <div className="space-y-2">
              {isManajemen && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={busy} className="gap-1.5" onClick={() => withBusy(async () => {
                    await approveUimuProposalByManagement({ id: proposal.id, decision: 'setuju', approverId: userId, approverName: userName, notes: comment });
                    toastSuccess('Persetujuan manajemen dicatat');
                  })}><CheckCircle2 className="size-4" /> Setujui (Manajemen)</Button>
                  <Button size="sm" variant="destructive" disabled={busy || !comment.trim()} className="gap-1.5" onClick={() => withBusy(async () => {
                    await approveUimuProposalByManagement({ id: proposal.id, decision: 'tolak', approverId: userId, approverName: userName, notes: comment });
                    toastSuccess('Usulan ditolak manajemen');
                  })}><XCircle className="size-4" /> Tolak (Manajemen)</Button>
                </div>
              )}
              {isKomiteMutu && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Input placeholder="Nomor penetapan / berita acara" value={decreeNumber} onChange={(e) => setDecreeNumber(e.target.value)} className="max-w-xs h-9" />
                  <Button size="sm" disabled={busy || !decreeNumber.trim()} className="gap-1.5" onClick={() => withBusy(async () => {
                    await establishUimuProposal({ id: proposal.id, decreeNumber, establishedBy: userId, establishedByName: userName });
                    toastSuccess('Indikator resmi ditetapkan');
                  })}><Stamp className="size-4" /> Tetapkan Indikator</Button>
                </div>
              )}
            </div>
          )}

          {proposal.status === 'ditetapkan' && isKomiteMutu && (
            <Button size="sm" disabled={busy} className="gap-1.5" onClick={() => withBusy(async () => {
              await activateUimuIndicator(proposal.id, userId);
              toastSuccess('Indikator diaktifkan — siap dipakai modul pengukuran');
            })}><Power className="size-4" /> Aktifkan Indikator</Button>
          )}

          {proposal.status === 'aktif' && isKomiteMutu && (
            <Button size="sm" variant="outline" disabled={busy} className="gap-1.5" onClick={() => withBusy(async () => {
              await deactivateUimuIndicator(proposal.id, userId);
              toastSuccess('Indikator dinonaktifkan');
            })}><PowerOff className="size-4" /> Nonaktifkan Indikator</Button>
          )}

          {['ditetapkan', 'aktif', 'tidak_aktif'].includes(proposal.status) && (
            <Button size="sm" variant="ghost" disabled={busy} className="gap-1.5" onClick={() => withBusy(async () => {
              const nextYear = proposal.periodYear + 1;
              await duplicateUimuProposalToNewYear({ sourceId: proposal.id, newYear: nextYear, actorId: userId });
              toastSuccess(`Disalin sebagai draft usulan tahun ${nextYear}`);
            })}><Copy className="size-4" /> Salin ke Tahun {proposal.periodYear + 1}</Button>
          )}

          {proposal.status === 'tidak_disetujui' && proposal.rejectionReason && (
            <p className="text-sm text-rose-600">Alasan penolakan: {proposal.rejectionReason}</p>
          )}

          {!isKepalaUnit && !isKomiteMutu && !isManajemen && !isOwner && (
            <p className="text-xs text-muted-foreground">Tidak ada aksi tersedia untuk peran Anda pada tahap ini.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Riwayat revisi & approval ────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Riwayat Revisi & Approval</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[...approvals.map((a) => ({ kind: 'approval' as const, at: a.decidedAt, data: a })), ...revisions.map((r) => ({ kind: 'revision' as const, at: r.createdAt, data: r }))]
            .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
            .map((item, i) => (
              <div key={i} className="flex gap-3 text-sm border-b last:border-0 pb-2">
                <span className="text-xs text-muted-foreground w-32 shrink-0">{format(new Date(item.at), 'd MMM yyyy HH:mm', { locale: idLocale })}</span>
                {item.kind === 'approval' ? (
                  <p><span className="font-medium">{item.data.approverName ?? 'Sistem'}</span> ({item.data.stage}) — {item.data.decision}{item.data.notes ? `: ${item.data.notes}` : ''}</p>
                ) : (
                  <p><span className="font-medium">{item.data.reviewerName ?? 'Sistem'}</span> ({item.data.stage}, v{item.data.version}) — {item.data.decision}{item.data.comment ? `: ${item.data.comment}` : ''}</p>
                )}
              </div>
            ))}
          {approvals.length === 0 && revisions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Belum ada riwayat.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
