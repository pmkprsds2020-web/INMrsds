/**
 * Export OPPE: Excel (exceljs — sudah dipakai Import Engine), CSV, dan PDF.
 *
 * PDF mengikuti pola modul lain di INMrsds (Risiko/IKP/UIMU: "Print / PDF"):
 * dokumen cetak A4 disusun sebagai HTML lalu dibuka di jendela baru dengan
 * dialog cetak browser → "Simpan sebagai PDF". Tidak menambah dependensi
 * baru ke project.
 */
import ExcelJS from 'exceljs';
import type { OppeEvaluation, OppeEvaluationItem, OppeFppe, OppeSettings } from '@/types/oppe';
import { OPPE_ITEM_STATUS_LABEL, OPPE_STATUS_LABEL, OPPE_FPPE_STATUS_LABEL, OPPE_TREND_LABEL, periodLabel } from '@/types/oppe';
import { triggerBlobDownload } from '@/lib/import-engine/templateBuilder';
import { fmtNum, describeTarget } from '@/lib/oppeScoring';

const stamp = () => new Date().toISOString().slice(0, 10);

export function evaluationExportRow(e: OppeEvaluation): Record<string, string | number | null> {
  return {
    'No. Evaluasi': e.evaluationNumber,
    'Nama Dokter': e.doctorName ?? '',
    Profesi: e.profession ?? '',
    Spesialisasi: e.specialty ?? '',
    KSM: e.ksmName ?? '',
    Unit: e.unitName ?? '',
    Periode: periodLabel(e),
    Tahun: e.year,
    Semester: e.semester ?? '',
    Evaluator: e.evaluatorName ?? '',
    'Tanggal Evaluasi': e.evaluationDate ?? '',
    Status: OPPE_STATUS_LABEL[e.status],
    'Skor Perilaku Profesional': e.scoreProfessional,
    'Skor Pengembangan Profesional': e.scoreDevelopment,
    'Skor Kinerja Klinis': e.scoreClinical,
    'Skor Akhir': e.finalScore,
    'Kategori Hasil': e.finalCategoryLabel ?? '',
    'Jumlah Memenuhi': e.metCount,
    'Jumlah Perlu Perhatian': e.attentionCount,
    'Jumlah Trigger': e.triggerCount,
    'Indikator Kritis Trigger': e.criticalIndicators ?? '',
    'Rekomendasi FPPE': e.requiresFppe ? 'Ya' : 'Tidak',
    Trend: e.trend ? OPPE_TREND_LABEL[e.trend] : '',
    'Skor Periode Sebelumnya': e.previousScore,
    Rekomendasi: (e.recommendationOverride || e.recommendation || '').replace(/\n/g, ' '),
  };
}

function itemExportRow(e: OppeEvaluation, i: OppeEvaluationItem): Record<string, string | number | null> {
  return {
    'No. Evaluasi': e.evaluationNumber,
    'Nama Dokter': e.doctorName ?? '',
    KSM: e.ksmName ?? '',
    Periode: periodLabel(e),
    'Kode Indikator': i.code,
    Kategori: i.categoryCode,
    Parameter: i.name,
    Target: i.targetText || describeTarget(i, i.unitLabel),
    Realisasi: i.realizationText,
    Satuan: i.unitLabel,
    Pencapaian: i.achievement,
    Trigger: i.triggerText,
    Status: OPPE_ITEM_STATUS_LABEL[i.status],
    Kritis: i.isCritical ? 'Ya' : '',
    Skor: i.score,
    'Sumber Data': i.sourceData,
    Catatan: i.notes,
    Bukti: i.evidenceUrl,
  };
}

function addSheet(wb: ExcelJS.Workbook, name: string, rows: Record<string, unknown>[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  if (rows.length === 0) { ws.addRow(['Tidak ada data']); return; }
  const headers = Object.keys(rows[0]);
  ws.addRow(headers);
  ws.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9F1239' } };
    c.alignment = { vertical: 'middle', wrapText: true };
  });
  for (const r of rows) ws.addRow(headers.map((h) => r[h] ?? ''));
  headers.forEach((h, i) => { ws.getColumn(i + 1).width = Math.min(60, Math.max(12, h.length + 4)); });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
}

export async function exportOppeExcel(params: {
  evaluations: OppeEvaluation[];
  itemsByEvaluation?: Map<string, OppeEvaluationItem[]>;
  fppe?: OppeFppe[];
  fileName?: string;
}): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'INMrsds — Modul OPPE';
  wb.created = new Date();
  addSheet(wb, 'Rekap OPPE', params.evaluations.map(evaluationExportRow));
  if (params.itemsByEvaluation) {
    const rows: Record<string, unknown>[] = [];
    for (const e of params.evaluations) for (const i of params.itemsByEvaluation.get(e.id) ?? []) rows.push(itemExportRow(e, i));
    addSheet(wb, 'Detail Indikator', rows);
  }
  if (params.fppe) {
    addSheet(wb, 'FPPE', params.fppe.map((f) => ({
      'No. FPPE': f.fppeNumber, Dokter: f.doctorName, KSM: f.ksmName, 'Indikator Pemicu': f.triggerIndicatorName, Alasan: f.reason,
      Area: f.area, Mulai: f.startDate, Selesai: f.endDate, Evaluator: f.evaluatorName, Rencana: f.plan, Hasil: f.result,
      Rekomendasi: f.recommendation, Status: OPPE_FPPE_STATUS_LABEL[f.status],
    })));
  }
  const buf = await wb.xlsx.writeBuffer();
  triggerBlobDownload(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), params.fileName ?? `OPPE_Export_${stamp()}.xlsx`);
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportOppeCsv(rows: Record<string, unknown>[], fileName = `OPPE_Export_${stamp()}.csv`): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvEscape).join(','), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(','))];
  triggerBlobDownload(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), fileName);
}

export function exportOppeItemsCsv(evaluations: OppeEvaluation[], itemsByEvaluation: Map<string, OppeEvaluationItem[]>): void {
  const rows: Record<string, unknown>[] = [];
  for (const e of evaluations) for (const i of itemsByEvaluation.get(e.id) ?? []) rows.push(itemExportRow(e, i));
  exportOppeCsv(rows, `OPPE_Detail_Indikator_${stamp()}.csv`);
}

// ────────────────────────────────────────────────────────────────
// PDF (cetak) — LEMBAR EVALUASI PRAKTIK PROFESIONAL BERKELANJUTAN
// ────────────────────────────────────────────────────────────────
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const STATUS_PRINT_COLOR: Record<string, string> = { met: '#15803d', attention: '#b45309', trigger: '#b91c1c', no_data: '#64748b' };

function sheetHtml(e: OppeEvaluation, items: OppeEvaluationItem[], fppe: OppeFppe[], settings: OppeSettings, hospitalName: string): string {
  const cats = e.categoryScores.length > 0 ? e.categoryScores : [];
  const groups = cats.length > 0 ? cats.map((c) => ({ code: c.code, name: c.name, weight: c.weight, score: c.score, weighted: c.weighted })) : [];
  let no = 0;
  const rowsFor = (code: string) => items.filter((i) => i.categoryCode === code).map((i) => {
    no++;
    return `<tr>
      <td class="c">${no}</td>
      <td>${esc(i.name)}${i.isCritical ? ' <span class="crit">KRITIS</span>' : ''}</td>
      <td class="c">${esc(i.targetText || describeTarget(i, i.unitLabel))}</td>
      <td class="c">${esc(i.realizationText ?? '—')}${i.realizationText && i.unitLabel && !['kategori'].includes(i.unitLabel) ? ` ${esc(i.unitLabel === '%' ? '%' : i.unitLabel)}` : ''}</td>
      <td class="c" style="color:${STATUS_PRINT_COLOR[i.status]};font-weight:600">${esc(OPPE_ITEM_STATUS_LABEL[i.status])}</td>
      <td>${esc(i.sourceData ?? '')}</td>
    </tr>`;
  }).join('');
  const triggers = items.filter((i) => i.status === 'trigger');
  const recommendation = e.recommendationOverride || e.recommendation || '—';
  const catCfg = settings.resultCategories.find((c) => c.code === e.finalCategory);
  return `
  <section class="sheet">
    <div class="hdr">
      <div class="hosp">${esc(hospitalName)}</div>
      <h1>LEMBAR EVALUASI PRAKTIK PROFESIONAL BERKELANJUTAN</h1>
      <h2>OPPE — Ongoing Professional Practice Evaluation</h2>
    </div>
    <table class="id">
      <tr><td>Nama Dokter</td><td>: <b>${esc(e.doctorName)}</b></td><td>No. Evaluasi</td><td>: ${esc(e.evaluationNumber)}</td></tr>
      <tr><td>Profesi / Spesialisasi</td><td>: ${esc([e.profession, e.specialty].filter(Boolean).join(' / ') || '—')}</td><td>Status</td><td>: ${esc(OPPE_STATUS_LABEL[e.status])}</td></tr>
      <tr><td>KSM</td><td>: ${esc(e.ksmName ?? '—')}</td><td>Unit</td><td>: ${esc(e.unitName ?? '—')}</td></tr>
      <tr><td>Periode Evaluasi</td><td>: ${esc(periodLabel(e))}</td><td>Evaluator</td><td>: ${esc(e.evaluatorName ?? '—')}</td></tr>
    </table>

    <h3>I. TABEL INDIKATOR EVALUASI DAN CAPAIAN</h3>
    <table class="grid">
      <thead><tr><th style="width:28px">No</th><th>Parameter</th><th style="width:90px">Target</th><th style="width:80px">Realisasi</th><th style="width:80px">Status</th><th style="width:120px">Sumber Data</th></tr></thead>
      <tbody>
        ${groups.map((g) => `<tr class="grp"><td class="c">${esc(g.code)}</td><td colspan="5">${esc(g.name.toUpperCase())} (Bobot: ${fmtNum(g.weight)}%)</td></tr>${rowsFor(g.code)}`).join('')}
      </tbody>
    </table>

    <h3>II. SKOR AKHIR TERBOBOT</h3>
    <table class="grid score">
      <thead><tr><th>Kategori</th><th>Bobot</th><th>Skor Kategori</th><th>Skor Terbobot</th></tr></thead>
      <tbody>
        ${groups.map((g) => `<tr><td>${esc(g.name)}</td><td class="c">${fmtNum(g.weight)}%</td><td class="c">${fmtNum(g.score)}</td><td class="c">${fmtNum(g.weighted)}%</td></tr>`).join('')}
        <tr class="tot"><td colspan="3">TOTAL SKOR AKHIR OPPE</td><td class="c">${fmtNum(e.finalScore)}%</td></tr>
      </tbody>
    </table>

    <h3>III. KATEGORI HASIL AKHIR</h3>
    <p class="cat" style="border-color:${catCfg?.color ?? '#334155'}">${esc(e.finalCategoryLabel ?? 'Belum dapat ditentukan')}</p>
    <p class="small">Rentang: ${settings.resultCategories.slice().sort((a, b) => b.min - a.min).map((c) => `${esc(c.label)} ${c.max === null ? `≥ ${c.min}` : `${c.min} – < ${c.max}`}`).join(' · ')}</p>

    <h3>IV. INDIKATOR TRIGGER</h3>
    ${triggers.length === 0 ? '<p>Tidak ada indikator yang menyentuh batas trigger.</p>' : `<ul>${triggers.map((t) => `<li>${esc(t.name)} — realisasi ${esc(t.realizationText)} (trigger: ${esc(t.triggerText ?? '-')})${t.isCritical ? ' <b>[KRITIS]</b>' : ''}</li>`).join('')}</ul>`}
    ${e.criticalTriggerCount > 0 ? '<p class="warn">⚠ Terdapat indikator kritis yang terkena trigger. Perlu evaluasi lebih lanjut / FPPE sesuai keputusan Komite Medik.</p>' : ''}

    <h3>V. KESIMPULAN</h3>
    <p>${esc(e.conclusion ?? '—')}</p>

    <h3>VI. REKOMENDASI</h3>
    <p>${esc(recommendation).replace(/\n/g, '<br/>')}</p>
    ${e.notes ? `<p><b>Catatan pembinaan / rencana tindak lanjut:</b> ${esc(e.notes)}</p>` : ''}

    <h3>VII. FPPE</h3>
    ${fppe.length === 0 ? `<p>${e.requiresFppe ? 'Direkomendasikan FPPE — belum dibuat.' : 'Tidak diperlukan.'}</p>` : `<ul>${fppe.map((f) => `<li>${esc(f.fppeNumber)} — ${esc(f.triggerIndicatorName ?? f.reason)} — status: ${esc(OPPE_FPPE_STATUS_LABEL[f.status])} (${esc(f.startDate ?? '?')} s/d ${esc(f.endDate ?? '?')})</li>`).join('')}</ul>`}

    <p class="small">Keputusan kewenangan klinis tetap berada pada Komite Medik / pejabat berwenang. Dicetak dari INMrsds pada ${esc(new Date().toLocaleString('id-ID'))}.</p>

    <table class="sign">
      <tr><td>Dokter Terkait,</td><td>Ketua KSM,</td><td>Subkomite Mutu Profesi,</td></tr>
      <tr><td class="sp"></td><td class="sp"></td><td class="sp"></td></tr>
      <tr><td>(${esc(e.doctorName ?? '................................')})</td><td>(................................)</td><td>(................................)</td></tr>
    </table>
  </section>`;
}

export function printOppeSheets(entries: { evaluation: OppeEvaluation; items: OppeEvaluationItem[]; fppe: OppeFppe[] }[], settings: OppeSettings, hospitalName = 'Rumah Sakit'): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"/><title>Lembar Evaluasi OPPE</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5px; color: #111; margin: 0; }
    .sheet { page-break-after: always; }
    .sheet:last-child { page-break-after: auto; }
    .hdr { text-align: center; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 8px; }
    .hosp { font-size: 11px; font-weight: 700; letter-spacing: .5px; }
    h1 { font-size: 14px; margin: 4px 0 0; }
    h2 { font-size: 11px; margin: 2px 0 0; font-weight: 600; }
    h3 { font-size: 11px; margin: 12px 0 4px; }
    table { border-collapse: collapse; width: 100%; }
    .id td { padding: 1.5px 4px; vertical-align: top; }
    .id td:nth-child(1), .id td:nth-child(3) { width: 18%; color: #333; }
    .grid th, .grid td { border: 1px solid #555; padding: 3px 4px; vertical-align: top; }
    .grid th { background: #e5e7eb; }
    .grp td { background: #f3f4f6; font-weight: 700; }
    .tot td { font-weight: 700; background: #f3f4f6; }
    .c { text-align: center; }
    .crit { font-size: 8px; color: #b91c1c; border: 1px solid #b91c1c; padding: 0 2px; border-radius: 2px; }
    .cat { display: inline-block; font-size: 13px; font-weight: 700; border: 2px solid; padding: 3px 10px; border-radius: 4px; margin: 2px 0; }
    .warn { color: #b91c1c; font-weight: 700; }
    .small { font-size: 9px; color: #444; }
    .sign { margin-top: 16px; text-align: center; }
    .sign td { width: 33%; padding: 2px; }
    .sign .sp { height: 48px; }
  </style></head><body>
  ${entries.map((x) => sheetHtml(x.evaluation, x.items, x.fppe, settings, hospitalName)).join('')}
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>
  </body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

/**
 * Export realisasi dalam format yang SAMA dengan template import OPPE
 * (header baris 1 = label kolom ImportConfig) supaya bisa diedit lalu
 * diimport kembali tanpa mengubah struktur file.
 */
export async function exportOppeImportFormat(
  columns: { key: string; label: string; required?: boolean }[],
  evaluations: OppeEvaluation[],
  itemsByEvaluation: Map<string, OppeEvaluationItem[]>
): Promise<number> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('DATA');
  ws.addRow(columns.map((c) => c.label + (c.required ? ' *' : '')));
  ws.getRow(1).eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }; });
  const periodText: Record<string, string> = { semester_1: 'Semester I', semester_2: 'Semester II', tahunan: 'Tahunan' };
  let n = 0;
  for (const e of evaluations) {
    if (e.periodType === 'custom') continue; // periode custom tidak didukung import
    for (const i of itemsByEvaluation.get(e.id) ?? []) {
      const values: Record<string, unknown> = {
        doctor_id: e.doctorName, profession: e.profession, ksm_name: e.ksmName, period_type: periodText[e.periodType], year: e.year,
        semester: e.semester ?? '', indicator_id: i.code, category: i.categoryCode, parameter: i.name,
        target_raw: i.targetValue !== null && (i.triggerOperator === 'lt_target' || i.triggerOperator === 'gt_target') ? i.targetValue : (i.targetText ?? ''),
        realization_text: i.realizationText ?? '', unit: i.unitLabel, trigger: i.triggerText, source_data: i.sourceData, notes: i.notes,
      };
      ws.addRow(columns.map((c) => (values[c.key] ?? '') as ExcelJS.CellValue));
      n++;
    }
  }
  columns.forEach((c, idx) => { ws.getColumn(idx + 1).width = Math.max(14, c.label.length + 4); });
  const buf = await wb.xlsx.writeBuffer();
  triggerBlobDownload(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `OPPE_realisasi_export_${stamp()}.xlsx`);
  return n;
}
