/**
 * ImportConfig — "IMUT Prioritas" (Indikator Prioritas RS), penamaan sesuai
 * MASTER PROMPT (Template_IMUT_Prioritas.xlsx). Dibatasi ke
 * indicator_type = 'priority_rs'. Lihat customIndicator.ts untuk
 * implementasi penuh & imutUnit.ts untuk pasangannya.
 */
import { buildCustomIndicatorImportConfigForKind } from './customIndicator';

export const imutPrioritasImportConfig = buildCustomIndicatorImportConfigForKind('priority_rs');
