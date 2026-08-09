'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  Eye,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
  type IndicatorType,
  type IndicatorEntry,
  INDICATORS,
} from '@/types';
import { createDefaultEntry, todayStr, uid } from '@/lib/calculations';

/* ── Props ────────────────────────────────────────────────────── */
export interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  type: IndicatorType;
  onImport: (entries: Omit<IndicatorEntry, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<void>;
  activeUnit: string;
  userId: string;
}

/* ── Column mapping per indicator type ────────────────────────── */
const COLUMN_MAPS: Record<IndicatorType, { key: string; label: string }[]> = {
  tangan: [
    { key: 'date', label: 'Tanggal' },
    { key: 'staff', label: 'Petugas' },
    { key: 'observer', label: 'Observer' },
    { key: 'room', label: 'Ruangan' },
    { key: 'm1', label: 'Momen 1' },
    { key: 'm2', label: 'Momen 2' },
    { key: 'm3', label: 'Momen 3' },
    { key: 'm4', label: 'Momen 4' },
    { key: 'm5', label: 'Momen 5' },
    { key: 'method', label: 'Metode' },
    { key: 'patuh', label: 'Patuh' },
  ],
  visite: [
    { key: 'date', label: 'Tanggal' },
    { key: 'rm', label: 'No RM' },
    { key: 'doctor', label: 'Dokter' },
    { key: 'time', label: 'Waktu Visite' },
  ],
  identitas: [
    { key: 'date', label: 'Tanggal' },
    { key: 'staff', label: 'Petugas' },
    { key: 'observer', label: 'Observer' },
    { key: 'room', label: 'Ruangan' },
    { key: 'name', label: 'Nama Pasien' },
    { key: 'rm', label: 'No RM' },
    { key: 'service', label: 'Pelayanan' },
    { key: 'nama', label: 'Cek Nama' },
    { key: 'tgl', label: 'Cek Tgl' },
  ],
  apd: [
    { key: 'date', label: 'Tanggal' },
    { key: 'room', label: 'Ruangan' },
    { key: 'staff', label: 'Petugas' },
    { key: 'comp', label: 'Ya/Tidak' },
  ],
  jatuh: [
    { key: 'date', label: 'Tanggal' },
    { key: 'rm', label: 'No RM' },
    { key: 'awal', label: 'Assess. Awal' },
    { key: 're', label: 'Reassessment' },
    { key: 'inv', label: 'Intervensi' },
    { key: 'cedera', label: 'Pencegahan Cedera' },
  ],
  sc: [
    { key: 'date', label: 'Tanggal' },
    { key: 'rm', label: 'No RM' },
    { key: 'diag', label: 'Diagnosis' },
    { key: 'ok', label: '≤30 Menit' },
  ],
  wtrj: [
    { key: 'date', label: 'Tanggal' },
    { key: 'rm', label: 'No RM' },
    { key: 'doc', label: 'Dokter/Poli' },
    { key: 't1', label: 'Pendaftaran' },
    { key: 't2', label: 'Dilayani' },
  ],
  op: [
    { key: 'date', label: 'Tanggal' },
    { key: 'rm', label: 'No RM/Nama' },
    { key: 't1', label: 'Jadwal' },
    { key: 't2', label: 'Aktual' },
    { key: 'tertunda', label: 'Tertunda' },
    { key: 'r', label: 'Alasan' },
  ],
  lab: [
    { key: 'date', label: 'Tanggal' },
    { key: 'rm', label: 'No RM' },
    { key: 'exam', label: 'Pemeriksaan' },
    { key: 't1', label: 'Keluar Hasil' },
    { key: 't2', label: 'Diterima' },
    { key: 'num', label: '≤30 Mnt' },
  ],
  fornas: [
    { key: 'date', label: 'Tanggal' },
    { key: 'num', label: 'R/ Sesuai' },
    { key: 'non', label: 'R/ Tidak Sesuai' },
    { key: 'note', label: 'Keterangan' },
  ],
  cp: [
    { key: 'date', label: 'Tgl Masuk' },
    { key: 'name', label: 'Nama Pasien' },
    { key: 'rm', label: 'No RM' },
    { key: 'diag', label: 'Diagnosis' },
    { key: 'vTerapi', label: 'Var Terapi' },
    { key: 'vLab', label: 'Var Lab' },
    { key: 'vRad', label: 'Var Rad' },
    { key: 'vLain', label: 'Var Lain' },
    { key: 'vLainKet', label: 'Ket Lain' },
    { key: 'perawat', label: 'Perawat' },
    { key: 'farmasi', label: 'Farmasi' },
    { key: 'gizi', label: 'Gizi' },
    { key: 'los', label: 'LOS' },
    { key: 'ket', label: 'Keterangan' },
  ],
};

/* ── Helpers ──────────────────────────────────────────────────── */
function normalizeHeader(h: string): string {
  return String(h).toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function parseBoolValue(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  const s = String(val).toLowerCase().trim();
  return s === 'ya' || s === 'yes' || s === '1' || s === 'true' || s === 'patuh' || s === 'v';
}

function parseNumberValue(val: unknown): number {
  if (typeof val === 'number') return val;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

/* ── Component ────────────────────────────────────────────────── */
export function ImportModal({
  open,
  onClose,
  type,
  onImport,
  activeUnit,
  userId,
}: ImportModalProps) {
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([]);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState('');

  const meta = useMemo(() => INDICATORS.find((i) => i.id === type)!, [type]);
  const columns = useMemo(() => COLUMN_MAPS[type], [type]);

  /* ── Build header aliases for fuzzy matching ──────────────── */
  const headerAliases = useMemo(() => {
    const map = new Map<string, string>();
    for (const col of columns) {
      // Direct key and label
      map.set(normalizeHeader(col.key), col.key);
      map.set(normalizeHeader(col.label), col.key);
    }
    // Comprehensive common aliases for all indicator types
    const ALIASES: Record<string, string[]> = {
      date: ['tanggal', 'tgl', 'tgldate', 'tgldata', 'tgldatamasuk', 'dateinput'],
      rm: ['norm', 'nomorrm', 'nrm', 'normor', 'nomedrec', 'medrec', 'norekammedis'],
      staff: ['petugas', 'namapetugas', 'petugaskebersihan', 'namastaff'],
      observer: ['pengamat', 'observername', 'pengawas'],
      room: ['ruangan', 'ruang', 'unit', 'bangsal', 'kelas', 'kamarruangan'],
      m1: ['momen1', 'momen', 'moment1', 'saatmenyentuh', 'sebelum'],
      m2: ['momen2', 'moment2', 'sebeluma'],
      m3: ['momen3', 'moment3', 'sesudahcairan'],
      m4: ['momen4', 'moment4', 'sesudahpasien'],
      m5: ['momen5', 'moment5', 'setelahlingkungan'],
      method: ['metode', 'carakebersihan', 'metodekebersihan'],
      patuh: ['kepatuhan', 'patuhhandhygiene', 'compliance'],
      doctor: ['dokter', 'namadokter', 'doktervisite'],
      time: ['waktu', 'waktuvisite', 'jamvisite', 'jam'],
      name: ['nama', 'namapasien', 'patientname', 'pasien'],
      service: ['pelayanan', 'jenispelayanan', 'layanan'],
      nama: ['ceknama', 'pengecekannama', 'namacek'],
      tgl: ['cektgl', 'cektanggal', 'pengecekantgl', 'tanggalcek', 'tgllahircek'],
      comp: ['yatidak', 'kepatuhan', 'kepatuhanapd', 'complianceapd', 'memakaiapd'],
      awal: ['assesawal', 'assessmentawal', 'awalassess', 'penilaianawal'],
      re: ['reassessment', 'reassess', 'penilaianulang'],
      inv: ['intervensi', 'interve', 'tindakan'],
      cedera: ['pencegahancedera', 'cederafall', 'fallinjury', 'tidakcedera'],
      diag: ['diagnosis', 'diagnosa', 'dx'],
      ok: ['kurangdari30menit', 'menit30', 'waktusc', 'sc30menit'],
      doc: ['dokterpoli', 'poli', 'dokterpoliklinik'],
      t1: ['pendaftaran', 'waktupendaftaran', 'waktumasuk', 'jadwal', 'waktukeluarhasil', 'jam1', 'waktu1'],
      t2: ['dilayani', 'waktudilayani', 'aktual', 'waktuditerima', 'jam2', 'waktu2'],
      tertunda: ['tertundaop', 'delay', 'penundaan'],
      r: ['alasan', 'alasantertunda', 'reason', 'keteranganop'],
      exam: ['pemeriksaan', 'jenispemeriksaan', 'typepemeriksaan'],
      num: ['rsesuai', 'resepsesuai', 'jumlahsesuai', '30mnt', 'kurang30menit'],
      non: ['rtidaksesuai', 'resepnonformularium', 'jumlahtidaksesuai', 'tidaksesuai'],
      note: ['keterangan', 'ket', 'catatan', 'notes'],
      vTerapi: ['varterapi', 'variansiterapi', 'terapivariance'],
      vLab: ['varlab', 'variansilab', 'labvariance'],
      vRad: ['varrad', 'variansiradiologi', 'radvariance'],
      vLain: ['varlain', 'variansilain', 'lainvariance'],
      vLainKet: ['varlainket', 'ketlain', 'keteranganlain', 'ketvarianlain'],
      perawat: ['ppaperawat', 'perawatppa', 'cpPerawat'],
      farmasi: ['ppafarmasi', 'farmasippa', 'cpFarmasi'],
      gizi: ['ppagizi', 'gizippa', 'cpGizi'],
      los: ['lengthofstay', 'lamadirawat', 'losday', 'hari'],
      ket: ['keterangan', 'catatan', 'notes', 'remark'],
    };

    for (const [key, aliases] of Object.entries(ALIASES)) {
      for (const alias of aliases) {
        map.set(normalizeHeader(alias), key);
      }
    }

    return map;
  }, [columns]);

  /* ── Handle file upload ───────────────────────────────────── */
  const handleFile = useCallback(
    (file: File) => {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

          // Map Excel headers to our keys
          const mapped = rawRows.map((row) => {
            const mappedRow: Record<string, unknown> = {};
            for (const [excelHeader, value] of Object.entries(row)) {
              const normalized = normalizeHeader(excelHeader);
              const matchedKey = headerAliases.get(normalized);
              if (matchedKey) {
                mappedRow[matchedKey] = value;
              }
            }
            return mappedRow;
          });

          setParsedRows(mapped);
          setStep('preview');
        } catch {
          toast.error('Gagal membaca file Excel');
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [headerAliases]
  );

  /* ── Handle file input change ─────────────────────────────── */
  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  /* ── Handle drop ──────────────────────────────────────────── */
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  /* ── Convert parsed rows to indicator entries ─────────────── */
  const convertRows = useCallback((): Omit<IndicatorEntry, 'id' | 'createdAt' | 'updatedAt'>[] => {
    return parsedRows.map((row) => {
      // Start with default entry
      const base = createDefaultEntry(type, activeUnit, userId) as Record<string, unknown>;

      // Override with parsed values
      for (const col of columns) {
        if (row[col.key] !== undefined && row[col.key] !== '') {
          const val = row[col.key];
          // Type coercion based on field
          if (['m1', 'm2', 'm3', 'm4', 'm5', 'awal', 're', 'inv', 'cedera', 'ok', 'tertunda', 'nama', 'tgl'].includes(col.key) || (col.key === 'num' && type === 'lab')) {
            base[col.key] = parseBoolValue(val);
          } else if (['vTerapi', 'vLab', 'vRad', 'vLain', 'los'].includes(col.key) || (col.key === 'num' && type === 'fornas') || (col.key === 'non' && type === 'fornas')) {
            base[col.key] = parseNumberValue(val);
          } else if (col.key === 'patuh' && type === 'tangan') {
            base[col.key] = parseBoolValue(val) ? true : val === 'tidak' ? false : null;
          } else if (col.key === 'comp' && type === 'apd') {
            // APD comp is a string: 'ya' or 'tidak'
            const s = String(val).toLowerCase().trim();
            base[col.key] = (s === 'ya' || s === 'yes' || s === '1' || s === 'true') ? 'ya' : 'tidak';
          } else if (['perawat', 'farmasi', 'gizi'].includes(col.key) && type === 'cp') {
            // CP PPA fields are strings: 'Ya' or 'Tidak'
            const s = String(val).toLowerCase().trim();
            base[col.key] = (s === 'ya' || s === 'yes' || s === '1' || s === 'true' || s === 'patuh') ? 'Ya' : 'Tidak';
          } else {
            base[col.key] = String(val);
          }
        }
      }

      // Auto-calculate st_checked for WTRJ based on time difference
      if (type === 'wtrj' && base.t1 && base.t2) {
        const t1 = String(base.t1);
        const t2 = String(base.t2);
        const [h1, m1] = t1.split(':').map(Number);
        const [h2, m2] = t2.split(':').map(Number);
        if (!isNaN(h1) && !isNaN(m1) && !isNaN(h2) && !isNaN(m2)) {
          let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
          if (diff < 0) diff += 1440;
          base.st_checked = diff > 60;
        }
      }

      // Auto-calculate st_checked for OP based on time difference
      if (type === 'op' && base.t1 && base.t2 && base.tertunda === undefined) {
        const t1 = String(base.t1);
        const t2 = String(base.t2);
        const [h1, m1] = t1.split(':').map(Number);
        const [h2, m2] = t2.split(':').map(Number);
        if (!isNaN(h1) && !isNaN(m1) && !isNaN(h2) && !isNaN(m2)) {
          let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
          if (diff < 0) diff += 1440;
          // If actual time is much later than scheduled, mark as tertunda
          if (diff > 60) base.tertunda = true;
        }
      }

      return base as Omit<IndicatorEntry, 'id' | 'createdAt' | 'updatedAt'>;
    });
  }, [parsedRows, type, activeUnit, columns]);

  /* ── Confirm import ───────────────────────────────────────── */
  const handleConfirmImport = useCallback(async () => {
    setIsImporting(true);
    try {
      const entries = convertRows();
      await onImport(entries);
      toast.success(`${entries.length} data berhasil diimport`);
      handleClose();
    } catch {
      toast.error('Gagal mengimport data');
    } finally {
      setIsImporting(false);
    }
  }, [convertRows, onImport]);

  /* ── Download template ────────────────────────────────────── */
  const handleDownloadTemplate = useCallback(() => {
    const headers = columns.map((c) => c.label);
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `template_${type}.xlsx`);
  }, [columns, type]);

  /* ── Close / reset ────────────────────────────────────────── */
  const handleClose = useCallback(() => {
    setParsedRows([]);
    setStep('upload');
    setFileName('');
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className="sm:max-w-3xl max-h-[90vh] flex flex-col border-border"
        
      >
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-[#4f8ef7]" />
            Import Excel — {meta.label}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Upload file .xlsx, .xls, atau .csv untuk mengimport data indikator.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="flex-1 space-y-4">
            {/* Drop zone */}
            <div
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/20 py-12 px-4 transition-colors hover:border-[#4f8ef7]/50 hover:bg-muted/50 cursor-pointer"
              onClick={() => document.getElementById('import-file-input')?.click()}
            >
              <Upload className="size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground mb-1">
                Drag &amp; drop file Excel di sini
              </p>
              <p className="text-xs text-muted-foreground/60 mb-3">
                atau klik untuk memilih file (.xlsx, .xls, .csv)
              </p>
              <Input
                id="import-file-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={onFileChange}
                className="hidden"
              />
              <Badge className="bg-muted/50 text-muted-foreground border-border text-[10px]">
                Maksimal 1000 baris
              </Badge>
            </div>

            {/* Download template */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Belum punya template? Download format yang sesuai:
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="h-7 border-border text-muted-foreground hover:text-foreground hover:bg-muted text-xs gap-1.5"
              >
                <Download className="size-3" />
                Download Template
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex-1 space-y-4 min-h-0">
            {/* File info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-400" />
                <span className="text-xs text-foreground/70">{fileName}</span>
                <Badge className="bg-[#4f8ef7]/20 text-[#4f8ef7] border-0 text-[10px]">
                  {parsedRows.length} baris
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep('upload');
                  setParsedRows([]);
                }}
                className="h-7 text-muted-foreground hover:text-foreground hover:bg-muted text-xs gap-1.5"
              >
                <X className="size-3" />
                Ganti File
              </Button>
            </div>

            {/* Preview table */}
            <div className="rounded-lg border border-border overflow-hidden">
              <ScrollArea className="max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground text-[10px] w-10">No</TableHead>
                      {columns.map((col) => (
                        <TableHead key={col.key} className="text-muted-foreground text-[10px]">
                          {col.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.slice(0, 20).map((row, idx) => (
                      <TableRow key={idx} className="border-border/50 hover:bg-muted/50">
                        <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                        {columns.map((col) => (
                          <TableCell key={col.key} className="text-xs text-foreground/70">
                            {String(row[col.key] ?? '—')}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>

            {parsedRows.length > 20 && (
              <p className="text-[10px] text-muted-foreground/60 text-center">
                Menampilkan 20 dari {parsedRows.length} baris
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            Batal
          </Button>
          {step === 'preview' && (
            <Button
              onClick={handleConfirmImport}
              disabled={isImporting || parsedRows.length === 0}
              className="bg-[#4f8ef7] hover:bg-[#4f8ef7]/90 text-white gap-1.5"
            >
              {isImporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Eye className="size-4" />
              )}
              Import {parsedRows.length} Data
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
