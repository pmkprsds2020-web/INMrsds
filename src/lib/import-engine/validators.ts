/**
 * Validasi tipe data & referensi per baris (MASTER PROMPT bagian 6, 10, 11, 12).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ImportColumnDef, ImportRowError, MappedRow } from './types';

const BOOLEAN_TRUE = new Set(['ya', 'yes', 'true', '1', 'benar']);
const BOOLEAN_FALSE = new Set(['tidak', 'no', 'false', '0', 'salah']);

/** Normalisasi variasi periode umum (TW 1 / Triwulan I / Q1 -> "TW I", dst) — bagian 12. */
const PERIOD_ALIASES: Record<string, string> = {
  'tw1': 'TW I', 'tw01': 'TW I', 'triwulan1': 'TW I', 'triwulani': 'TW I', 'q1': 'TW I',
  'tw2': 'TW II', 'tw02': 'TW II', 'triwulan2': 'TW II', 'triwulanii': 'TW II', 'q2': 'TW II',
  'tw3': 'TW III', 'tw03': 'TW III', 'triwulan3': 'TW III', 'triwulaniii': 'TW III', 'q3': 'TW III',
  'tw4': 'TW IV', 'tw04': 'TW IV', 'triwulan4': 'TW IV', 'triwulaniv': 'TW IV', 'q4': 'TW IV',
  'semester1': 'Semester I', 'semesteri': 'Semester I', 's1': 'Semester I',
  'semester2': 'Semester II', 'semesterii': 'Semester II', 's2': 'Semester II',
  'bulanan': 'Bulanan', 'tahunan': 'Tahunan',
};

export function normalizePeriodValue(raw: string): string {
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  return PERIOD_ALIASES[key] ?? raw;
}

function parseDateValue(raw: unknown): { ok: true; value: string } | { ok: false } {
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return { ok: true, value: raw.toISOString().slice(0, 10) };
  }
  const s = String(raw).trim();
  // YYYY-MM-DD (format wajib, bagian 5) atau DD/MM/YYYY sebagai fallback toleran
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ok: true, value: s };
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return { ok: true, value: `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}` };
  }
  return { ok: false };
}

export async function validateAndCoerceRow(
  supabase: SupabaseClient,
  row: MappedRow,
  columns: ImportColumnDef[]
): Promise<{ mapped: MappedRow; errors: ImportRowError[] }> {
  const errors: ImportRowError[] = [];
  const mapped: MappedRow = {};

  for (const col of columns) {
    const raw = row[col.key];
    const isEmpty = raw === undefined || raw === null || String(raw).trim() === '';

    if (isEmpty) {
      if (col.required) {
        errors.push({ column: col.label, message: `${col.label} wajib diisi.` });
      }
      mapped[col.key] = null;
      continue;
    }

    const s = String(raw).trim();

    switch (col.type) {
      case 'text':
      case 'array_text': {
        mapped[col.key] = col.type === 'array_text'
          ? s.split(/[,;]/).map((v) => v.trim()).filter(Boolean)
          : s;
        break;
      }
      case 'integer': {
        const n = Number(s.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'));
        if (!Number.isFinite(n) || !Number.isInteger(n)) {
          errors.push({ column: col.label, message: `${col.label} harus berupa angka bulat.` });
        } else if (col.min !== undefined && n < col.min) {
          errors.push({ column: col.label, message: `${col.label} minimal ${col.min}.` });
        } else if (col.max !== undefined && n > col.max) {
          errors.push({ column: col.label, message: `${col.label} maksimal ${col.max}.` });
        } else {
          mapped[col.key] = n;
        }
        break;
      }
      case 'decimal': {
        const n = Number(s.replace(',', '.'));
        if (!Number.isFinite(n)) {
          errors.push({ column: col.label, message: `${col.label} harus berupa angka.` });
        } else {
          mapped[col.key] = n;
        }
        break;
      }
      case 'percentage': {
        const n = Number(s.replace('%', '').replace(',', '.'));
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          errors.push({ column: col.label, message: `${col.label} harus berupa angka 0–100 tanpa simbol %.` });
        } else {
          mapped[col.key] = n;
        }
        break;
      }
      case 'date': {
        const parsed = parseDateValue(raw);
        if (!parsed.ok) {
          errors.push({ column: col.label, message: `${col.label} harus format tanggal YYYY-MM-DD.` });
        } else {
          mapped[col.key] = parsed.value;
        }
        break;
      }
      case 'time': {
        const m = s.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
        if (!m) {
          errors.push({ column: col.label, message: `${col.label} harus format waktu HH:MM.` });
        } else {
          mapped[col.key] = `${m[1].padStart(2, '0')}:${m[2]}`;
        }
        break;
      }
      case 'boolean': {
        const low = s.toLowerCase();
        if (BOOLEAN_TRUE.has(low)) mapped[col.key] = true;
        else if (BOOLEAN_FALSE.has(low)) mapped[col.key] = false;
        else errors.push({ column: col.label, message: `${col.label} hanya boleh diisi Ya/Tidak/TRUE/FALSE.` });
        break;
      }
      case 'enum': {
        const options = col.enumValues ?? [];
        const found = options.find(
          (o) => o.value.toLowerCase() === s.toLowerCase() || o.label.toLowerCase() === s.toLowerCase()
        );
        if (!found) {
          errors.push({
            column: col.label,
            message: `${col.label} "${s}" tidak dikenali. Nilai yang diperbolehkan: ${options.map((o) => o.label).join(', ')}.`,
          });
        } else {
          mapped[col.key] = found.value;
        }
        break;
      }
      case 'reference': {
        if (!col.resolveReference) {
          mapped[col.key] = s;
          break;
        }
        const result = await col.resolveReference(supabase, s);
        if (!result.ok) {
          errors.push({ column: col.label, message: result.message });
        } else {
          mapped[col.key] = result.value;
        }
        break;
      }
    }
  }

  for (const col of columns) {
    if (col.transform) {
      mapped[col.key] = col.transform(mapped[col.key], mapped);
    }
  }

  return { mapped, errors };
}
