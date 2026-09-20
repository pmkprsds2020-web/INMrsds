/**
 * Generator template Excel resmi per modul (MASTER PROMPT bagian 4, 5, 20,
 * 21, 28, 45): sheet DATA + PETUNJUK + REFERENSI, dropdown/data-validation
 * pada kolom enum/reference, dan metadata versi template.
 *
 * Memakai `exceljs` (bukan `xlsx`) karena data-validation/dropdown Excel
 * hanya didukung penuh oleh exceljs — `xlsx` (SheetJS community) dipakai
 * di tempat lain hanya untuk MEMBACA file upload.
 */
import ExcelJS from 'exceljs';
import type { ImportConfig, ImportColumnDef } from './types';

const COLUMN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function colLetter(index: number): string {
  // index 0-based
  let n = index;
  let s = '';
  do {
    s = COLUMN_LETTERS[n % 26] + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export interface TemplateOptions {
  moduleLabel: string;
  year?: number;
}

export async function buildImportTemplate(config: ImportConfig, options: TemplateOptions): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'INMrsds — Sistem Monitoring Indikator Mutu';
  wb.created = new Date();

  // ── Sheet DATA ─────────────────────────────────────────────────────
  const dataSheet = wb.addWorksheet('DATA', { views: [{ state: 'frozen', ySplit: 5 }] });

  dataSheet.mergeCells('A1:D1');
  dataSheet.getCell('A1').value = 'INMrsds — Sistem Monitoring Indikator Mutu';
  dataSheet.getCell('A1').font = { bold: true, size: 13 };

  dataSheet.getCell('A2').value = 'MODUL:';
  dataSheet.getCell('B2').value = options.moduleLabel;
  dataSheet.getCell('A3').value = 'TEMPLATE VERSION:';
  dataSheet.getCell('B3').value = config.templateVersion;
  dataSheet.getCell('A4').value = 'DIBUAT:';
  dataSheet.getCell('B4').value = new Date().toISOString().slice(0, 10) + (options.year ? ` (Tahun ${options.year})` : '');
  dataSheet.getCell('A2').font = { bold: true };
  dataSheet.getCell('A3').font = { bold: true };
  dataSheet.getCell('A4').font = { bold: true };

  const headerRowIdx = 5;
  const headerRow = dataSheet.getRow(headerRowIdx);
  config.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.label + (col.required ? ' *' : '');
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
    dataSheet.getColumn(i + 1).width = Math.max(16, col.label.length + 4);
  });
  headerRow.commit();

  // Baris contoh (row 6)
  const exampleRow = dataSheet.getRow(headerRowIdx + 1);
  config.columns.forEach((col, i) => {
    exampleRow.getCell(i + 1).value = col.example ?? '';
    exampleRow.getCell(i + 1).font = { italic: true, color: { argb: 'FF999999' } };
  });
  exampleRow.commit();

  // ── Sheet REFERENSI ────────────────────────────────────────────────
  const refSheet = wb.addWorksheet('REFERENSI');
  let refCol = 1;
  const enumColumnRanges: { col: ImportColumnDef; excelCol: number; count: number }[] = [];

  for (const col of config.columns) {
    if (col.type === 'enum' && col.enumValues && col.enumValues.length > 0) {
      const c = refSheet.getColumn(refCol);
      c.width = 28;
      refSheet.getCell(1, refCol).value = col.label;
      refSheet.getCell(1, refCol).font = { bold: true };
      col.enumValues.forEach((opt, i) => {
        refSheet.getCell(i + 2, refCol).value = opt.label;
      });
      enumColumnRanges.push({ col, excelCol: refCol, count: col.enumValues.length });
      refCol += 1;
    }
  }

  if (config.referenceSheets) {
    for (const [title, options2] of Object.entries(config.referenceSheets)) {
      const c = refSheet.getColumn(refCol);
      c.width = 28;
      refSheet.getCell(1, refCol).value = title;
      refSheet.getCell(1, refCol).font = { bold: true };
      options2.forEach((opt, i) => {
        refSheet.getCell(i + 2, refCol).value = opt.label;
      });
      refCol += 1;
    }
  }

  // Terapkan dropdown (data validation) pada kolom DATA yang tipenya enum,
  // mengacu ke range di sheet REFERENSI (bagian 28).
  for (const { col, excelCol, count } of enumColumnRanges) {
    const dataColIdx = config.columns.findIndex((c) => c.key === col.key) + 1;
    const letter = colLetter(excelCol - 1);
    const range = `REFERENSI!$${letter}$2:$${letter}$${count + 1}`;
    for (let r = headerRowIdx + 1; r <= headerRowIdx + 500; r++) {
      dataSheet.getCell(r, dataColIdx).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [range],
        showErrorMessage: true,
        errorStyle: 'stop',
        error: `Pilih salah satu nilai dari daftar ${col.label}.`,
      };
    }
  }

  // ── Sheet PETUNJUK ─────────────────────────────────────────────────
  const helpSheet = wb.addWorksheet('PETUNJUK');
  helpSheet.getColumn(1).width = 100;
  const helpLines = [
    `PETUNJUK IMPORT DATA — ${options.moduleLabel}`,
    '',
    '1. Jangan mengubah nama kolom pada sheet DATA.',
    '2. Jangan menghapus kolom wajib (ditandai *).',
    '3. Jangan menggabungkan (merge) sel pada sheet DATA.',
    '4. Satu baris = satu data/record.',
    '5. Gunakan format tanggal YYYY-MM-DD (contoh: 2026-01-31).',
    '6. Gunakan angka tanpa simbol % pada kolom persentase.',
    '7. Untuk kolom dengan daftar pilihan, gunakan dropdown yang tersedia atau lihat sheet REFERENSI — jangan mengetik bebas.',
    '8. Simpan file dalam format .xlsx sebelum diupload kembali.',
    '9. Baris contoh pada sheet DATA (baris ke-6, dicetak miring) boleh dihapus sebelum diisi data sesungguhnya.',
    '10. Hasil export data dari sistem bisa langsung diedit dan diupload kembali tanpa mengubah struktur kolom.',
    ...(config.instructions ?? []),
  ];
  helpLines.forEach((line, i) => {
    const cell = helpSheet.getCell(i + 1, 1);
    cell.value = line;
    if (i === 0) cell.font = { bold: true, size: 13 };
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
