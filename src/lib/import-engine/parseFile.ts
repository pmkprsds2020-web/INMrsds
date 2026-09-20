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
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
          defval: '',
          raw: false,
          dateNF: 'yyyy-mm-dd',
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
