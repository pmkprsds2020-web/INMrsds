import {
  IndicatorType,
  IndicatorEntry,
  TanganEntry,
  VisiteEntry,
  IdentitasEntry,
  ApdEntry,
  JatuhEntry,
  ScEntry,
  WtrjEntry,
  OpEntry,
  LabEntry,
  FornasEntry,
  CpEntry,
  INDICATORS,
} from '@/types';

// ──────────────────────────────────────────────
// Utility helpers
// ──────────────────────────────────────────────

/** Generate a unique ID */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Get today's date as YYYY-MM-DD (local timezone) */
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Calculate time difference in minutes between two HH:mm strings */
export function timeDiffMinutes(t1: string, t2: string): number {
  if (!t1 || !t2) return 0;
  const [h1, m1] = t1.split(':').map(Number);
  const [h2, m2] = t2.split(':').map(Number);
  let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (diff < 0) diff += 1440;
  return diff;
}

/** Whether a visite time string is "patuh" — visite done before 14:00 */
export function isVisitePatuh(time: string): boolean {
  if (!time) return false;
  const [h, m] = time.split(':').map(Number);
  return (h * 60 + (m || 0)) < 840; // 14:00 = 840 minutes
}

// ──────────────────────────────────────────────
// Per-indicator compliance / numerator helpers
// ──────────────────────────────────────────────

/** Whether a tangan entry is compliant */
function isTanganPatuhEntry(entry: TanganEntry): boolean {
  return entry.patuh === true;
}

/** Whether identitas entry is compliant (both name and DOB verified) */
function isIdentitasPatuhEntry(entry: IdentitasEntry): boolean {
  return entry.nama && entry.tgl;
}

/** Whether a jatuh entry has complete assessment */
function isJatuhPatuhEntry(entry: JatuhEntry): boolean {
  return entry.awal && entry.re && entry.inv && entry.cedera;
}

/** Whether WTRJ meets target (wait time ≤ 60 min → st_checked = false means compliant) */
function isWtrjPatuhEntry(entry: WtrjEntry): boolean {
  return !entry.st_checked;
}

/** Whether operation was delayed */
function isOpTertundaEntry(entry: OpEntry): boolean {
  return entry.tertunda;
}

/** Whether lab critical result was reported on time */
function isLabPatuhEntry(entry: LabEntry): boolean {
  return entry.num;
}

/** Calculate fornas pct from a list of fornas entries */
function calcFornas(entries: FornasEntry[]): { num: number; den: number; pct: number } {
  let num = 0;
  let den = 0;
  for (const e of entries) {
    num += e.num || 0;
    den += (e.num || 0) + (e.non || 0);
  }
  const pct = den > 0 ? (num / den) * 100 : 0;
  return { num, den, pct };
}

/** Calculate CP (clinical pathway) compliance - all PPAs must be patuh */
function isCpPatuhEntry(entry: CpEntry): boolean {
  const totalVariance = entry.vTerapi + entry.vLab + entry.vRad + entry.vLain;
  return totalVariance === 0 && entry.perawat === 'Ya' && entry.farmasi === 'Ya' && entry.gizi === 'Ya';
}

// ──────────────────────────────────────────────
// Generic stats calculation per indicator type
// ──────────────────────────────────────────────

export interface IndicatorStats {
  num: number;
  den: number;
  pct: number;
  ok: boolean;
}

export function calculateStats(type: IndicatorType, entries: IndicatorEntry[]): IndicatorStats {
  if (entries.length === 0) return { num: 0, den: 0, pct: 0, ok: false };

  let num = 0;
  let den = 0;
  const meta = INDICATORS.find(i => i.id === type);

  switch (type) {
    case 'tangan': {
      const tEntries = entries as TanganEntry[];
      den = tEntries.length;
      num = tEntries.filter(isTanganPatuhEntry).length;
      break;
    }
    case 'visite': {
      const vEntries = entries as VisiteEntry[];
      den = vEntries.length;
      num = vEntries.filter(e => isVisitePatuh(e.time)).length;
      break;
    }
    case 'identitas': {
      const iEntries = entries as IdentitasEntry[];
      den = iEntries.length;
      num = iEntries.filter(isIdentitasPatuhEntry).length;
      break;
    }
    case 'apd': {
      const aEntries = entries as ApdEntry[];
      den = aEntries.length;
      num = aEntries.filter(e => e.comp === 'ya').length;
      break;
    }
    case 'jatuh': {
      const jEntries = entries as JatuhEntry[];
      den = jEntries.length;
      num = jEntries.filter(isJatuhPatuhEntry).length;
      break;
    }
    case 'sc': {
      const sEntries = entries as ScEntry[];
      den = sEntries.length;
      num = sEntries.filter(e => e.ok).length;
      break;
    }
    case 'wtrj': {
      const wEntries = entries as WtrjEntry[];
      den = wEntries.length;
      num = wEntries.filter(isWtrjPatuhEntry).length;
      break;
    }
    case 'op': {
      const oEntries = entries as OpEntry[];
      den = oEntries.length;
      num = oEntries.filter(isOpTertundaEntry).length;
      break;
    }
    case 'lab': {
      const lEntries = entries as LabEntry[];
      den = lEntries.length;
      num = lEntries.filter(isLabPatuhEntry).length;
      break;
    }
    case 'fornas': {
      const result = calcFornas(entries as FornasEntry[]);
      num = result.num;
      den = result.den;
      break;
    }
    case 'cp': {
      const cEntries = entries as CpEntry[];
      den = cEntries.length;
      num = cEntries.filter(isCpPatuhEntry).length;
      break;
    }
  }

  const pct = den > 0 ? (num / den) * 100 : 0;
  const ok = meta ? (meta.isLowerBetter ? pct <= meta.target : pct >= meta.target) : false;

  return { num, den, pct: Math.round(pct * 10) / 10, ok };
}

// ──────────────────────────────────────────────
// Monthly aggregation helpers
// ──────────────────────────────────────────────

export interface MonthlyStat {
  yearMonth: string; // "YYYY-MM"
  numerator: number;
  denominator: number;
  pct: number;
}

export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

/** Group entries by YYYY-MM and calculate stats for each month */
export function calculateMonthlyStats(
  type: IndicatorType,
  entries: IndicatorEntry[],
  year: number,
): MonthlyStat[] {
  const result: MonthlyStat[] = [];

  for (let m = 0; m < 12; m++) {
    const mm = String(m + 1).padStart(2, '0');
    const yearMonth = `${year}-${mm}`;
    const monthEntries = entries.filter((e) => {
      if (!e.date) return false;
      return e.date.slice(0, 7) === yearMonth;
    });

    if (monthEntries.length === 0) {
      result.push({ yearMonth, numerator: 0, denominator: 0, pct: 0 });
    } else {
      const stats = calculateStats(type, monthEntries);
      result.push({ yearMonth, numerator: stats.num, denominator: stats.den, pct: stats.pct });
    }
  }

  return result;
}

/** Extract available years from a set of entries */
export function getAvailableYears(entries: IndicatorEntry[]): number[] {
  const yearSet = new Set<number>();
  for (const e of entries) {
    if (e.date) {
      const y = parseInt(e.date.slice(0, 4), 10);
      if (!isNaN(y)) yearSet.add(y);
    }
  }
  const years = Array.from(yearSet).sort((a, b) => b - a);
  if (years.length === 0) years.push(new Date().getFullYear());
  return years;
}

/** Get the indicator meta for a given type */
export function getIndicatorMeta(type: IndicatorType) {
  return INDICATORS.find((i) => i.id === type);
}

// ──────────────────────────────────────────────
// Default entry factory
// ──────────────────────────────────────────────

export function createDefaultEntry(type: IndicatorType, unitId: string, userId: string): Omit<IndicatorEntry, 'id' | 'createdAt' | 'updatedAt'> {
  const base = {
    indicatorType: type,
    unitId,
    date: todayStr(),
    createdBy: userId,
  };

  // Auto-fill room from the user's login unit name
  const roomName = (UNIT_MAP[unitId]?.label) || '';

  switch (type) {
    case 'tangan':
      return { ...base, staff: '', observer: '', room: roomName, m1: false, m2: false, m3: false, m4: false, m5: false, method: 'Handrub', patuh: null } as TanganEntry;
    case 'visite':
      return { ...base, rm: '', doctor: '', time: '09:00' } as VisiteEntry;
    case 'identitas':
      return { ...base, staff: '', observer: '', room: roomName, name: '', rm: '', service: '', nama: true, tgl: true } as IdentitasEntry;
    case 'apd':
      return { ...base, room: roomName, staff: '', comp: 'tidak' } as ApdEntry;
    case 'jatuh':
      return { ...base, rm: '', awal: true, re: true, inv: true, cedera: true } as JatuhEntry;
    case 'sc':
      return { ...base, rm: '', diag: '', ok: false } as ScEntry;
    case 'wtrj':
      return { ...base, rm: '', doc: '', t1: '08:00', t2: '09:00', st_checked: false } as WtrjEntry;
    case 'op':
      return { ...base, rm: '', t1: '08:00', t2: '08:15', tertunda: false, r: '' } as OpEntry;
    case 'lab':
      return { ...base, rm: '', exam: '', t1: '10:00', t2: '10:20', num: true } as LabEntry;
    case 'fornas':
      return { ...base, num: 0, non: 0, note: '' } as FornasEntry;
    case 'cp':
      return { ...base, name: '', rm: '', diag: '', vTerapi: 0, vLab: 0, vRad: 0, vLain: 0, vLainKet: '', perawat: 'Ya', farmasi: 'Ya', gizi: 'Ya', los: 0, ket: '' } as CpEntry;
    default:
      return { ...base } as IndicatorEntry;
  }
}
