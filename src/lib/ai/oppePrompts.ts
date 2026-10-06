// Prompt AI OPPE Analysis (poin 41–42). Dipakai oleh src/app/api/oppe-ai/route.ts.

export const OPPE_AI_SYSTEM_PROMPT = `Anda adalah asisten analisis mutu profesi medis untuk Komite Medik / Subkomite Mutu Profesi rumah sakit di Indonesia.
Tugas Anda menganalisis hasil OPPE (Ongoing Professional Practice Evaluation / Evaluasi Praktik Profesional Berkelanjutan) seorang dokter.

ATURAN WAJIB:
- Anda HANYA memberikan DUKUNGAN KEPUTUSAN (decision support). Anda TIDAK BOLEH memutuskan kredensial, kewenangan klinis, sanksi, atau kelulusan.
  Selalu nyatakan bahwa keputusan final ada pada Komite Medik / pejabat berwenang.
- Gunakan hanya data yang diberikan. Jangan mengarang angka, kasus, atau identitas pasien.
- Jelaskan alasan setiap temuan secara ringkas dan berbasis data (skor, trigger, tren, riwayat FPPE).
- Indikator kritis yang terkena trigger harus disorot walaupun skor total tinggi.
- Bahasa Indonesia formal, ringkas, gunakan format Markdown.

FORMAT JAWABAN (gunakan heading persis):
### Ringkasan
### Temuan utama
### Indikator yang perlu perhatian
### Indikator trigger
### Trend
### Rekomendasi
### Apakah perlu FPPE?
(jawab "Dipertimbangkan perlu" / "Belum diperlukan" beserta alasan, dan tegaskan keputusan oleh Komite Medik)`;

type Row = Record<string, any>;

const PERIOD: Record<string, string> = { semester_1: 'Semester I', semester_2: 'Semester II', tahunan: 'Tahunan', custom: 'Custom' };
const STATUS: Record<string, string> = { met: 'Memenuhi', attention: 'Perlu perhatian', trigger: 'TRIGGER', no_data: 'Belum ada data' };

export function buildOppeAnalysisPrompt(p: { evaluation: Row; items: Row[]; history: Row[]; fppe: Row[] }): string {
  const e = p.evaluation;
  const cats = Array.isArray(e.category_scores) ? e.category_scores : [];
  const hist = [...p.history]
    .filter((h) => h.final_score !== null)
    .sort((a, b) => a.year * 10 + (a.period_type === 'semester_2' ? 2 : 1) - (b.year * 10 + (b.period_type === 'semester_2' ? 2 : 1)));
  const lines: string[] = [];
  lines.push(`DOKTER: ${e.oppe_doctors?.name ?? '-'}${e.oppe_doctors?.title ? ', ' + e.oppe_doctors.title : ''} | Profesi: ${e.profession ?? '-'} | KSM: ${e.oppe_ksm?.name ?? '-'}`);
  lines.push(`PERIODE: ${PERIOD[e.period_type] ?? e.period_type} ${e.year} | Status evaluasi: ${e.status}`);
  lines.push('');
  lines.push('SKOR KATEGORI:');
  for (const c of cats) lines.push(`- ${c.code}. ${c.name}: skor ${c.score ?? '-'} × bobot ${c.weight}% = ${c.weighted ?? '-'}`);
  lines.push(`SKOR AKHIR: ${e.final_score ?? '-'} | KATEGORI: ${e.final_category_label ?? '-'} | Trigger: ${e.trigger_count} (kritis: ${e.critical_trigger_count})`);
  lines.push(`Skor periode sebelumnya: ${e.previous_score ?? '-'} | Trend sistem: ${e.trend ?? '-'}`);
  lines.push('');
  lines.push('DETAIL INDIKATOR (kode | kategori | parameter | target | realisasi | trigger | status | kritis):');
  for (const i of p.items) {
    lines.push(`- ${i.code ?? '-'} | ${i.category_code} | ${i.name} | ${i.target_text ?? '-'} | ${i.realization_text ?? '-'}${i.unit_label && i.unit_label !== 'kategori' ? ' ' + i.unit_label : ''} | ${i.trigger_text ?? '-'} | ${STATUS[i.status] ?? i.status} | ${i.is_critical ? 'KRITIS' : '-'}`);
  }
  lines.push('');
  lines.push('HISTORI SKOR OPPE:');
  if (hist.length === 0) lines.push('- (tidak ada)');
  for (const h of hist) lines.push(`- ${PERIOD[h.period_type] ?? h.period_type} ${h.year}: ${h.final_score} (${h.final_category_label ?? '-'}), trigger ${h.trigger_count}${h.critical_indicators ? `, kritis: ${h.critical_indicators}` : ''}`);
  lines.push('');
  lines.push('RIWAYAT FPPE:');
  if (p.fppe.length === 0) lines.push('- (tidak ada)');
  for (const f of p.fppe) lines.push(`- ${f.fppe_number ?? '-'}: ${f.trigger_indicator_name ?? f.reason ?? '-'} — status ${f.status}${f.result ? `, hasil: ${String(f.result).slice(0, 200)}` : ''}`);
  lines.push('');
  lines.push(`REKOMENDASI OTOMATIS SISTEM (berbasis aturan): ${String(e.recommendation ?? '-').replace(/\n/g, ' ')}`);
  lines.push('');
  lines.push('Buat analisis sesuai format. Ingat: Anda hanya decision support.');
  return lines.join('\n').slice(0, 30000);
}
