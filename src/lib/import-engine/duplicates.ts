/**
 * Deteksi duplikasi (MASTER PROMPT bagian 13).
 */
import type { ImportConfig, ImportRowResult, MappedRow } from './types';

export function buildDedupeKey(mapped: MappedRow, uniqueKeys: string[]): string {
  return uniqueKeys
    .map((k) => String(mapped[k] ?? '').trim().toLowerCase())
    .join('|');
}

export function applyDuplicateStatus(
  results: ImportRowResult[],
  existingKeys: Set<string>,
  config: ImportConfig
): void {
  if (config.uniqueKeys.length === 0) return; // modul tanpa kunci alami (mis. Survei Kepuasan) — setiap baris selalu data baru.

  for (const r of results) {
    if (r.status === 'error') continue;
    const key = buildDedupeKey(r.mapped, config.uniqueKeys);
    r.dedupeKey = key;
    if (key && existingKeys.has(key)) {
      r.status = 'duplicate';
      r.duplicateAction = config.defaultDuplicateAction ?? 'skip';
    }
  }

  // Duplikasi ANTAR baris di file yang sama (bukan hanya vs database).
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status === 'error' || !r.dedupeKey) continue;
    if (seen.has(r.dedupeKey)) {
      if (r.status !== 'duplicate') {
        r.status = 'duplicate';
        r.duplicateAction = config.defaultDuplicateAction ?? 'skip';
      }
    } else {
      seen.add(r.dedupeKey);
    }
  }
}
