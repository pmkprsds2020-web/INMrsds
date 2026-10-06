/**
 * Baca file .xlsx/.xls/.csv jadi baris mentah (MASTER PROMPT bagian 3 & 7).
 */
import * as XLSX from 'xlsx';

export interface ParsedFile {
  headers: string[];
  rows: Record<string, unknown>[];
  sheetCount: number;
  fileName: string;
  fileSizeBytes: number;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB (bagian 7)

export function parseWorkbookFile(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      reject(new Error('Ukuran file melebihi 10 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        // Ambil sheet "DATA" bila ada (template resmi), jika tidak pakai sheet pertama
        // yang bukan "PETUNJUK"/"REFERENSI" (untuk file lama/ekspor pihak lain).
        const preferredNames = ['DATA', 'Data', 'data'];
        let sheetName = workbook.SheetNames.find((n) => preferredNames.includes(n));
        if (!sheetName) {
          sheetName = workbook.SheetNames.find(
            (n) => !/^(petunjuk|referensi)/i.test(n)
          ) ?? workbook.SheetNames[0];
        }
        const sheet = workbook.Sheets[sheetName];
        // Template resmi (templateBuilder.ts) punya 4 baris metadata di atas
        // header (judul, MODUL:, TEMPLATE VERSION:, DIBUAT:) sehingga header
        // ada di baris ke-5. Deteksi tanda tangan tersebut dan mulai membaca
        // dari baris header; file lain (tanpa metadata) tetap dibaca dari baris 1.
        const headerRowIndex = detectTemplateHeaderRow(sheet);
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
          defval: '',
          raw: false,
          dateNF: 'yyyy-mm-dd',
          ...(headerRowIndex > 0 ? { range: headerRowIndex } : {}),
        });
        const headers = rows.length > 0 ? Object.keys(rows[0]) : (XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] as string[] ?? []);

        resolve({
          headers,
          rows,
          sheetCount: workbook.SheetNames.length,
          fileName: file.name,
          fileSizeBytes: file.size,
        });
      } catch {
        reject(new Error('Gagal membaca file Excel/CSV — pastikan format file benar.'));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Kembalikan indeks baris (0-based) header untuk file hasil template resmi,
 * atau 0 bila bukan template resmi. Tanda tangan: kolom A berisi
 * "TEMPLATE VERSION:" pada 10 baris pertama; header = baris tidak kosong
 * pertama setelah blok metadata (baris "DIBUAT:" / "TEMPLATE VERSION:").
 */
function detectTemplateHeaderRow(sheet: XLSX.WorkSheet): number {
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: true, raw: false }).slice(0, 12);
  const colA = grid.map((r) => String((r as unknown[])[0] ?? '').trim().toUpperCase());
  const versionIdx = colA.findIndex((v) => v === 'TEMPLATE VERSION:');
  if (versionIdx < 0) return 0;
  const createdIdx = colA.findIndex((v) => v === 'DIBUAT:');
  let i = Math.max(versionIdx, createdIdx) + 1;
  while (i < grid.length && (grid[i] as unknown[]).every((c) => String(c ?? '').trim() === '')) i++;
  return i < grid.length ? i : 0;
}
