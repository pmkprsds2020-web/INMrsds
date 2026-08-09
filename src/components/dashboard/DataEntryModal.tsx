'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hand,
  Stethoscope,
  ScanLine,
  Shield,
  TriangleAlert,
  Clock,
  Monitor,
  FlaskConical,
  Pill,
  FileText,
  Scissors,
  Loader2,
  type LucideIcon,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  type IndicatorType,
  type IndicatorEntry,
  type TanganEntry,
  type VisiteEntry,
  type IdentitasEntry,
  type ApdEntry,
  type JatuhEntry,
  type ScEntry,
  type WtrjEntry,
  type OpEntry,
  type LabEntry,
  type FornasEntry,
  type CpEntry,
  INDICATORS,
  IDENTITAS_SERVICE_OPTIONS,
  UNIT_MAP,
} from '@/types';
import { todayStr, isVisitePatuh, timeDiffMinutes } from '@/lib/calculations';

/* ── Props ────────────────────────────────────────────────────── */
export interface DataEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: IndicatorType;
  activeUnit: string;
  userId: string;
  onSubmit: (entry: Omit<IndicatorEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  isLoading?: boolean;
}

/* ── Icon map ─────────────────────────────────────────────────── */
const ICON_MAP: Record<string, LucideIcon> = {
  hand: Hand,
  stethoscope: Stethoscope,
  'scan-line': ScanLine,
  shield: Shield,
  'triangle-alert': TriangleAlert,
  clock: Clock,
  monitor: Monitor,
  'flask-conical': FlaskConical,
  pill: Pill,
  'file-text': FileText,
  scissors: Scissors,
};

/* ── Form field component ─────────────────────────────────────── */
function FormField({
  label,
  children,
  error,
  required,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs font-medium text-foreground/80">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      {children}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[10px] text-red-400"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}

/* ── Auto-computed badge ──────────────────────────────────────── */
function ComputedBadge({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <Badge
        className={`text-[10px] font-medium border-0 ${
          positive === true
            ? 'bg-emerald-500/20 text-emerald-400'
            : positive === false
              ? 'bg-red-500/20 text-red-400'
              : 'bg-muted text-muted-foreground'
        }`}
      >
        {value}
      </Badge>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */
export function DataEntryModal({
  open,
  onOpenChange,
  type,
  activeUnit,
  userId,
  onSubmit,
  isLoading = false,
}: DataEntryModalProps) {
  const meta = useMemo(() => INDICATORS.find((i) => i.id === type)!, [type]);
  const Icon = ICON_MAP[meta.icon] ?? FileText;

  // Common date field
  const [date, setDate] = useState(todayStr());

  // ── Tangan state ──
  const [tanganStaff, setTanganStaff] = useState('');
  const [tanganObserver, setTanganObserver] = useState('');
  const [tanganRoom, setTanganRoom] = useState('');
  const [tanganM1, setTanganM1] = useState(false);
  const [tanganM2, setTanganM2] = useState(false);
  const [tanganM3, setTanganM3] = useState(false);
  const [tanganM4, setTanganM4] = useState(false);
  const [tanganM5, setTanganM5] = useState(false);
  const [tanganMethod, setTanganMethod] = useState('5 Momen');
  const [tanganPatuhOverride, setTanganPatuhOverride] = useState<boolean | null>(null);

  // ── Visite state ──
  const [visiteRm, setVisiteRm] = useState('');
  const [visiteDoctor, setVisiteDoctor] = useState('');
  const [visiteTime, setVisiteTime] = useState('09:00');

  // ── Identitas state ──
  const [identitasStaff, setIdentitasStaff] = useState('');
  const [identitasObserver, setIdentitasObserver] = useState('');
  const [identitasRoom, setIdentitasRoom] = useState('');
  const [identitasName, setIdentitasName] = useState('');
  const [identitasRm, setIdentitasRm] = useState('');
  const [identitasService, setIdentitasService] = useState('');
  const [identitasNama, setIdentitasNama] = useState(false);
  const [identitasTgl, setIdentitasTgl] = useState(false);

  // ── APD state ──
  const [apdRoom, setApdRoom] = useState('');
  const [apdStaff, setApdStaff] = useState('');
  const [apdComp, setApdComp] = useState('Patuh');

  // ── Jatuh state ──
  const [jatuhRm, setJatuhRm] = useState('');
  const [jatuhAwal, setJatuhAwal] = useState(false);
  const [jatuhRe, setJatuhRe] = useState(false);
  const [jatuhInv, setJatuhInv] = useState(false);
  const [jatuhCedera, setJatuhCedera] = useState(false);

  // ── SC state ──
  const [scRm, setScRm] = useState('');
  const [scDiag, setScDiag] = useState('');
  const [scOk, setScOk] = useState(false);

  // ── WTRJ state ──
  const [wtrjRm, setWtrjRm] = useState('');
  const [wtrjDoc, setWtrjDoc] = useState('');
  const [wtrjT1, setWtrjT1] = useState('08:00');
  const [wtrjT2, setWtrjT2] = useState('09:00');

  // ── OP state ──
  const [opRm, setOpRm] = useState('');
  const [opT1, setOpT1] = useState('');
  const [opT2, setOpT2] = useState('');
  const [opTertunda, setOpTertunda] = useState(false);
  const [opR, setOpR] = useState('');

  // ── Lab state ──
  const [labRm, setLabRm] = useState('');
  const [labExam, setLabExam] = useState('');
  const [labT1, setLabT1] = useState('10:00');
  const [labT2, setLabT2] = useState('10:20');

  // ── Fornas state ──
  const [fornasNum, setFornasNum] = useState(0);
  const [fornasNon, setFornasNon] = useState(0);
  const [fornasNote, setFornasNote] = useState('');

  // ── CP state ──
  const [cpName, setCpName] = useState('');
  const [cpRm, setCpRm] = useState('');
  const [cpDiag, setCpDiag] = useState('');
  const [cpVTerapi, setCpVTerapi] = useState(0);
  const [cpVLab, setCpVLab] = useState(0);
  const [cpVRad, setCpVRad] = useState(0);
  const [cpVLain, setCpVLain] = useState(0);
  const [cpVLainKet, setCpVLainKet] = useState('');
  const [cpPerawat, setCpPerawat] = useState('Ya');
  const [cpFarmasi, setCpFarmasi] = useState('Ya');
  const [cpGizi, setCpGizi] = useState('Ya');
  const [cpLos, setCpLos] = useState(0);
  const [cpKet, setCpKet] = useState('');

  // ── Validation errors ──
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Auto-computed values ──
  const tanganPatuh = useMemo(() => {
    if (tanganPatuhOverride !== null) return tanganPatuhOverride;
    return tanganM1 && tanganM2 && tanganM3 && tanganM4 && tanganM5;
  }, [tanganM1, tanganM2, tanganM3, tanganM4, tanganM5, tanganPatuhOverride]);

  const visitePatuh = useMemo(() => isVisitePatuh(visiteTime), [visiteTime]);

  const wtrjStChecked = useMemo(() => timeDiffMinutes(wtrjT1, wtrjT2) > 60, [wtrjT1, wtrjT2]);

  const labNum = useMemo(() => {
    const diff = timeDiffMinutes(labT1, labT2);
    return diff <= 30;
  }, [labT1, labT2]);

  // ── Reset form when type changes ──
  const resetForm = useCallback(() => {
    const unitLabel = UNIT_MAP[activeUnit]?.label || '';

    setDate(todayStr());
    setTanganStaff(''); setTanganObserver(''); setTanganRoom(unitLabel);
    setTanganM1(false); setTanganM2(false); setTanganM3(false); setTanganM4(false); setTanganM5(false);
    setTanganMethod('5 Momen'); setTanganPatuhOverride(null);
    setVisiteRm(''); setVisiteDoctor(''); setVisiteTime('09:00');
    setIdentitasStaff(''); setIdentitasObserver(''); setIdentitasRoom(unitLabel);
    setIdentitasName(''); setIdentitasRm(''); setIdentitasService('');
    setIdentitasNama(false); setIdentitasTgl(false);
    setApdRoom(unitLabel); setApdStaff(''); setApdComp('Patuh');
    setJatuhRm(''); setJatuhAwal(false); setJatuhRe(false); setJatuhInv(false); setJatuhCedera(false);
    setScRm(''); setScDiag(''); setScOk(false);
    setWtrjRm(''); setWtrjDoc(''); setWtrjT1('08:00'); setWtrjT2('09:00');
    setOpRm(''); setOpT1(''); setOpT2(''); setOpTertunda(false); setOpR('');
    setLabRm(''); setLabExam(''); setLabT1('10:00'); setLabT2('10:20');
    setFornasNum(0); setFornasNon(0); setFornasNote('');
    setCpName(''); setCpRm(''); setCpDiag('');
    setCpVTerapi(0); setCpVLab(0); setCpVRad(0); setCpVLain(0); setCpVLainKet('');
    setCpPerawat('Ya'); setCpFarmasi('Ya'); setCpGizi('Ya');
    setCpLos(0); setCpKet('');
    setErrors({});
  }, [activeUnit]);

  // ── Validate form ──
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!date) newErrors.date = 'Tanggal wajib diisi';

    switch (type) {
      case 'tangan':
        if (!tanganStaff.trim()) newErrors.tanganStaff = 'Nama petugas wajib diisi';
        if (!tanganObserver.trim()) newErrors.tanganObserver = 'Nama observer wajib diisi';
        if (!tanganRoom.trim()) newErrors.tanganRoom = 'Ruangan wajib diisi';
        break;
      case 'visite':
        if (!visiteRm.trim()) newErrors.visiteRm = 'No. RM wajib diisi';
        if (!visiteDoctor.trim()) newErrors.visiteDoctor = 'Nama dokter wajib diisi';
        if (!visiteTime) newErrors.visiteTime = 'Waktu visite wajib diisi';
        break;
      case 'identitas':
        if (!identitasStaff.trim()) newErrors.identitasStaff = 'Nama petugas wajib diisi';
        if (!identitasRoom.trim()) newErrors.identitasRoom = 'Ruangan wajib diisi';
        if (!identitasName.trim()) newErrors.identitasName = 'Nama pasien wajib diisi';
        if (!identitasRm.trim()) newErrors.identitasRm = 'No. RM wajib diisi';
        if (!identitasService) newErrors.identitasService = 'Silakan pilih jenis pelayanan';
        break;
      case 'apd':
        if (!apdRoom.trim()) newErrors.apdRoom = 'Ruangan wajib diisi';
        if (!apdStaff.trim()) newErrors.apdStaff = 'Nama petugas wajib diisi';
        break;
      case 'jatuh':
        if (!jatuhRm.trim()) newErrors.jatuhRm = 'No. RM wajib diisi';
        break;
      case 'sc':
        if (!scRm.trim()) newErrors.scRm = 'No. RM wajib diisi';
        if (!scDiag.trim()) newErrors.scDiag = 'Diagnosis wajib diisi';
        break;
      case 'wtrj':
        if (!wtrjRm.trim()) newErrors.wtrjRm = 'No. RM wajib diisi';
        if (!wtrjDoc.trim()) newErrors.wtrjDoc = 'Dokter/Poli wajib diisi';
        if (!wtrjT1) newErrors.wtrjT1 = 'Waktu pendaftaran wajib diisi';
        if (!wtrjT2) newErrors.wtrjT2 = 'Waktu dilayani wajib diisi';
        break;
      case 'op':
        if (!opRm.trim()) newErrors.opRm = 'No. RM wajib diisi';
        if (!opT1) newErrors.opT1 = 'Jadwal operasi wajib diisi';
        if (!opT2) newErrors.opT2 = 'Waktu aktual wajib diisi';
        if (opTertunda && !opR.trim()) newErrors.opR = 'Alasan penundaan wajib diisi';
        break;
      case 'lab':
        if (!labRm.trim()) newErrors.labRm = 'No. RM wajib diisi';
        if (!labExam.trim()) newErrors.labExam = 'Jenis pemeriksaan wajib diisi';
        if (!labT1) newErrors.labT1 = 'Waktu keluar hasil wajib diisi';
        if (!labT2) newErrors.labT2 = 'Waktu diterima wajib diisi';
        break;
      case 'fornas':
        if (fornasNum === 0 && fornasNon === 0) newErrors.fornasNum = 'Minimal satu resep harus diisi';
        break;
      case 'cp':
        if (!cpName.trim()) newErrors.cpName = 'Nama pasien wajib diisi';
        if (!cpRm.trim()) newErrors.cpRm = 'No. RM wajib diisi';
        if (!cpDiag.trim()) newErrors.cpDiag = 'Diagnosis wajib diisi';
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [type, date, tanganStaff, tanganObserver, tanganRoom, visiteRm, visiteDoctor, visiteTime,
    identitasStaff, identitasRoom, identitasName, identitasRm, identitasService, apdRoom, apdStaff,
    jatuhRm, scRm, scDiag, wtrjRm, wtrjDoc, wtrjT1, wtrjT2, opRm, opT1, opT2, opTertunda, opR,
    labRm, labExam, labT1, labT2, fornasNum, fornasNon, cpName, cpRm, cpDiag]);

  // ── Build entry from form state ──
  const buildEntry = useCallback((): Omit<IndicatorEntry, 'id' | 'createdAt' | 'updatedAt'> => {
    const base = {
      indicatorType: type,
      unitId: activeUnit,
      date,
      createdBy: userId || '',
    };

    switch (type) {
      case 'tangan':
        return { ...base, staff: tanganStaff, observer: tanganObserver, room: tanganRoom, m1: tanganM1, m2: tanganM2, m3: tanganM3, m4: tanganM4, m5: tanganM5, method: tanganMethod, patuh: tanganPatuh } as TanganEntry;
      case 'visite':
        return { ...base, rm: visiteRm, doctor: visiteDoctor, time: visiteTime } as VisiteEntry;
      case 'identitas':
        return { ...base, staff: identitasStaff, observer: identitasObserver, room: identitasRoom, name: identitasName, rm: identitasRm, service: identitasService, nama: identitasNama, tgl: identitasTgl } as IdentitasEntry;
      case 'apd':
        return { ...base, room: apdRoom, staff: apdStaff, comp: apdComp === 'Patuh' ? 'ya' : 'tidak' } as ApdEntry;
      case 'jatuh':
        return { ...base, rm: jatuhRm, awal: jatuhAwal, re: jatuhRe, inv: jatuhInv, cedera: jatuhCedera } as JatuhEntry;
      case 'sc':
        return { ...base, rm: scRm, diag: scDiag, ok: scOk } as ScEntry;
      case 'wtrj':
        return { ...base, rm: wtrjRm, doc: wtrjDoc, t1: wtrjT1, t2: wtrjT2, st_checked: wtrjStChecked } as WtrjEntry;
      case 'op':
        return { ...base, rm: opRm, t1: opT1, t2: opT2, tertunda: opTertunda, r: opR } as OpEntry;
      case 'lab':
        return { ...base, rm: labRm, exam: labExam, t1: labT1, t2: labT2, num: labNum } as LabEntry;
      case 'fornas':
        return { ...base, num: fornasNum, non: fornasNon, note: fornasNote } as FornasEntry;
      case 'cp':
        return { ...base, name: cpName, rm: cpRm, diag: cpDiag, vTerapi: cpVTerapi, vLab: cpVLab, vRad: cpVRad, vLain: cpVLain, vLainKet: cpVLainKet, perawat: cpPerawat, farmasi: cpFarmasi, gizi: cpGizi, los: cpLos, ket: cpKet } as CpEntry;
      default:
        return { ...base } as IndicatorEntry;
    }
  }, [type, activeUnit, userId, date, tanganStaff, tanganObserver, tanganRoom, tanganM1, tanganM2, tanganM3, tanganM4, tanganM5, tanganMethod, tanganPatuh, visiteRm, visiteDoctor, visiteTime, identitasStaff, identitasObserver, identitasRoom, identitasName, identitasRm, identitasService, identitasNama, identitasTgl, apdRoom, apdStaff, apdComp, jatuhRm, jatuhAwal, jatuhRe, jatuhInv, jatuhCedera, scRm, scDiag, scOk, wtrjRm, wtrjDoc, wtrjT1, wtrjT2, wtrjStChecked, opRm, opT1, opT2, opTertunda, opR, labRm, labExam, labT1, labT2, labNum, fornasNum, fornasNon, fornasNote, cpName, cpRm, cpDiag, cpVTerapi, cpVLab, cpVRad, cpVLain, cpVLainKet, cpPerawat, cpFarmasi, cpGizi, cpLos, cpKet]);

  // ── Handle submit ──
  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    try {
      await onSubmit(buildEntry());
      resetForm();
      onOpenChange(false);
    } catch {
      // Error handled by parent
    }
  }, [validate, buildEntry, onSubmit, resetForm, onOpenChange]);

  // ── Auto-fill room from current unit when modal opens ──
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, resetForm]);

  // ── Handle open change ──
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) resetForm(); // Clear form when closing
    onOpenChange(newOpen);
  }, [onOpenChange, resetForm]);

  // ── Render form fields by indicator type ──
  const renderForm = () => {
    switch (type) {
      case 'tangan':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Nama Petugas" required error={errors.tanganStaff}>
                <Input value={tanganStaff} onChange={(e) => setTanganStaff(e.target.value)} placeholder="Nama petugas" className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
              <FormField label="Observer" required error={errors.tanganObserver}>
                <Input value={tanganObserver} onChange={(e) => setTanganObserver(e.target.value)} placeholder="Nama observer" className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
            </div>
            <FormField label="Ruangan (otomatis dari unit login)" required error={errors.tanganRoom}>
              <Input value={tanganRoom} readOnly className="h-9 bg-muted/30 border-border text-sm text-foreground/70 cursor-not-allowed" />
            </FormField>
            <FormField label="Momen Kebersihan Tangan">
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: 'M1', sublabel: 'Sebelum kontak', checked: tanganM1, onChange: setTanganM1 },
                  { label: 'M2', sublabel: 'Sebelum aseptik', checked: tanganM2, onChange: setTanganM2 },
                  { label: 'M3', sublabel: 'Setelah cairan', checked: tanganM3, onChange: setTanganM3 },
                  { label: 'M4', sublabel: 'Setelah kontak', checked: tanganM4, onChange: setTanganM4 },
                  { label: 'M5', sublabel: 'Setelah lingkungan', checked: tanganM5, onChange: setTanganM5 },
                ].map((m) => (
                  <label
                    key={m.label}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                      m.checked
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-border bg-muted/30 hover:bg-muted/50'
                    }`}
                  >
                    <Checkbox
                      checked={m.checked}
                      onCheckedChange={(v) => m.onChange(!!v)}
                      className="size-4"
                    />
                    <span className="text-xs font-semibold text-foreground/80">{m.label}</span>
                    <span className="text-[9px] text-muted-foreground text-center leading-tight">{m.sublabel}</span>
                  </label>
                ))}
              </div>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Metode Observasi">
                <Select value={tanganMethod} onValueChange={setTanganMethod}>
                  <SelectTrigger className="h-9 bg-muted/50 border-border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="5 Momen" className="text-sm">5 Momen</SelectItem>
                    <SelectItem value="Contact" className="text-sm">Contact</SelectItem>
                    <SelectItem value="Lainnya" className="text-sm">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Override Kepatuhan">
                <Select
                  value={tanganPatuhOverride === true ? 'Patuh' : tanganPatuhOverride === false ? 'Tidak Patuh' : 'Otomatis'}
                  onValueChange={(v) => setTanganPatuhOverride(v === 'Patuh' ? true : v === 'Tidak Patuh' ? false : null)}
                >
                  <SelectTrigger className="h-9 bg-muted/50 border-border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="Otomatis" className="text-sm">Otomatis</SelectItem>
                    <SelectItem value="Patuh" className="text-sm">Patuh</SelectItem>
                    <SelectItem value="Tidak Patuh" className="text-sm">Tidak Patuh</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <ComputedBadge label="Kepatuhan" value={tanganPatuh ? 'Patuh' : 'Tidak Patuh'} positive={tanganPatuh} />
          </div>
        );

      case 'visite':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="No. Rekam Medis" required error={errors.visiteRm}>
                <Input value={visiteRm} onChange={(e) => setVisiteRm(e.target.value)} placeholder="No. RM" className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
              <FormField label="Nama Dokter" required error={errors.visiteDoctor}>
                <Input value={visiteDoctor} onChange={(e) => setVisiteDoctor(e.target.value)} placeholder="Nama dokter" className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
            </div>
            <FormField label="Waktu Visite" required error={errors.visiteTime}>
              <Input type="time" value={visiteTime} onChange={(e) => setVisiteTime(e.target.value)} className="h-9 bg-muted/50 border-border text-sm" />
            </FormField>
            <ComputedBadge label="Kepatuhan (≤14:00)" value={visitePatuh ? 'Patuh' : 'Tidak Patuh'} positive={visitePatuh} />
          </div>
        );

      case 'identitas':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Nama Petugas" required error={errors.identitasStaff}>
                <Input value={identitasStaff} onChange={(e) => setIdentitasStaff(e.target.value)} placeholder="Nama petugas" className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
              <FormField label="Observer">
                <Input value={identitasObserver} onChange={(e) => setIdentitasObserver(e.target.value)} placeholder="Nama observer" className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
            </div>
            <FormField label="Ruangan (otomatis dari unit login)" required error={errors.identitasRoom}>
              <Input value={identitasRoom} readOnly className="h-9 bg-muted/30 border-border text-sm text-foreground/70 cursor-not-allowed" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Nama Pasien" required error={errors.identitasName}>
                <Input value={identitasName} onChange={(e) => setIdentitasName(e.target.value)} placeholder="Nama pasien" className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
              <FormField label="No. Rekam Medis" required error={errors.identitasRm}>
                <Input value={identitasRm} onChange={(e) => setIdentitasRm(e.target.value)} placeholder="No. RM" className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
            </div>
            <FormField label="Pelayanan" required error={errors.identitasService}>
              <Select value={identitasService} onValueChange={setIdentitasService}>
                <SelectTrigger className="h-9 bg-muted/50 border-border text-sm">
                  <SelectValue placeholder="Pilih jenis pelayanan" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {IDENTITAS_SERVICE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt} className="text-sm">{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={identitasNama} onCheckedChange={(v) => setIdentitasNama(!!v)} className="size-4" />
                <span className="text-sm text-foreground/80">Cek Nama Pasien</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={identitasTgl} onCheckedChange={(v) => setIdentitasTgl(!!v)} className="size-4" />
                <span className="text-sm text-foreground/80">Cek Tanggal Lahir</span>
              </label>
            </div>
            <ComputedBadge label="Kepatuhan" value={identitasNama && identitasTgl ? 'Patuh' : 'Tidak Patuh'} positive={identitasNama && identitasTgl} />
          </div>
        );

      case 'apd':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Ruangan (otomatis dari unit login)" required error={errors.apdRoom}>
                <Input value={apdRoom} readOnly className="h-9 bg-muted/30 border-border text-sm text-foreground/70 cursor-not-allowed" />
              </FormField>
              <FormField label="Nama Petugas" required error={errors.apdStaff}>
                <Input value={apdStaff} onChange={(e) => setApdStaff(e.target.value)} placeholder="Nama petugas" className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
            </div>
            <FormField label="Kepatuhan APD" required>
              <Select value={apdComp} onValueChange={setApdComp}>
                <SelectTrigger className="h-9 bg-muted/50 border-border text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="Patuh" className="text-sm">Patuh</SelectItem>
                  <SelectItem value="Tidak Patuh" className="text-sm">Tidak Patuh</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <ComputedBadge label="Status" value={apdComp} positive={apdComp === 'Patuh'} />
          </div>
        );

      case 'jatuh':
        return (
          <div className="space-y-4">
            <FormField label="No. Rekam Medis" required error={errors.jatuhRm}>
              <Input value={jatuhRm} onChange={(e) => setJatuhRm(e.target.value)} placeholder="No. RM" className="h-9 bg-muted/50 border-border text-sm" />
            </FormField>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-foreground/80">Penilaian Risiko Jatuh</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Penilaian Awal', checked: jatuhAwal, onChange: setJatuhAwal },
                  { label: 'Reassessment', checked: jatuhRe, onChange: setJatuhRe },
                  { label: 'Intervensi', checked: jatuhInv, onChange: setJatuhInv },
                  { label: 'Cedera Tidak Terjadi', checked: jatuhCedera, onChange: setJatuhCedera },
                ].map((item) => (
                  <label
                    key={item.label}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      item.checked
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-border bg-muted/30 hover:bg-muted/50'
                    }`}
                  >
                    <Checkbox
                      checked={item.checked}
                      onCheckedChange={(v) => item.onChange(!!v)}
                      className="size-4"
                    />
                    <span className="text-xs text-foreground/80">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <ComputedBadge
              label="Kepatuhan"
              value={jatuhAwal && jatuhRe && jatuhInv && jatuhCedera ? 'Patuh' : 'Tidak Patuh'}
              positive={jatuhAwal && jatuhRe && jatuhInv && jatuhCedera}
            />
          </div>
        );

      case 'sc':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="No. Rekam Medis" required error={errors.scRm}>
                <Input value={scRm} onChange={(e) => setScRm(e.target.value)} placeholder="No. RM" className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
              <FormField label="Diagnosis" required error={errors.scDiag}>
                <Input value={scDiag} onChange={(e) => setScDiag(e.target.value)} placeholder="Diagnosis" className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
            </div>
            <label
              className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                scOk
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : 'border-border bg-muted/30 hover:bg-muted/50'
              }`}
            >
              <Checkbox
                checked={scOk}
                onCheckedChange={(v) => setScOk(!!v)}
                className="size-4"
              />
              <div>
                <span className="text-sm text-foreground/80 font-medium">Decision-to-Delivery ≤30 Menit</span>
                <p className="text-[10px] text-muted-foreground">Centang jika SC emergensi dilakukan dalam ≤30 menit</p>
              </div>
            </label>
            <ComputedBadge label="Kepatuhan" value={scOk ? 'Patuh (≤30 mnt)' : 'Tidak Patuh (>30 mnt)'} positive={scOk} />
          </div>
        );

      case 'wtrj':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="No. Rekam Medis" required error={errors.wtrjRm}>
                <Input value={wtrjRm} onChange={(e) => setWtrjRm(e.target.value)} placeholder="No. RM" className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
              <FormField label="Dokter/Poli" required error={errors.wtrjDoc}>
                <Input value={wtrjDoc} onChange={(e) => setWtrjDoc(e.target.value)} placeholder="Nama dokter/poli" className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Waktu Pendaftaran" required error={errors.wtrjT1}>
                <Input type="time" value={wtrjT1} onChange={(e) => setWtrjT1(e.target.value)} className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
              <FormField label="Waktu Dilayani" required error={errors.wtrjT2}>
                <Input type="time" value={wtrjT2} onChange={(e) => setWtrjT2(e.target.value)} className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
            </div>
            <div className="flex items-center gap-4">
              <ComputedBadge label="Selisih Waktu" value={`${timeDiffMinutes(wtrjT1, wtrjT2)} menit`} />
              <ComputedBadge label="Status" value={wtrjStChecked ? '>60 Menit' : '≤60 Menit'} positive={!wtrjStChecked} />
            </div>
          </div>
        );

      case 'op':
        return (
          <div className="space-y-4">
            <FormField label="No. Rekam Medis" required error={errors.opRm}>
              <Input value={opRm} onChange={(e) => setOpRm(e.target.value)} placeholder="No. RM" className="h-9 bg-muted/50 border-border text-sm" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Jadwal Operasi" required error={errors.opT1}>
                <Input type="datetime-local" value={opT1} onChange={(e) => setOpT1(e.target.value)} className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
              <FormField label="Waktu Aktual" required error={errors.opT2}>
                <Input type="datetime-local" value={opT2} onChange={(e) => setOpT2(e.target.value)} className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
            </div>
            <label
              className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                opTertunda
                  ? 'border-red-500/40 bg-red-500/10'
                  : 'border-border bg-muted/30 hover:bg-muted/50'
              }`}
            >
              <Checkbox
                checked={opTertunda}
                onCheckedChange={(v) => setOpTertunda(!!v)}
                className="size-4"
              />
              <span className="text-sm text-foreground/80 font-medium">Operasi Tertunda</span>
            </label>
            <AnimatePresence>
              {opTertunda && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <FormField label="Alasan Penundaan" required error={errors.opR}>
                    <Input value={opR} onChange={(e) => setOpR(e.target.value)} placeholder="Masukkan alasan penundaan" className="h-9 bg-muted/50 border-border text-sm" />
                  </FormField>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );

      case 'lab':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="No. Rekam Medis" required error={errors.labRm}>
                <Input value={labRm} onChange={(e) => setLabRm(e.target.value)} placeholder="No. RM" className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
              <FormField label="Pemeriksaan" required error={errors.labExam}>
                <Input value={labExam} onChange={(e) => setLabExam(e.target.value)} placeholder="Jenis pemeriksaan" className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Waktu Keluar Hasil" required error={errors.labT1}>
                <Input type="time" value={labT1} onChange={(e) => setLabT1(e.target.value)} className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
              <FormField label="Waktu Diterima" required error={errors.labT2}>
                <Input type="time" value={labT2} onChange={(e) => setLabT2(e.target.value)} className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
            </div>
            <div className="flex items-center gap-4">
              <ComputedBadge label="Selisih Waktu" value={`${timeDiffMinutes(labT1, labT2)} menit`} />
              <ComputedBadge label="Status" value={labNum ? 'Patuh (≤30 mnt)' : 'Tidak Patuh (>30 mnt)'} positive={labNum} />
            </div>
          </div>
        );

      case 'fornas':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Resep Sesuai Fornas" required error={errors.fornasNum}>
                <Input type="number" min={0} value={fornasNum} onChange={(e) => setFornasNum(parseInt(e.target.value) || 0)} placeholder="0" className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
              <FormField label="Resep Tidak Sesuai">
                <Input type="number" min={0} value={fornasNon} onChange={(e) => setFornasNon(parseInt(e.target.value) || 0)} placeholder="0" className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
            </div>
            <FormField label="Keterangan">
              <Input value={fornasNote} onChange={(e) => setFornasNote(e.target.value)} placeholder="Catatan tambahan (opsional)" className="h-9 bg-muted/50 border-border text-sm" />
            </FormField>
            {fornasNum + fornasNon > 0 && (
              <ComputedBadge
                label="Kepatuhan"
                value={`${Math.round((fornasNum / (fornasNum + fornasNon)) * 100)}%`}
                positive={fornasNum / (fornasNum + fornasNon) >= 0.8}
              />
            )}
          </div>
        );

      case 'cp':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Nama Pasien" required error={errors.cpName}>
                <Input value={cpName} onChange={(e) => setCpName(e.target.value)} placeholder="Nama pasien" className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
              <FormField label="No. RM" required error={errors.cpRm}>
                <Input value={cpRm} onChange={(e) => setCpRm(e.target.value)} placeholder="No. RM" className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
              <FormField label="Diagnosis" required error={errors.cpDiag}>
                <Input value={cpDiag} onChange={(e) => setCpDiag(e.target.value)} placeholder="Diagnosis" className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-foreground/80">Variansi</Label>
              <div className="grid grid-cols-4 gap-2">
                <FormField label="Terapi">
                  <Input type="number" min={0} value={cpVTerapi} onChange={(e) => setCpVTerapi(parseInt(e.target.value) || 0)} className="h-9 bg-muted/50 border-border text-sm" />
                </FormField>
                <FormField label="Laboratorium">
                  <Input type="number" min={0} value={cpVLab} onChange={(e) => setCpVLab(parseInt(e.target.value) || 0)} className="h-9 bg-muted/50 border-border text-sm" />
                </FormField>
                <FormField label="Radiologi">
                  <Input type="number" min={0} value={cpVRad} onChange={(e) => setCpVRad(parseInt(e.target.value) || 0)} className="h-9 bg-muted/50 border-border text-sm" />
                </FormField>
                <FormField label="Lainnya">
                  <Input type="number" min={0} value={cpVLain} onChange={(e) => setCpVLain(parseInt(e.target.value) || 0)} className="h-9 bg-muted/50 border-border text-sm" />
                </FormField>
              </div>
              {cpVLain > 0 && (
                <FormField label="Keterangan Variansi Lain">
                  <Input value={cpVLainKet} onChange={(e) => setCpVLainKet(e.target.value)} placeholder="Jelaskan varian lain" className="h-9 bg-muted/50 border-border text-sm" />
                </FormField>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-foreground/80">Kepatuhan PPA</Label>
              <div className="grid grid-cols-3 gap-2">
                <FormField label="Perawat">
                  <Select value={cpPerawat} onValueChange={setCpPerawat}>
                    <SelectTrigger className="h-9 bg-muted/50 border-border text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="Ya" className="text-sm">Ya</SelectItem>
                      <SelectItem value="Tidak" className="text-sm">Tidak</SelectItem>
                      <SelectItem value="Sebagian" className="text-sm">Sebagian</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Farmasi">
                  <Select value={cpFarmasi} onValueChange={setCpFarmasi}>
                    <SelectTrigger className="h-9 bg-muted/50 border-border text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="Ya" className="text-sm">Ya</SelectItem>
                      <SelectItem value="Tidak" className="text-sm">Tidak</SelectItem>
                      <SelectItem value="Sebagian" className="text-sm">Sebagian</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Gizi">
                  <Select value={cpGizi} onValueChange={setCpGizi}>
                    <SelectTrigger className="h-9 bg-muted/50 border-border text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="Ya" className="text-sm">Ya</SelectItem>
                      <SelectItem value="Tidak" className="text-sm">Tidak</SelectItem>
                      <SelectItem value="Sebagian" className="text-sm">Sebagian</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="LOS (hari)">
                <Input type="number" min={0} value={cpLos} onChange={(e) => setCpLos(parseInt(e.target.value) || 0)} placeholder="0" className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
              <FormField label="Keterangan">
                <Input value={cpKet} onChange={(e) => setCpKet(e.target.value)} placeholder="Catatan (opsional)" className="h-9 bg-muted/50 border-border text-sm" />
              </FormField>
            </div>
            <ComputedBadge
              label="Kepatuhan CP"
              value={
                cpVTerapi + cpVLab + cpVRad + cpVLain === 0 && cpPerawat === 'Ya' && cpFarmasi === 'Ya' && cpGizi === 'Ya'
                  ? 'Patuh'
                  : 'Tidak Patuh'
              }
              positive={cpVTerapi + cpVLab + cpVRad + cpVLain === 0 && cpPerawat === 'Ya' && cpFarmasi === 'Ya' && cpGizi === 'Ya'}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-lg bg-card border-border p-0 gap-0 overflow-hidden"
        showCloseButton={false}
      >
        {/* Gradient top border */}
        <div
          className="h-1.5 w-full"
          style={{
            background: `linear-gradient(90deg, ${meta.color}, ${meta.color}80, ${meta.color}40)`,
          }}
        />

        {/* Header */}
        <DialogHeader className="px-5 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <span
              className="flex size-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${meta.color}25` }}
            >
              <Icon className="size-4.5" style={{ color: meta.color }} />
            </span>
            <div>
              <DialogTitle className="text-sm font-semibold text-foreground">
                Tambah Data — {meta.label}
              </DialogTitle>
              <DialogDescription className="text-[10px] text-muted-foreground">
                Lengkapi formulir di bawah untuk menambahkan data baru
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Date field */}
        <div className="px-5 pb-3">
          <FormField label="Tanggal Input" required error={errors.date}>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 bg-muted/50 border-border text-sm w-48"
            />
          </FormField>
        </div>

        {/* Form content */}
        <ScrollArea className="max-h-[55vh] px-5">
          <div className="pb-4">
            {renderForm()}
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 border-t border-border bg-muted/20">
          <div className="flex items-center gap-2 w-full sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              className="h-8 border-border text-foreground/70 hover:text-foreground hover:bg-muted text-xs"
              disabled={isLoading}
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isLoading}
              className="h-8 text-xs font-medium gap-1.5"
              style={{
                backgroundColor: `${meta.color}30`,
                color: meta.color,
                border: 'none',
              }}
            >
              {isLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              Simpan
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
