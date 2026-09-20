/**
 * ImportConfig — "IMUT Unit" (Indikator Mutu Unit), penamaan sesuai MASTER
 * PROMPT (Template_IMUT_Unit.xlsx). Di aplikasi ini indikator Unit hidup di
 * tabel/RPC yang sama dengan Master Indikator Mutu Custom
 * (custom_indicator_measurements / custom_indicator_import_batch) — hanya
 * dibatasi ke indicator_type = 'unit' lewat resolveReference. Lihat
 * customIndicator.ts untuk implementasi penuh.
 */
import { buildCustomIndicatorImportConfigForKind } from './customIndicator';

export const imutUnitImportConfig = buildCustomIndicatorImportConfigForKind('unit');
