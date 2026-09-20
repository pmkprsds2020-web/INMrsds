/**
 * Download Error Report (MASTER PROMPT bagian 15): Row, Column, Value,
 * Error Type, Error Message, Recommendation.
 */
import ExcelJS from 'exceljs';
import type { ImportRowResult } from './types';
import { triggerBlobDownload } from './templateBuilder';

export async function downloadErrorReport(results: ImportRowResult[], moduleKey: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Import_Error_Report');

  const headers = ['Row', 'Column', 'Value', 'Error Type', 'Error Message', 'Recommendation'];
  headers.forEach((h, i) => {
    const cell = sheet.getCell(1, i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };
  });
  sheet.columns = [{ width: 8 }, { width: 24 }, { width: 24 }, { width: 18 }, { width: 50 }, { width: 40 }];

  let r = 2;
  for (const row of results.filter((x) => x.status === 'error')) {
    for (const err of row.errors) {
      sheet.getCell(r, 1).value = row.excelRow;
      sheet.getCell(r, 2).value = err.column;
      sheet.getCell(r, 3).value = String(row.raw[err.column] ?? row.mapped[err.column] ?? '');
      sheet.getCell(r, 4).value = 'Validation Error';
      sheet.getCell(r, 5).value = err.message;
      sheet.getCell(r, 6).value = 'Perbaiki nilai pada kolom ini sesuai petunjuk pada sheet PETUNJUK, lalu upload ulang.';
      r += 1;
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  triggerBlobDownload(blob, `Import_Error_Report_${moduleKey}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
