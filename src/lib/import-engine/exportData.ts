/**
 * Export data existing ke Excel, 100% kompatibel untuk diimport kembali
 * setelah diedit (MASTER PROMPT bagian 30: "Export -> Edit -> Import
 * kembali harus dapat dilakukan tanpa mengubah struktur file").
 */
import ExcelJS from 'exceljs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ImportConfig } from './types';
import { triggerBlobDownload } from './templateBuilder';

export async function exportModuleData(
  supabase: SupabaseClient,
  config: ImportConfig,
  rows: Record<string, unknown>[],
  fileNamePrefix?: string
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('DATA');

  config.columns.forEach((col, i) => {
    const cell = sheet.getCell(1, i + 1);
    cell.value = col.label + (col.required ? ' *' : '');
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    sheet.getColumn(i + 1).width = Math.max(16, col.label.length + 4);
  });

  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    for (let cIdx = 0; cIdx < config.columns.length; cIdx++) {
      const col = config.columns[cIdx];
      let value: unknown = row[col.key];
      if (col.type === 'enum' && col.enumValues) {
        const found = col.enumValues.find((o) => o.value === value);
        value = found ? found.label : value;
      } else if (col.type === 'reference' && col.reverseReference) {
        value = await col.reverseReference(supabase, value);
      }
      if (Array.isArray(value)) value = value.join(', ');
      sheet.getCell(rIdx + 2, cIdx + 1).value = (value as ExcelJS.CellValue) ?? '';
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const stamp = new Date().toISOString().slice(0, 10);
  triggerBlobDownload(blob, `${fileNamePrefix ?? config.moduleKey}_export_${stamp}.xlsx`);
}
