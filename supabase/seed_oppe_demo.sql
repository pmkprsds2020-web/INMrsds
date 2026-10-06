-- ============================================================================
-- INMrsds — DATA DEMO MODUL OPPE (OPSIONAL, BUKAN DATA PRODUKSI)
-- 10 dokter fiktif (dr. Andi ... dr. Joko) + evaluasi multi-periode + FPPE.
-- Semua baris ditandai is_demo = true dan nomor SIP/STR berawalan "DEMO".
-- Dihasilkan otomatis memakai engine OPPE yang sama dengan aplikasi
-- (src/lib/oppeScoring.ts) dengan pengaturan default.
-- Jalankan SETELAH supabase/migration_oppe.sql. Aman diulang (ON CONFLICT).
--
-- Menghapus data demo:
--   delete from public.oppe_fppe where is_demo;
--   delete from public.oppe_evaluations where is_demo;   -- item ikut terhapus (cascade)
--   delete from public.oppe_doctors where is_demo;
-- (oppe_audit_logs tidak dihapus — memang permanen.)
-- ============================================================================

insert into public.oppe_doctors (id, name, title, profession, specialty, ksm_id, str_number, sip_number, status, practice_start_date, notes, is_demo) values
  ('242a4cc1-0b50-4a56-8ca6-31c09f343ff2', 'dr. Andi', 'Sp.An', 'Dokter Spesialis', 'Anestesiologi dan Terapi Intensif (Sp.An)', (select id from public.oppe_ksm where code = 'ANS'), 'DEMO-STR-1000', 'DEMO/SIP/001/2026', 'aktif', '2015-01-01', 'DATA DEMO — bukan dokter sebenarnya', true),
  ('cfe7d674-d09d-4ff3-a6dd-e4df747687e0', 'dr. Budi', 'Sp.Rad', 'Dokter Spesialis', 'Radiologi (Sp.Rad)', (select id from public.oppe_ksm where code = 'RAD'), 'DEMO-STR-1001', 'DEMO/SIP/002/2026', 'aktif', '2016-02-01', 'DATA DEMO — bukan dokter sebenarnya', true),
  ('5982cb4c-4402-43f4-bad6-0e5596ec069d', 'dr. Citra', 'Sp.M', 'Dokter Spesialis', 'Mata (Sp.M)', (select id from public.oppe_ksm where code = 'MTA'), 'DEMO-STR-1002', 'DEMO/SIP/003/2026', 'aktif', '2017-03-01', 'DATA DEMO — bukan dokter sebenarnya', true),
  ('ad7335f5-92ae-4276-95b6-0a6642bb52f6', 'dr. Dedi', 'Sp.THT-BKL', 'Dokter Spesialis', 'THT-BKL (Sp.THT-BKL)', (select id from public.oppe_ksm where code = 'THT'), 'DEMO-STR-1003', 'DEMO/SIP/004/2026', 'aktif', '2018-04-01', 'DATA DEMO — bukan dokter sebenarnya', true),
  ('a46b5edb-5761-4aec-a153-03750183986a', 'dr. Eka', 'Sp.KFR', 'Dokter Spesialis', 'Kedokteran Fisik dan Rehabilitasi (Sp.KFR)', (select id from public.oppe_ksm where code = 'KFR'), 'DEMO-STR-1004', 'DEMO/SIP/005/2026', 'aktif', '2019-05-01', 'DATA DEMO — bukan dokter sebenarnya', true),
  ('bca74dce-cf7e-480c-9e35-87a12b4f2fd8', 'dr. Fajar', 'Sp.PK', 'Dokter Spesialis', 'Patologi Klinik (Sp.PK)', (select id from public.oppe_ksm where code = 'PK'), 'DEMO-STR-1005', 'DEMO/SIP/006/2026', 'aktif', '2020-06-01', 'DATA DEMO — bukan dokter sebenarnya', true),
  ('78b88cb0-65b8-4641-a227-db1a1d700ef9', 'drg. Gina', 'drg', 'Dokter Gigi', null, (select id from public.oppe_ksm where code = 'GGM'), 'DEMO-STR-1006', 'DEMO/SIP/007/2026', 'aktif', '2021-07-01', 'DATA DEMO — bukan dokter sebenarnya', true),
  ('94b4465a-4d61-479e-86b4-9354bc404821', 'dr. Hadi', 'dr. Umum', 'Dokter Umum', null, (select id from public.oppe_ksm where code = 'DU'), 'DEMO-STR-1007', 'DEMO/SIP/008/2026', 'aktif', '2022-08-01', 'DATA DEMO — bukan dokter sebenarnya', true),
  ('53de5b34-c7e4-485d-b734-a27fac5abf44', 'dr. Intan', 'Sp.OG', 'Dokter Spesialis', 'Obstetri dan Ginekologi (Sp.OG)', (select id from public.oppe_ksm where code = 'OBG'), 'DEMO-STR-1008', 'DEMO/SIP/009/2026', 'aktif', '2023-09-01', 'DATA DEMO — bukan dokter sebenarnya', true),
  ('5ba4e6d9-e33e-45c3-9b30-9298a1f220d9', 'dr. Joko', 'Sp.PD', 'Dokter Spesialis', 'Penyakit Dalam (Sp.PD)', (select id from public.oppe_ksm where code = 'NBDH'), 'DEMO-STR-1009', 'DEMO/SIP/010/2026', 'aktif', '2024-01-01', 'DATA DEMO — bukan dokter sebenarnya', true)
on conflict (id) do nothing;

-- dr. Andi — semester_1 2025 — finalized (fair) -> skor 69.87 Tidak Memenuhi [FPPE]
insert into public.oppe_evaluations (id, evaluation_number, doctor_id, ksm_id, profession, specialty, template_id, period_type, year, semester,
  evaluator_name, evaluation_date, due_date, status, score_professional, score_development, score_clinical, weighted_score, final_score, category_scores,
  final_category, final_category_label, met_count, attention_count, trigger_count, no_data_count, critical_trigger_count, critical_indicators,
  requires_fppe, trend, previous_score, conclusion, recommendation, reviewed_at, approved_at, finalized_at, is_demo)
values ('e5ac9704-1083-4c1c-a354-03f0a5477cab', 'OPPE-DEMO/2025/0001', '242a4cc1-0b50-4a56-8ca6-31c09f343ff2', (select id from public.oppe_ksm where code = 'ANS'), 'Dokter Spesialis', 'Anestesiologi dan Terapi Intensif (Sp.An)',
  (select id from public.oppe_templates where code = 'ANS'), 'semester_1', 2025, 1,
  'Ketua KSM (Demo)', '2025-07-15', '2025-07-31', 'finalized',
  94, 66.67, 56.67, 69.87, 69.87,
  '[{"categoryId":null,"code":"A","name":"Perilaku Profesional","weight":30,"score":94,"weighted":28.2,"itemCount":5,"metCount":4},{"categoryId":null,"code":"B","name":"Pengembangan Profesional","weight":20,"score":66.67,"weighted":13.33,"itemCount":3,"metCount":2},{"categoryId":null,"code":"C","name":"Kinerja Klinis Spesifik","weight":50,"score":56.67,"weighted":28.34,"itemCount":6,"metCount":2}]'::jsonb,
  'tidak_memenuhi', 'Tidak Memenuhi', 8, 3, 3, 0,
  0, null, true, null, null,
  'Skor akhir OPPE 69,87 (Tidak Memenuhi). 8 indikator memenuhi, 3 perlu perhatian, 3 trigger. Tidak ada indikator kritis yang terkena trigger.', 'Direkomendasikan evaluasi lebih lanjut oleh Komite Medik/Subkomite Mutu Profesi.
Terdapat beberapa indikator yang terkena trigger — dipertimbangkan evaluasi terfokus/FPPE sesuai keputusan Komite Medik.', '2025-07-15 10:00:00+07', '2025-07-15 10:00:00+07', '2025-07-15 10:00:00+07', true)
on conflict (id) do nothing;
insert into public.oppe_evaluation_items (evaluation_id, indicator_id, sequence, category_id, category_code, code, name, data_type, unit_label, target_text,
  target_operator, target_value, trigger_text, trigger_operator, trigger_value, options, pass_values, attention_values, is_critical, weight,
  realization_text, realization_number, achievement, score, weighted_score, status, is_trigger, status_reason, source_data)
select 'e5ac9704-1083-4c1c-a354-03f0a5477cab', i.id, v.seq, i.category_id, v.cat, i.code, i.name, i.data_type, i.unit_label, i.target_text, i.target_operator, v.target_value,
  i.trigger_text, i.trigger_operator, i.trigger_value, i.options, i.pass_values, i.attention_values, i.is_critical, i.weight,
  v.rtext, v.rnum, v.ach, v.score, v.wscore, v.status, v.is_trigger, v.reason, i.source_data
from (values
  ('ANS-A1', 1, 'A', 95::numeric, '92.5', 92.5::numeric, 97.37::numeric, 70::numeric, 21::numeric, 'attention', false, 'Realisasi 92,5 belum mencapai target, belum menyentuh trigger'),
  ('ANS-A2', 2, 'A', 80::numeric, '80', 80::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 80 memenuhi target'),
  ('ANS-A3', 3, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('ANS-A4', 4, 'A', null::numeric, 'Baik', null::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, '"Baik" sesuai target (Baik)'),
  ('ANS-A5', 5, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('ANS-B1', 6, 'B', 50::numeric, '30', 30::numeric, 60::numeric, 0::numeric, 0::numeric, 'trigger', true, 'Realisasi 30 menyentuh batas trigger'),
  ('ANS-B2', 7, 'B', null::numeric, 'Aktif', null::numeric, 100::numeric, 100::numeric, 20::numeric, 'met', false, '"Aktif" sesuai target (Aktif)'),
  ('ANS-B3', 8, 'B', null::numeric, 'Lulus', null::numeric, 100::numeric, 100::numeric, 20::numeric, 'met', false, '"Lulus" sesuai target (Lulus)'),
  ('ANS-C1', 9, 'C', 100::numeric, '97.5', 97.5::numeric, 97.5::numeric, 70::numeric, 35::numeric, 'attention', false, 'Realisasi 97,5 belum mencapai target, belum menyentuh trigger'),
  ('ANS-C2', 10, 'C', 100::numeric, '96', 96::numeric, 96::numeric, 0::numeric, 0::numeric, 'trigger', true, 'Realisasi 96 menyentuh batas trigger'),
  ('ANS-C3', 11, 'C', 1::numeric, '1.3', 1.3::numeric, 76.92::numeric, 70::numeric, 35::numeric, 'attention', false, 'Realisasi 1,3 belum mencapai target, belum menyentuh trigger'),
  ('ANS-C4', 12, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('ANS-C5', 13, 'C', 100::numeric, '91', 91::numeric, 91::numeric, 0::numeric, 0::numeric, 'trigger', true, 'Realisasi 91 menyentuh batas trigger'),
  ('ANS-C6', 14, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target')
) as v(icode, seq, cat, target_value, rtext, rnum, ach, score, wscore, status, is_trigger, reason)
join public.oppe_indicators i on i.code = v.icode
on conflict (evaluation_id, indicator_id) where indicator_id is not null do nothing;

-- dr. Andi — semester_2 2025 — finalized (good) -> skor 89.7 Baik
insert into public.oppe_evaluations (id, evaluation_number, doctor_id, ksm_id, profession, specialty, template_id, period_type, year, semester,
  evaluator_name, evaluation_date, due_date, status, score_professional, score_development, score_clinical, weighted_score, final_score, category_scores,
  final_category, final_category_label, met_count, attention_count, trigger_count, no_data_count, critical_trigger_count, critical_indicators,
  requires_fppe, trend, previous_score, conclusion, recommendation, reviewed_at, approved_at, finalized_at, is_demo)
values ('3c40845d-18bc-4d3c-9717-f91840df0336', 'OPPE-DEMO/2025/0002', '242a4cc1-0b50-4a56-8ca6-31c09f343ff2', (select id from public.oppe_ksm where code = 'ANS'), 'Dokter Spesialis', 'Anestesiologi dan Terapi Intensif (Sp.An)',
  (select id from public.oppe_templates where code = 'ANS'), 'semester_2', 2025, 2,
  'Ketua KSM (Demo)', '2025-12-20', '2025-12-31', 'finalized',
  74, 100, 95, 89.7, 89.7,
  '[{"categoryId":null,"code":"A","name":"Perilaku Profesional","weight":30,"score":74,"weighted":22.2,"itemCount":5,"metCount":3},{"categoryId":null,"code":"B","name":"Pengembangan Profesional","weight":20,"score":100,"weighted":20,"itemCount":3,"metCount":3},{"categoryId":null,"code":"C","name":"Kinerja Klinis Spesifik","weight":50,"score":95,"weighted":47.5,"itemCount":6,"metCount":5}]'::jsonb,
  'baik', 'Baik', 11, 2, 1, 0,
  0, null, false, 'naik', 69.87,
  'Skor akhir OPPE 89,7 (Baik). 11 indikator memenuhi, 2 perlu perhatian, 1 trigger. Tidak ada indikator kritis yang terkena trigger. Trend dibanding periode sebelumnya: naik.', 'Direkomendasikan melanjutkan kewenangan klinis dengan monitoring rutin.
Rencana perbaikan dan pemantauan pada indikator trigger: Komunikasi efektif (Kerjasama tim anestesi-bedah-perawat).
Dokter memiliki riwayat FPPE pada periode sebelumnya — perhatikan kesinambungan tindak lanjut.', '2025-12-20 10:00:00+07', '2025-12-20 10:00:00+07', '2025-12-20 10:00:00+07', true)
on conflict (id) do nothing;
insert into public.oppe_evaluation_items (evaluation_id, indicator_id, sequence, category_id, category_code, code, name, data_type, unit_label, target_text,
  target_operator, target_value, trigger_text, trigger_operator, trigger_value, options, pass_values, attention_values, is_critical, weight,
  realization_text, realization_number, achievement, score, weighted_score, status, is_trigger, status_reason, source_data)
select '3c40845d-18bc-4d3c-9717-f91840df0336', i.id, v.seq, i.category_id, v.cat, i.code, i.name, i.data_type, i.unit_label, i.target_text, i.target_operator, v.target_value,
  i.trigger_text, i.trigger_operator, i.trigger_value, i.options, i.pass_values, i.attention_values, i.is_critical, i.weight,
  v.rtext, v.rnum, v.ach, v.score, v.wscore, v.status, v.is_trigger, v.reason, i.source_data
from (values
  ('ANS-A1', 1, 'A', 95::numeric, '92.5', 92.5::numeric, 97.37::numeric, 70::numeric, 21::numeric, 'attention', false, 'Realisasi 92,5 belum mencapai target, belum menyentuh trigger'),
  ('ANS-A2', 2, 'A', 80::numeric, '82', 82::numeric, 102.5::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 82 memenuhi target'),
  ('ANS-A3', 3, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('ANS-A4', 4, 'A', null::numeric, 'Kurang', null::numeric, 0::numeric, 0::numeric, 0::numeric, 'trigger', true, '"Kurang" tidak sesuai target (Baik)'),
  ('ANS-A5', 5, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('ANS-B1', 6, 'B', 50::numeric, '62', 62::numeric, 124::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 62 memenuhi target'),
  ('ANS-B2', 7, 'B', null::numeric, 'Aktif', null::numeric, 100::numeric, 100::numeric, 20::numeric, 'met', false, '"Aktif" sesuai target (Aktif)'),
  ('ANS-B3', 8, 'B', null::numeric, 'Lulus', null::numeric, 100::numeric, 100::numeric, 20::numeric, 'met', false, '"Lulus" sesuai target (Lulus)'),
  ('ANS-C1', 9, 'C', 100::numeric, '97.5', 97.5::numeric, 97.5::numeric, 70::numeric, 35::numeric, 'attention', false, 'Realisasi 97,5 belum mencapai target, belum menyentuh trigger'),
  ('ANS-C2', 10, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('ANS-C3', 11, 'C', 1::numeric, '0.5', 0.5::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0,5 memenuhi target'),
  ('ANS-C4', 12, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('ANS-C5', 13, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('ANS-C6', 14, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target')
) as v(icode, seq, cat, target_value, rtext, rnum, ach, score, wscore, status, is_trigger, reason)
join public.oppe_indicators i on i.code = v.icode
on conflict (evaluation_id, indicator_id) where indicator_id is not null do nothing;

-- dr. Andi — semester_1 2026 — finalized (critical) -> skor 91.67 Sangat Baik [FPPE]
insert into public.oppe_evaluations (id, evaluation_number, doctor_id, ksm_id, profession, specialty, template_id, period_type, year, semester,
  evaluator_name, evaluation_date, due_date, status, score_professional, score_development, score_clinical, weighted_score, final_score, category_scores,
  final_category, final_category_label, met_count, attention_count, trigger_count, no_data_count, critical_trigger_count, critical_indicators,
  requires_fppe, trend, previous_score, conclusion, recommendation, reviewed_at, approved_at, finalized_at, is_demo)
values ('8c2d6f80-924d-44f6-854c-08570b27e53d', 'OPPE-DEMO/2026/0003', '242a4cc1-0b50-4a56-8ca6-31c09f343ff2', (select id from public.oppe_ksm where code = 'ANS'), 'Dokter Spesialis', 'Anestesiologi dan Terapi Intensif (Sp.An)',
  (select id from public.oppe_templates where code = 'ANS'), 'semester_1', 2026, 1,
  'Ketua KSM (Demo)', '2026-07-15', '2026-07-31', 'finalized',
  100, 100, 83.33, 91.67, 91.67,
  '[{"categoryId":null,"code":"A","name":"Perilaku Profesional","weight":30,"score":100,"weighted":30,"itemCount":5,"metCount":5},{"categoryId":null,"code":"B","name":"Pengembangan Profesional","weight":20,"score":100,"weighted":20,"itemCount":3,"metCount":3},{"categoryId":null,"code":"C","name":"Kinerja Klinis Spesifik","weight":50,"score":83.33,"weighted":41.67,"itemCount":6,"metCount":5}]'::jsonb,
  'sangat_baik', 'Sangat Baik', 13, 0, 1, 0,
  1, 'Kejadian henti jantung peri-anestesi (Perioperative Cardiac Arrest)', true, 'stabil', 89.7,
  'Skor akhir OPPE 91,67 (Sangat Baik). 13 indikator memenuhi, 0 perlu perhatian, 1 trigger. Indikator kritis terkena trigger: Kejadian henti jantung peri-anestesi (Perioperative Cardiac Arrest). Trend dibanding periode sebelumnya: stabil.', 'Direkomendasikan mempertahankan kewenangan klinis dan melanjutkan monitoring OPPE rutin.
Terdapat indikator kritis yang terkena trigger (Kejadian henti jantung peri-anestesi (Perioperative Cardiac Arrest)). Direkomendasikan evaluasi terfokus/FPPE berdasarkan hasil indikator kritis. Keputusan akhir sesuai Komite Medik.', '2026-07-15 10:00:00+07', '2026-07-15 10:00:00+07', '2026-07-15 10:00:00+07', true)
on conflict (id) do nothing;
insert into public.oppe_evaluation_items (evaluation_id, indicator_id, sequence, category_id, category_code, code, name, data_type, unit_label, target_text,
  target_operator, target_value, trigger_text, trigger_operator, trigger_value, options, pass_values, attention_values, is_critical, weight,
  realization_text, realization_number, achievement, score, weighted_score, status, is_trigger, status_reason, source_data)
select '8c2d6f80-924d-44f6-854c-08570b27e53d', i.id, v.seq, i.category_id, v.cat, i.code, i.name, i.data_type, i.unit_label, i.target_text, i.target_operator, v.target_value,
  i.trigger_text, i.trigger_operator, i.trigger_value, i.options, i.pass_values, i.attention_values, i.is_critical, i.weight,
  v.rtext, v.rnum, v.ach, v.score, v.wscore, v.status, v.is_trigger, v.reason, i.source_data
from (values
  ('ANS-A1', 1, 'A', 95::numeric, '97', 97::numeric, 102.11::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 97 memenuhi target'),
  ('ANS-A2', 2, 'A', 80::numeric, '82', 82::numeric, 102.5::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 82 memenuhi target'),
  ('ANS-A3', 3, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('ANS-A4', 4, 'A', null::numeric, 'Baik', null::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, '"Baik" sesuai target (Baik)'),
  ('ANS-A5', 5, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('ANS-B1', 6, 'B', 50::numeric, '62', 62::numeric, 124::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 62 memenuhi target'),
  ('ANS-B2', 7, 'B', null::numeric, 'Aktif', null::numeric, 100::numeric, 100::numeric, 20::numeric, 'met', false, '"Aktif" sesuai target (Aktif)'),
  ('ANS-B3', 8, 'B', null::numeric, 'Lulus', null::numeric, 100::numeric, 100::numeric, 20::numeric, 'met', false, '"Lulus" sesuai target (Lulus)'),
  ('ANS-C1', 9, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('ANS-C2', 10, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('ANS-C3', 11, 'C', 1::numeric, '0.5', 0.5::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0,5 memenuhi target'),
  ('ANS-C4', 12, 'C', 0::numeric, '1', 1::numeric, 0::numeric, 0::numeric, 0::numeric, 'trigger', true, 'Realisasi 1 menyentuh batas trigger'),
  ('ANS-C5', 13, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('ANS-C6', 14, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target')
) as v(icode, seq, cat, target_value, rtext, rnum, ach, score, wscore, status, is_trigger, reason)
join public.oppe_indicators i on i.code = v.icode
on conflict (evaluation_id, indicator_id) where indicator_id is not null do nothing;

-- dr. Budi — semester_2 2025 — finalized (good) -> skor 92.2 Sangat Baik
insert into public.oppe_evaluations (id, evaluation_number, doctor_id, ksm_id, profession, specialty, template_id, period_type, year, semester,
  evaluator_name, evaluation_date, due_date, status, score_professional, score_development, score_clinical, weighted_score, final_score, category_scores,
  final_category, final_category_label, met_count, attention_count, trigger_count, no_data_count, critical_trigger_count, critical_indicators,
  requires_fppe, trend, previous_score, conclusion, recommendation, reviewed_at, approved_at, finalized_at, is_demo)
values ('3b74c9f3-59b4-488b-b5e5-7848a0784cb5', 'OPPE-DEMO/2025/0004', 'cfe7d674-d09d-4ff3-a6dd-e4df747687e0', (select id from public.oppe_ksm where code = 'RAD'), 'Dokter Spesialis', 'Radiologi (Sp.Rad)',
  (select id from public.oppe_templates where code = 'RAD'), 'semester_2', 2025, 2,
  'Ketua KSM (Demo)', '2025-12-20', '2025-12-31', 'finalized',
  74, 100, 100, 92.2, 92.2,
  '[{"categoryId":null,"code":"A","name":"Perilaku Profesional","weight":30,"score":74,"weighted":22.2,"itemCount":5,"metCount":3},{"categoryId":null,"code":"B","name":"Pengembangan Profesional","weight":20,"score":100,"weighted":20,"itemCount":3,"metCount":3},{"categoryId":null,"code":"C","name":"Kinerja Klinis Spesifik","weight":50,"score":100,"weighted":50,"itemCount":6,"metCount":6}]'::jsonb,
  'sangat_baik', 'Sangat Baik', 12, 1, 1, 0,
  0, null, false, null, null,
  'Skor akhir OPPE 92,2 (Sangat Baik). 12 indikator memenuhi, 1 perlu perhatian, 1 trigger. Tidak ada indikator kritis yang terkena trigger.', 'Direkomendasikan mempertahankan kewenangan klinis dan melanjutkan monitoring OPPE rutin.
Rencana perbaikan dan pemantauan pada indikator trigger: Kerjasama dan koordinasi yang baik dengan Radiografer & Fisikawan Medis.', '2025-12-20 10:00:00+07', '2025-12-20 10:00:00+07', '2025-12-20 10:00:00+07', true)
on conflict (id) do nothing;
insert into public.oppe_evaluation_items (evaluation_id, indicator_id, sequence, category_id, category_code, code, name, data_type, unit_label, target_text,
  target_operator, target_value, trigger_text, trigger_operator, trigger_value, options, pass_values, attention_values, is_critical, weight,
  realization_text, realization_number, achievement, score, weighted_score, status, is_trigger, status_reason, source_data)
select '3b74c9f3-59b4-488b-b5e5-7848a0784cb5', i.id, v.seq, i.category_id, v.cat, i.code, i.name, i.data_type, i.unit_label, i.target_text, i.target_operator, v.target_value,
  i.trigger_text, i.trigger_operator, i.trigger_value, i.options, i.pass_values, i.attention_values, i.is_critical, i.weight,
  v.rtext, v.rnum, v.ach, v.score, v.wscore, v.status, v.is_trigger, v.reason, i.source_data
from (values
  ('RAD-A1', 1, 'A', 95::numeric, '92.5', 92.5::numeric, 97.37::numeric, 70::numeric, 21::numeric, 'attention', false, 'Realisasi 92,5 belum mencapai target, belum menyentuh trigger'),
  ('RAD-A2', 2, 'A', 80::numeric, '82', 82::numeric, 102.5::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 82 memenuhi target'),
  ('RAD-A3', 3, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('RAD-A4', 4, 'A', null::numeric, 'Kurang', null::numeric, 0::numeric, 0::numeric, 0::numeric, 'trigger', true, '"Kurang" tidak sesuai target (Baik)'),
  ('RAD-A5', 5, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('RAD-B1', 6, 'B', 50::numeric, '62', 62::numeric, 124::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 62 memenuhi target'),
  ('RAD-B2', 7, 'B', null::numeric, 'Lulus', null::numeric, 100::numeric, 100::numeric, 20::numeric, 'met', false, '"Lulus" sesuai target (Lulus)'),
  ('RAD-B3', 8, 'B', 1::numeric, '2', 2::numeric, 200::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 2 memenuhi target'),
  ('RAD-C1', 9, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('RAD-C2', 10, 'C', 90::numeric, '92', 92::numeric, 102.22::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 92 memenuhi target'),
  ('RAD-C3', 11, 'C', 5::numeric, '2.5', 2.5::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 2,5 memenuhi target'),
  ('RAD-C4', 12, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('RAD-C5', 13, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('RAD-C6', 14, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target')
) as v(icode, seq, cat, target_value, rtext, rnum, ach, score, wscore, status, is_trigger, reason)
join public.oppe_indicators i on i.code = v.icode
on conflict (evaluation_id, indicator_id) where indicator_id is not null do nothing;

-- dr. Budi — semester_1 2026 — approved (excellent) -> skor 97.5 Sangat Baik
insert into public.oppe_evaluations (id, evaluation_number, doctor_id, ksm_id, profession, specialty, template_id, period_type, year, semester,
  evaluator_name, evaluation_date, due_date, status, score_professional, score_development, score_clinical, weighted_score, final_score, category_scores,
  final_category, final_category_label, met_count, attention_count, trigger_count, no_data_count, critical_trigger_count, critical_indicators,
  requires_fppe, trend, previous_score, conclusion, recommendation, reviewed_at, approved_at, finalized_at, is_demo)
values ('a1dd6ae2-a8d2-4c27-9c0e-117676f09832', 'OPPE-DEMO/2026/0005', 'cfe7d674-d09d-4ff3-a6dd-e4df747687e0', (select id from public.oppe_ksm where code = 'RAD'), 'Dokter Spesialis', 'Radiologi (Sp.Rad)',
  (select id from public.oppe_templates where code = 'RAD'), 'semester_1', 2026, 1,
  'Ketua KSM (Demo)', '2026-07-15', '2026-07-31', 'approved',
  100, 100, 95, 97.5, 97.5,
  '[{"categoryId":null,"code":"A","name":"Perilaku Profesional","weight":30,"score":100,"weighted":30,"itemCount":5,"metCount":5},{"categoryId":null,"code":"B","name":"Pengembangan Profesional","weight":20,"score":100,"weighted":20,"itemCount":3,"metCount":3},{"categoryId":null,"code":"C","name":"Kinerja Klinis Spesifik","weight":50,"score":95,"weighted":47.5,"itemCount":6,"metCount":5}]'::jsonb,
  'sangat_baik', 'Sangat Baik', 13, 1, 0, 0,
  0, null, false, 'naik', 92.2,
  'Skor akhir OPPE 97,5 (Sangat Baik). 13 indikator memenuhi, 1 perlu perhatian, 0 trigger. Tidak ada indikator kritis yang terkena trigger. Trend dibanding periode sebelumnya: naik.', 'Direkomendasikan mempertahankan kewenangan klinis dan melanjutkan monitoring OPPE rutin.', '2026-07-15 10:00:00+07', '2026-07-15 10:00:00+07', null, true)
on conflict (id) do nothing;
insert into public.oppe_evaluation_items (evaluation_id, indicator_id, sequence, category_id, category_code, code, name, data_type, unit_label, target_text,
  target_operator, target_value, trigger_text, trigger_operator, trigger_value, options, pass_values, attention_values, is_critical, weight,
  realization_text, realization_number, achievement, score, weighted_score, status, is_trigger, status_reason, source_data)
select 'a1dd6ae2-a8d2-4c27-9c0e-117676f09832', i.id, v.seq, i.category_id, v.cat, i.code, i.name, i.data_type, i.unit_label, i.target_text, i.target_operator, v.target_value,
  i.trigger_text, i.trigger_operator, i.trigger_value, i.options, i.pass_values, i.attention_values, i.is_critical, i.weight,
  v.rtext, v.rnum, v.ach, v.score, v.wscore, v.status, v.is_trigger, v.reason, i.source_data
from (values
  ('RAD-A1', 1, 'A', 95::numeric, '97', 97::numeric, 102.11::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 97 memenuhi target'),
  ('RAD-A2', 2, 'A', 80::numeric, '82', 82::numeric, 102.5::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 82 memenuhi target'),
  ('RAD-A3', 3, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('RAD-A4', 4, 'A', null::numeric, 'Baik', null::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, '"Baik" sesuai target (Baik)'),
  ('RAD-A5', 5, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('RAD-B1', 6, 'B', 50::numeric, '62', 62::numeric, 124::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 62 memenuhi target'),
  ('RAD-B2', 7, 'B', null::numeric, 'Lulus', null::numeric, 100::numeric, 100::numeric, 20::numeric, 'met', false, '"Lulus" sesuai target (Lulus)'),
  ('RAD-B3', 8, 'B', 1::numeric, '2', 2::numeric, 200::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 2 memenuhi target'),
  ('RAD-C1', 9, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('RAD-C2', 10, 'C', 90::numeric, '87.5', 87.5::numeric, 97.22::numeric, 70::numeric, 35::numeric, 'attention', false, 'Realisasi 87,5 belum mencapai target, belum menyentuh trigger'),
  ('RAD-C3', 11, 'C', 5::numeric, '2.5', 2.5::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 2,5 memenuhi target'),
  ('RAD-C4', 12, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('RAD-C5', 13, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('RAD-C6', 14, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target')
) as v(icode, seq, cat, target_value, rtext, rnum, ach, score, wscore, status, is_trigger, reason)
join public.oppe_indicators i on i.code = v.icode
on conflict (evaluation_id, indicator_id) where indicator_id is not null do nothing;

-- dr. Citra — semester_2 2025 — finalized (excellent) -> skor 100 Sangat Baik
insert into public.oppe_evaluations (id, evaluation_number, doctor_id, ksm_id, profession, specialty, template_id, period_type, year, semester,
  evaluator_name, evaluation_date, due_date, status, score_professional, score_development, score_clinical, weighted_score, final_score, category_scores,
  final_category, final_category_label, met_count, attention_count, trigger_count, no_data_count, critical_trigger_count, critical_indicators,
  requires_fppe, trend, previous_score, conclusion, recommendation, reviewed_at, approved_at, finalized_at, is_demo)
values ('f34bd555-1064-4ac7-86e6-b26be1561af1', 'OPPE-DEMO/2025/0006', '5982cb4c-4402-43f4-bad6-0e5596ec069d', (select id from public.oppe_ksm where code = 'MTA'), 'Dokter Spesialis', 'Mata (Sp.M)',
  (select id from public.oppe_templates where code = 'MTA'), 'semester_2', 2025, 2,
  'Ketua KSM (Demo)', '2025-12-20', '2025-12-31', 'finalized',
  100, 100, 100, 100, 100,
  '[{"categoryId":null,"code":"A","name":"Perilaku Profesional","weight":30,"score":100,"weighted":30,"itemCount":5,"metCount":5},{"categoryId":null,"code":"B","name":"Pengembangan Profesional","weight":20,"score":100,"weighted":20,"itemCount":3,"metCount":3},{"categoryId":null,"code":"C","name":"Kinerja Klinis Spesifik","weight":50,"score":100,"weighted":50,"itemCount":6,"metCount":6}]'::jsonb,
  'sangat_baik', 'Sangat Baik', 14, 0, 0, 0,
  0, null, false, null, null,
  'Skor akhir OPPE 100 (Sangat Baik). 14 indikator memenuhi, 0 perlu perhatian, 0 trigger. Tidak ada indikator kritis yang terkena trigger.', 'Direkomendasikan mempertahankan kewenangan klinis dan melanjutkan monitoring OPPE rutin.', '2025-12-20 10:00:00+07', '2025-12-20 10:00:00+07', '2025-12-20 10:00:00+07', true)
on conflict (id) do nothing;
insert into public.oppe_evaluation_items (evaluation_id, indicator_id, sequence, category_id, category_code, code, name, data_type, unit_label, target_text,
  target_operator, target_value, trigger_text, trigger_operator, trigger_value, options, pass_values, attention_values, is_critical, weight,
  realization_text, realization_number, achievement, score, weighted_score, status, is_trigger, status_reason, source_data)
select 'f34bd555-1064-4ac7-86e6-b26be1561af1', i.id, v.seq, i.category_id, v.cat, i.code, i.name, i.data_type, i.unit_label, i.target_text, i.target_operator, v.target_value,
  i.trigger_text, i.trigger_operator, i.trigger_value, i.options, i.pass_values, i.attention_values, i.is_critical, i.weight,
  v.rtext, v.rnum, v.ach, v.score, v.wscore, v.status, v.is_trigger, v.reason, i.source_data
from (values
  ('MTA-A1', 1, 'A', 95::numeric, '97', 97::numeric, 102.11::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 97 memenuhi target'),
  ('MTA-A2', 2, 'A', 80::numeric, '82', 82::numeric, 102.5::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 82 memenuhi target'),
  ('MTA-A3', 3, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('MTA-A4', 4, 'A', null::numeric, 'Baik', null::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, '"Baik" sesuai target (Baik)'),
  ('MTA-A5', 5, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('MTA-B1', 6, 'B', 50::numeric, '62', 62::numeric, 124::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 62 memenuhi target'),
  ('MTA-B2', 7, 'B', null::numeric, 'Lulus', null::numeric, 100::numeric, 100::numeric, 20::numeric, 'met', false, '"Lulus" sesuai target (Lulus)'),
  ('MTA-B3', 8, 'B', 1::numeric, '2', 2::numeric, 200::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 2 memenuhi target'),
  ('MTA-C1', 9, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('MTA-C2', 10, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('MTA-C3', 11, 'C', 5::numeric, '2.5', 2.5::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 2,5 memenuhi target'),
  ('MTA-C4', 12, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('MTA-C5', 13, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('MTA-C6', 14, 'C', 85::numeric, '87', 87::numeric, 102.35::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 87 memenuhi target')
) as v(icode, seq, cat, target_value, rtext, rnum, ach, score, wscore, status, is_trigger, reason)
join public.oppe_indicators i on i.code = v.icode
on conflict (evaluation_id, indicator_id) where indicator_id is not null do nothing;

-- dr. Citra — semester_1 2026 — reviewed (excellent) -> skor 100 Sangat Baik
insert into public.oppe_evaluations (id, evaluation_number, doctor_id, ksm_id, profession, specialty, template_id, period_type, year, semester,
  evaluator_name, evaluation_date, due_date, status, score_professional, score_development, score_clinical, weighted_score, final_score, category_scores,
  final_category, final_category_label, met_count, attention_count, trigger_count, no_data_count, critical_trigger_count, critical_indicators,
  requires_fppe, trend, previous_score, conclusion, recommendation, reviewed_at, approved_at, finalized_at, is_demo)
values ('45041d71-a298-4ec0-bcb4-05a26ce410ab', 'OPPE-DEMO/2026/0007', '5982cb4c-4402-43f4-bad6-0e5596ec069d', (select id from public.oppe_ksm where code = 'MTA'), 'Dokter Spesialis', 'Mata (Sp.M)',
  (select id from public.oppe_templates where code = 'MTA'), 'semester_1', 2026, 1,
  'Ketua KSM (Demo)', '2026-07-15', '2026-07-31', 'reviewed',
  100, 100, 100, 100, 100,
  '[{"categoryId":null,"code":"A","name":"Perilaku Profesional","weight":30,"score":100,"weighted":30,"itemCount":5,"metCount":5},{"categoryId":null,"code":"B","name":"Pengembangan Profesional","weight":20,"score":100,"weighted":20,"itemCount":3,"metCount":3},{"categoryId":null,"code":"C","name":"Kinerja Klinis Spesifik","weight":50,"score":100,"weighted":50,"itemCount":6,"metCount":6}]'::jsonb,
  'sangat_baik', 'Sangat Baik', 14, 0, 0, 0,
  0, null, false, 'stabil', 100,
  'Skor akhir OPPE 100 (Sangat Baik). 14 indikator memenuhi, 0 perlu perhatian, 0 trigger. Tidak ada indikator kritis yang terkena trigger. Trend dibanding periode sebelumnya: stabil.', 'Direkomendasikan mempertahankan kewenangan klinis dan melanjutkan monitoring OPPE rutin.', '2026-07-15 10:00:00+07', null, null, true)
on conflict (id) do nothing;
insert into public.oppe_evaluation_items (evaluation_id, indicator_id, sequence, category_id, category_code, code, name, data_type, unit_label, target_text,
  target_operator, target_value, trigger_text, trigger_operator, trigger_value, options, pass_values, attention_values, is_critical, weight,
  realization_text, realization_number, achievement, score, weighted_score, status, is_trigger, status_reason, source_data)
select '45041d71-a298-4ec0-bcb4-05a26ce410ab', i.id, v.seq, i.category_id, v.cat, i.code, i.name, i.data_type, i.unit_label, i.target_text, i.target_operator, v.target_value,
  i.trigger_text, i.trigger_operator, i.trigger_value, i.options, i.pass_values, i.attention_values, i.is_critical, i.weight,
  v.rtext, v.rnum, v.ach, v.score, v.wscore, v.status, v.is_trigger, v.reason, i.source_data
from (values
  ('MTA-A1', 1, 'A', 95::numeric, '97', 97::numeric, 102.11::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 97 memenuhi target'),
  ('MTA-A2', 2, 'A', 80::numeric, '82', 82::numeric, 102.5::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 82 memenuhi target'),
  ('MTA-A3', 3, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('MTA-A4', 4, 'A', null::numeric, 'Baik', null::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, '"Baik" sesuai target (Baik)'),
  ('MTA-A5', 5, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('MTA-B1', 6, 'B', 50::numeric, '62', 62::numeric, 124::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 62 memenuhi target'),
  ('MTA-B2', 7, 'B', null::numeric, 'Lulus', null::numeric, 100::numeric, 100::numeric, 20::numeric, 'met', false, '"Lulus" sesuai target (Lulus)'),
  ('MTA-B3', 8, 'B', 1::numeric, '2', 2::numeric, 200::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 2 memenuhi target'),
  ('MTA-C1', 9, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('MTA-C2', 10, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('MTA-C3', 11, 'C', 5::numeric, '2.5', 2.5::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 2,5 memenuhi target'),
  ('MTA-C4', 12, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('MTA-C5', 13, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('MTA-C6', 14, 'C', 85::numeric, '87', 87::numeric, 102.35::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 87 memenuhi target')
) as v(icode, seq, cat, target_value, rtext, rnum, ach, score, wscore, status, is_trigger, reason)
join public.oppe_indicators i on i.code = v.icode
on conflict (evaluation_id, indicator_id) where indicator_id is not null do nothing;

-- dr. Dedi — semester_2 2025 — finalized (good) -> skor 89.7 Baik
insert into public.oppe_evaluations (id, evaluation_number, doctor_id, ksm_id, profession, specialty, template_id, period_type, year, semester,
  evaluator_name, evaluation_date, due_date, status, score_professional, score_development, score_clinical, weighted_score, final_score, category_scores,
  final_category, final_category_label, met_count, attention_count, trigger_count, no_data_count, critical_trigger_count, critical_indicators,
  requires_fppe, trend, previous_score, conclusion, recommendation, reviewed_at, approved_at, finalized_at, is_demo)
values ('82c432c1-7ca4-40bd-82d0-a040b1ba1b68', 'OPPE-DEMO/2025/0008', 'ad7335f5-92ae-4276-95b6-0a6642bb52f6', (select id from public.oppe_ksm where code = 'THT'), 'Dokter Spesialis', 'THT-BKL (Sp.THT-BKL)',
  (select id from public.oppe_templates where code = 'THT'), 'semester_2', 2025, 2,
  'Ketua KSM (Demo)', '2025-12-20', '2025-12-31', 'finalized',
  74, 100, 95, 89.7, 89.7,
  '[{"categoryId":null,"code":"A","name":"Perilaku Profesional","weight":30,"score":74,"weighted":22.2,"itemCount":5,"metCount":3},{"categoryId":null,"code":"B","name":"Pengembangan Profesional","weight":20,"score":100,"weighted":20,"itemCount":3,"metCount":3},{"categoryId":null,"code":"C","name":"Kinerja Klinis Spesifik","weight":50,"score":95,"weighted":47.5,"itemCount":6,"metCount":5}]'::jsonb,
  'baik', 'Baik', 11, 2, 1, 0,
  0, null, false, null, null,
  'Skor akhir OPPE 89,7 (Baik). 11 indikator memenuhi, 2 perlu perhatian, 1 trigger. Tidak ada indikator kritis yang terkena trigger.', 'Direkomendasikan melanjutkan kewenangan klinis dengan monitoring rutin.
Rencana perbaikan dan pemantauan pada indikator trigger: Komunikasi efektif antar-profesi dengan perawat/audiologis.', '2025-12-20 10:00:00+07', '2025-12-20 10:00:00+07', '2025-12-20 10:00:00+07', true)
on conflict (id) do nothing;
insert into public.oppe_evaluation_items (evaluation_id, indicator_id, sequence, category_id, category_code, code, name, data_type, unit_label, target_text,
  target_operator, target_value, trigger_text, trigger_operator, trigger_value, options, pass_values, attention_values, is_critical, weight,
  realization_text, realization_number, achievement, score, weighted_score, status, is_trigger, status_reason, source_data)
select '82c432c1-7ca4-40bd-82d0-a040b1ba1b68', i.id, v.seq, i.category_id, v.cat, i.code, i.name, i.data_type, i.unit_label, i.target_text, i.target_operator, v.target_value,
  i.trigger_text, i.trigger_operator, i.trigger_value, i.options, i.pass_values, i.attention_values, i.is_critical, i.weight,
  v.rtext, v.rnum, v.ach, v.score, v.wscore, v.status, v.is_trigger, v.reason, i.source_data
from (values
  ('THT-A1', 1, 'A', 95::numeric, '92.5', 92.5::numeric, 97.37::numeric, 70::numeric, 21::numeric, 'attention', false, 'Realisasi 92,5 belum mencapai target, belum menyentuh trigger'),
  ('THT-A2', 2, 'A', 80::numeric, '82', 82::numeric, 102.5::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 82 memenuhi target'),
  ('THT-A3', 3, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('THT-A4', 4, 'A', null::numeric, 'Kurang', null::numeric, 0::numeric, 0::numeric, 0::numeric, 'trigger', true, '"Kurang" tidak sesuai target (Baik)'),
  ('THT-A5', 5, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('THT-B1', 6, 'B', 50::numeric, '62', 62::numeric, 124::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 62 memenuhi target'),
  ('THT-B2', 7, 'B', null::numeric, 'Lulus', null::numeric, 100::numeric, 100::numeric, 20::numeric, 'met', false, '"Lulus" sesuai target (Lulus)'),
  ('THT-B3', 8, 'B', 1::numeric, '2', 2::numeric, 200::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 2 memenuhi target'),
  ('THT-C1', 9, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('THT-C2', 10, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('THT-C3', 11, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('THT-C4', 12, 'C', 100::numeric, '97.5', 97.5::numeric, 97.5::numeric, 70::numeric, 35::numeric, 'attention', false, 'Realisasi 97,5 belum mencapai target, belum menyentuh trigger'),
  ('THT-C5', 13, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('THT-C6', 14, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target')
) as v(icode, seq, cat, target_value, rtext, rnum, ach, score, wscore, status, is_trigger, reason)
join public.oppe_indicators i on i.code = v.icode
on conflict (evaluation_id, indicator_id) where indicator_id is not null do nothing;

-- dr. Dedi — semester_1 2026 — submitted (fair) -> skor 74.87 Perlu Perbaikan [FPPE]
insert into public.oppe_evaluations (id, evaluation_number, doctor_id, ksm_id, profession, specialty, template_id, period_type, year, semester,
  evaluator_name, evaluation_date, due_date, status, score_professional, score_development, score_clinical, weighted_score, final_score, category_scores,
  final_category, final_category_label, met_count, attention_count, trigger_count, no_data_count, critical_trigger_count, critical_indicators,
  requires_fppe, trend, previous_score, conclusion, recommendation, reviewed_at, approved_at, finalized_at, is_demo)
values ('8dabd3ed-7a19-4dc1-a003-e2518346df60', 'OPPE-DEMO/2026/0009', 'ad7335f5-92ae-4276-95b6-0a6642bb52f6', (select id from public.oppe_ksm where code = 'THT'), 'Dokter Spesialis', 'THT-BKL (Sp.THT-BKL)',
  (select id from public.oppe_templates where code = 'THT'), 'semester_1', 2026, 1,
  'Ketua KSM (Demo)', '2026-07-15', '2026-07-31', 'submitted',
  94, 66.67, 66.67, 74.87, 74.87,
  '[{"categoryId":null,"code":"A","name":"Perilaku Profesional","weight":30,"score":94,"weighted":28.2,"itemCount":5,"metCount":4},{"categoryId":null,"code":"B","name":"Pengembangan Profesional","weight":20,"score":66.67,"weighted":13.33,"itemCount":3,"metCount":2},{"categoryId":null,"code":"C","name":"Kinerja Klinis Spesifik","weight":50,"score":66.67,"weighted":33.34,"itemCount":6,"metCount":4}]'::jsonb,
  'perlu_perbaikan', 'Perlu Perbaikan', 10, 1, 3, 0,
  1, 'Kejadian perdarahan pasca-operasi tonsilektomi yang membutuhkan intervensi atau re-operasi < 24 jam', true, 'turun', 89.7,
  'Skor akhir OPPE 74,87 (Perlu Perbaikan). 10 indikator memenuhi, 1 perlu perhatian, 3 trigger. Indikator kritis terkena trigger: Kejadian perdarahan pasca-operasi tonsilektomi yang membutuhkan intervensi atau re-operasi < 24 jam. Trend dibanding periode sebelumnya: turun.', 'Direkomendasikan rencana perbaikan dan pemantauan pada indikator yang belum mencapai target.
Terdapat indikator kritis yang terkena trigger (Kejadian perdarahan pasca-operasi tonsilektomi yang membutuhkan intervensi atau re-operasi < 24 jam). Direkomendasikan evaluasi terfokus/FPPE berdasarkan hasil indikator kritis. Keputusan akhir sesuai Komite Medik.
Skor menurun signifikan dibanding periode sebelumnya — perlu ditelusuri penyebabnya bersama Ketua KSM.', null, null, null, true)
on conflict (id) do nothing;
insert into public.oppe_evaluation_items (evaluation_id, indicator_id, sequence, category_id, category_code, code, name, data_type, unit_label, target_text,
  target_operator, target_value, trigger_text, trigger_operator, trigger_value, options, pass_values, attention_values, is_critical, weight,
  realization_text, realization_number, achievement, score, weighted_score, status, is_trigger, status_reason, source_data)
select '8dabd3ed-7a19-4dc1-a003-e2518346df60', i.id, v.seq, i.category_id, v.cat, i.code, i.name, i.data_type, i.unit_label, i.target_text, i.target_operator, v.target_value,
  i.trigger_text, i.trigger_operator, i.trigger_value, i.options, i.pass_values, i.attention_values, i.is_critical, i.weight,
  v.rtext, v.rnum, v.ach, v.score, v.wscore, v.status, v.is_trigger, v.reason, i.source_data
from (values
  ('THT-A1', 1, 'A', 95::numeric, '92.5', 92.5::numeric, 97.37::numeric, 70::numeric, 21::numeric, 'attention', false, 'Realisasi 92,5 belum mencapai target, belum menyentuh trigger'),
  ('THT-A2', 2, 'A', 80::numeric, '80', 80::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 80 memenuhi target'),
  ('THT-A3', 3, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('THT-A4', 4, 'A', null::numeric, 'Baik', null::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, '"Baik" sesuai target (Baik)'),
  ('THT-A5', 5, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('THT-B1', 6, 'B', 50::numeric, '30', 30::numeric, 60::numeric, 0::numeric, 0::numeric, 'trigger', true, 'Realisasi 30 menyentuh batas trigger'),
  ('THT-B2', 7, 'B', null::numeric, 'Lulus', null::numeric, 100::numeric, 100::numeric, 20::numeric, 'met', false, '"Lulus" sesuai target (Lulus)'),
  ('THT-B3', 8, 'B', 1::numeric, '2', 2::numeric, 200::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 2 memenuhi target'),
  ('THT-C1', 9, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('THT-C2', 10, 'C', 0::numeric, '1', 1::numeric, 0::numeric, 0::numeric, 0::numeric, 'trigger', true, 'Realisasi 1 menyentuh batas trigger'),
  ('THT-C3', 11, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('THT-C4', 12, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('THT-C5', 13, 'C', 100::numeric, '91', 91::numeric, 91::numeric, 0::numeric, 0::numeric, 'trigger', true, 'Realisasi 91 menyentuh batas trigger'),
  ('THT-C6', 14, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target')
) as v(icode, seq, cat, target_value, rtext, rnum, ach, score, wscore, status, is_trigger, reason)
join public.oppe_indicators i on i.code = v.icode
on conflict (evaluation_id, indicator_id) where indicator_id is not null do nothing;

-- dr. Eka — semester_2 2025 — finalized (good) -> skor 89.7 Baik
insert into public.oppe_evaluations (id, evaluation_number, doctor_id, ksm_id, profession, specialty, template_id, period_type, year, semester,
  evaluator_name, evaluation_date, due_date, status, score_professional, score_development, score_clinical, weighted_score, final_score, category_scores,
  final_category, final_category_label, met_count, attention_count, trigger_count, no_data_count, critical_trigger_count, critical_indicators,
  requires_fppe, trend, previous_score, conclusion, recommendation, reviewed_at, approved_at, finalized_at, is_demo)
values ('2b73c5dc-b509-49d0-a3b5-19d0b1f25110', 'OPPE-DEMO/2025/0010', 'a46b5edb-5761-4aec-a153-03750183986a', (select id from public.oppe_ksm where code = 'KFR'), 'Dokter Spesialis', 'Kedokteran Fisik dan Rehabilitasi (Sp.KFR)',
  (select id from public.oppe_templates where code = 'KFR'), 'semester_2', 2025, 2,
  'Ketua KSM (Demo)', '2025-12-20', '2025-12-31', 'finalized',
  74, 100, 95, 89.7, 89.7,
  '[{"categoryId":null,"code":"A","name":"Perilaku Profesional","weight":30,"score":74,"weighted":22.2,"itemCount":5,"metCount":3},{"categoryId":null,"code":"B","name":"Pengembangan Profesional","weight":20,"score":100,"weighted":20,"itemCount":3,"metCount":3},{"categoryId":null,"code":"C","name":"Kinerja Klinis Spesifik","weight":50,"score":95,"weighted":47.5,"itemCount":6,"metCount":5}]'::jsonb,
  'baik', 'Baik', 11, 2, 1, 0,
  0, null, false, null, null,
  'Skor akhir OPPE 89,7 (Baik). 11 indikator memenuhi, 2 perlu perhatian, 1 trigger. Tidak ada indikator kritis yang terkena trigger.', 'Direkomendasikan melanjutkan kewenangan klinis dengan monitoring rutin.
Rencana perbaikan dan pemantauan pada indikator trigger: Koordinasi dan kolaborasi tim yang efektif dengan para Terapis.', '2025-12-20 10:00:00+07', '2025-12-20 10:00:00+07', '2025-12-20 10:00:00+07', true)
on conflict (id) do nothing;
insert into public.oppe_evaluation_items (evaluation_id, indicator_id, sequence, category_id, category_code, code, name, data_type, unit_label, target_text,
  target_operator, target_value, trigger_text, trigger_operator, trigger_value, options, pass_values, attention_values, is_critical, weight,
  realization_text, realization_number, achievement, score, weighted_score, status, is_trigger, status_reason, source_data)
select '2b73c5dc-b509-49d0-a3b5-19d0b1f25110', i.id, v.seq, i.category_id, v.cat, i.code, i.name, i.data_type, i.unit_label, i.target_text, i.target_operator, v.target_value,
  i.trigger_text, i.trigger_operator, i.trigger_value, i.options, i.pass_values, i.attention_values, i.is_critical, i.weight,
  v.rtext, v.rnum, v.ach, v.score, v.wscore, v.status, v.is_trigger, v.reason, i.source_data
from (values
  ('KFR-A1', 1, 'A', 95::numeric, '92.5', 92.5::numeric, 97.37::numeric, 70::numeric, 21::numeric, 'attention', false, 'Realisasi 92,5 belum mencapai target, belum menyentuh trigger'),
  ('KFR-A2', 2, 'A', 80::numeric, '82', 82::numeric, 102.5::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 82 memenuhi target'),
  ('KFR-A3', 3, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('KFR-A4', 4, 'A', null::numeric, 'Kurang', null::numeric, 0::numeric, 0::numeric, 0::numeric, 'trigger', true, '"Kurang" tidak sesuai target (Baik)'),
  ('KFR-A5', 5, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('KFR-B1', 6, 'B', 50::numeric, '62', 62::numeric, 124::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 62 memenuhi target'),
  ('KFR-B2', 7, 'B', null::numeric, 'Lulus', null::numeric, 100::numeric, 100::numeric, 20::numeric, 'met', false, '"Lulus" sesuai target (Lulus)'),
  ('KFR-B3', 8, 'B', 1::numeric, '2', 2::numeric, 200::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 2 memenuhi target'),
  ('KFR-C1', 9, 'C', 100::numeric, '97.5', 97.5::numeric, 97.5::numeric, 70::numeric, 35::numeric, 'attention', false, 'Realisasi 97,5 belum mencapai target, belum menyentuh trigger'),
  ('KFR-C2', 10, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('KFR-C3', 11, 'C', 95::numeric, '97', 97::numeric, 102.11::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 97 memenuhi target'),
  ('KFR-C4', 12, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('KFR-C5', 13, 'C', 80::numeric, '82', 82::numeric, 102.5::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 82 memenuhi target'),
  ('KFR-C6', 14, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target')
) as v(icode, seq, cat, target_value, rtext, rnum, ach, score, wscore, status, is_trigger, reason)
join public.oppe_indicators i on i.code = v.icode
on conflict (evaluation_id, indicator_id) where indicator_id is not null do nothing;

-- dr. Eka — semester_1 2026 — finalized (poor) -> skor 53.83 Tidak Memenuhi [FPPE]
insert into public.oppe_evaluations (id, evaluation_number, doctor_id, ksm_id, profession, specialty, template_id, period_type, year, semester,
  evaluator_name, evaluation_date, due_date, status, score_professional, score_development, score_clinical, weighted_score, final_score, category_scores,
  final_category, final_category_label, met_count, attention_count, trigger_count, no_data_count, critical_trigger_count, critical_indicators,
  requires_fppe, trend, previous_score, conclusion, recommendation, reviewed_at, approved_at, finalized_at, is_demo)
values ('1cef9569-f907-4e16-90bd-35346edf9c78', 'OPPE-DEMO/2026/0011', 'a46b5edb-5761-4aec-a153-03750183986a', (select id from public.oppe_ksm where code = 'KFR'), 'Dokter Spesialis', 'Kedokteran Fisik dan Rehabilitasi (Sp.KFR)',
  (select id from public.oppe_templates where code = 'KFR'), 'semester_1', 2026, 1,
  'Ketua KSM (Demo)', '2026-07-15', '2026-07-31', 'finalized',
  60, 66.67, 45, 53.83, 53.83,
  '[{"categoryId":null,"code":"A","name":"Perilaku Profesional","weight":30,"score":60,"weighted":18,"itemCount":5,"metCount":3},{"categoryId":null,"code":"B","name":"Pengembangan Profesional","weight":20,"score":66.67,"weighted":13.33,"itemCount":3,"metCount":2},{"categoryId":null,"code":"C","name":"Kinerja Klinis Spesifik","weight":50,"score":45,"weighted":22.5,"itemCount":6,"metCount":2}]'::jsonb,
  'tidak_memenuhi', 'Tidak Memenuhi', 7, 1, 6, 0,
  0, null, true, 'turun', 89.7,
  'Skor akhir OPPE 53,83 (Tidak Memenuhi). 7 indikator memenuhi, 1 perlu perhatian, 6 trigger. Tidak ada indikator kritis yang terkena trigger. Trend dibanding periode sebelumnya: turun.', 'Direkomendasikan evaluasi lebih lanjut oleh Komite Medik/Subkomite Mutu Profesi.
Terdapat beberapa indikator yang terkena trigger — dipertimbangkan evaluasi terfokus/FPPE sesuai keputusan Komite Medik.
Skor menurun signifikan dibanding periode sebelumnya — perlu ditelusuri penyebabnya bersama Ketua KSM.', '2026-07-15 10:00:00+07', '2026-07-15 10:00:00+07', '2026-07-15 10:00:00+07', true)
on conflict (id) do nothing;
insert into public.oppe_evaluation_items (evaluation_id, indicator_id, sequence, category_id, category_code, code, name, data_type, unit_label, target_text,
  target_operator, target_value, trigger_text, trigger_operator, trigger_value, options, pass_values, attention_values, is_critical, weight,
  realization_text, realization_number, achievement, score, weighted_score, status, is_trigger, status_reason, source_data)
select '1cef9569-f907-4e16-90bd-35346edf9c78', i.id, v.seq, i.category_id, v.cat, i.code, i.name, i.data_type, i.unit_label, i.target_text, i.target_operator, v.target_value,
  i.trigger_text, i.trigger_operator, i.trigger_value, i.options, i.pass_values, i.attention_values, i.is_critical, i.weight,
  v.rtext, v.rnum, v.ach, v.score, v.wscore, v.status, v.is_trigger, v.reason, i.source_data
from (values
  ('KFR-A1', 1, 'A', 95::numeric, '86', 86::numeric, 90.53::numeric, 0::numeric, 0::numeric, 'trigger', true, 'Realisasi 86 menyentuh batas trigger'),
  ('KFR-A2', 2, 'A', 80::numeric, '80', 80::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 80 memenuhi target'),
  ('KFR-A3', 3, 'A', 0::numeric, '1', 1::numeric, 0::numeric, 0::numeric, 0::numeric, 'trigger', true, 'Realisasi 1 menyentuh batas trigger'),
  ('KFR-A4', 4, 'A', null::numeric, 'Baik', null::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, '"Baik" sesuai target (Baik)'),
  ('KFR-A5', 5, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('KFR-B1', 6, 'B', 50::numeric, '62', 62::numeric, 124::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 62 memenuhi target'),
  ('KFR-B2', 7, 'B', null::numeric, 'Belum', null::numeric, 0::numeric, 0::numeric, 0::numeric, 'trigger', true, '"Belum" tidak sesuai target (Lulus)'),
  ('KFR-B3', 8, 'B', 1::numeric, '2', 2::numeric, 200::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 2 memenuhi target'),
  ('KFR-C1', 9, 'C', 100::numeric, '91', 91::numeric, 91::numeric, 0::numeric, 0::numeric, 'trigger', true, 'Realisasi 91 menyentuh batas trigger'),
  ('KFR-C2', 10, 'C', 100::numeric, '91', 91::numeric, 91::numeric, 0::numeric, 0::numeric, 'trigger', true, 'Realisasi 91 menyentuh batas trigger'),
  ('KFR-C3', 11, 'C', 95::numeric, '86', 86::numeric, 90.53::numeric, 0::numeric, 0::numeric, 'trigger', true, 'Realisasi 86 menyentuh batas trigger'),
  ('KFR-C4', 12, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('KFR-C5', 13, 'C', 80::numeric, '77.5', 77.5::numeric, 96.88::numeric, 70::numeric, 35::numeric, 'attention', false, 'Realisasi 77,5 belum mencapai target, belum menyentuh trigger'),
  ('KFR-C6', 14, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target')
) as v(icode, seq, cat, target_value, rtext, rnum, ach, score, wscore, status, is_trigger, reason)
join public.oppe_indicators i on i.code = v.icode
on conflict (evaluation_id, indicator_id) where indicator_id is not null do nothing;

-- dr. Fajar — semester_1 2026 — in_progress (good) -> skor 92.2 Sangat Baik
insert into public.oppe_evaluations (id, evaluation_number, doctor_id, ksm_id, profession, specialty, template_id, period_type, year, semester,
  evaluator_name, evaluation_date, due_date, status, score_professional, score_development, score_clinical, weighted_score, final_score, category_scores,
  final_category, final_category_label, met_count, attention_count, trigger_count, no_data_count, critical_trigger_count, critical_indicators,
  requires_fppe, trend, previous_score, conclusion, recommendation, reviewed_at, approved_at, finalized_at, is_demo)
values ('62bafb66-5950-4443-8cfd-4f245d714605', 'OPPE-DEMO/2026/0012', 'bca74dce-cf7e-480c-9e35-87a12b4f2fd8', (select id from public.oppe_ksm where code = 'PK'), 'Dokter Spesialis', 'Patologi Klinik (Sp.PK)',
  (select id from public.oppe_templates where code = 'PK'), 'semester_1', 2026, 1,
  'Ketua KSM (Demo)', '2026-07-15', '2026-07-31', 'in_progress',
  74, 100, 100, 92.2, 92.2,
  '[{"categoryId":null,"code":"A","name":"Perilaku Profesional","weight":30,"score":74,"weighted":22.2,"itemCount":5,"metCount":3},{"categoryId":null,"code":"B","name":"Pengembangan Profesional","weight":20,"score":100,"weighted":20,"itemCount":3,"metCount":3},{"categoryId":null,"code":"C","name":"Kinerja Klinis Spesifik","weight":50,"score":100,"weighted":50,"itemCount":6,"metCount":6}]'::jsonb,
  'sangat_baik', 'Sangat Baik', 12, 1, 1, 0,
  0, null, false, null, null,
  'Skor akhir OPPE 92,2 (Sangat Baik). 12 indikator memenuhi, 1 perlu perhatian, 1 trigger. Tidak ada indikator kritis yang terkena trigger.', 'Direkomendasikan mempertahankan kewenangan klinis dan melanjutkan monitoring OPPE rutin.
Rencana perbaikan dan pemantauan pada indikator trigger: Kerjasama dan koordinasi yang baik dengan Analis Kesehatan (ATLM).', null, null, null, true)
on conflict (id) do nothing;
insert into public.oppe_evaluation_items (evaluation_id, indicator_id, sequence, category_id, category_code, code, name, data_type, unit_label, target_text,
  target_operator, target_value, trigger_text, trigger_operator, trigger_value, options, pass_values, attention_values, is_critical, weight,
  realization_text, realization_number, achievement, score, weighted_score, status, is_trigger, status_reason, source_data)
select '62bafb66-5950-4443-8cfd-4f245d714605', i.id, v.seq, i.category_id, v.cat, i.code, i.name, i.data_type, i.unit_label, i.target_text, i.target_operator, v.target_value,
  i.trigger_text, i.trigger_operator, i.trigger_value, i.options, i.pass_values, i.attention_values, i.is_critical, i.weight,
  v.rtext, v.rnum, v.ach, v.score, v.wscore, v.status, v.is_trigger, v.reason, i.source_data
from (values
  ('PK-A1', 1, 'A', 95::numeric, '92.5', 92.5::numeric, 97.37::numeric, 70::numeric, 21::numeric, 'attention', false, 'Realisasi 92,5 belum mencapai target, belum menyentuh trigger'),
  ('PK-A2', 2, 'A', 80::numeric, '82', 82::numeric, 102.5::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 82 memenuhi target'),
  ('PK-A3', 3, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('PK-A4', 4, 'A', null::numeric, 'Kurang', null::numeric, 0::numeric, 0::numeric, 0::numeric, 'trigger', true, '"Kurang" tidak sesuai target (Baik)'),
  ('PK-A5', 5, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('PK-B1', 6, 'B', 50::numeric, '62', 62::numeric, 124::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 62 memenuhi target'),
  ('PK-B2', 7, 'B', null::numeric, 'Lulus', null::numeric, 100::numeric, 100::numeric, 20::numeric, 'met', false, '"Lulus" sesuai target (Lulus)'),
  ('PK-B3', 8, 'B', 1::numeric, '2', 2::numeric, 200::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 2 memenuhi target'),
  ('PK-C1', 9, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('PK-C2', 10, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('PK-C3', 11, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('PK-C4', 12, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('PK-C5', 13, 'C', 90::numeric, '92', 92::numeric, 102.22::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 92 memenuhi target'),
  ('PK-C6', 14, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target')
) as v(icode, seq, cat, target_value, rtext, rnum, ach, score, wscore, status, is_trigger, reason)
join public.oppe_indicators i on i.code = v.icode
on conflict (evaluation_id, indicator_id) where indicator_id is not null do nothing;

-- drg. Gina — semester_1 2026 — finalized (good) -> skor 92.2 Sangat Baik
insert into public.oppe_evaluations (id, evaluation_number, doctor_id, ksm_id, profession, specialty, template_id, period_type, year, semester,
  evaluator_name, evaluation_date, due_date, status, score_professional, score_development, score_clinical, weighted_score, final_score, category_scores,
  final_category, final_category_label, met_count, attention_count, trigger_count, no_data_count, critical_trigger_count, critical_indicators,
  requires_fppe, trend, previous_score, conclusion, recommendation, reviewed_at, approved_at, finalized_at, is_demo)
values ('dfb067da-de7f-46f7-8ffd-60024319ff4c', 'OPPE-DEMO/2026/0013', '78b88cb0-65b8-4641-a227-db1a1d700ef9', (select id from public.oppe_ksm where code = 'GGM'), 'Dokter Gigi', null,
  (select id from public.oppe_templates where code = 'DRG'), 'semester_1', 2026, 1,
  'Ketua KSM (Demo)', '2026-07-15', '2026-07-31', 'finalized',
  74, 100, 100, 92.2, 92.2,
  '[{"categoryId":null,"code":"A","name":"Perilaku Profesional","weight":30,"score":74,"weighted":22.2,"itemCount":5,"metCount":3},{"categoryId":null,"code":"B","name":"Pengembangan Profesional","weight":20,"score":100,"weighted":20,"itemCount":3,"metCount":3},{"categoryId":null,"code":"C","name":"Kinerja Klinis Spesifik","weight":50,"score":100,"weighted":50,"itemCount":6,"metCount":6}]'::jsonb,
  'sangat_baik', 'Sangat Baik', 12, 1, 1, 0,
  0, null, false, null, null,
  'Skor akhir OPPE 92,2 (Sangat Baik). 12 indikator memenuhi, 1 perlu perhatian, 1 trigger. Tidak ada indikator kritis yang terkena trigger.', 'Direkomendasikan mempertahankan kewenangan klinis dan melanjutkan monitoring OPPE rutin.
Rencana perbaikan dan pemantauan pada indikator trigger: Kerjasama tim & koordinasi yang baik dengan Perawat Gigi.', '2026-07-15 10:00:00+07', '2026-07-15 10:00:00+07', '2026-07-15 10:00:00+07', true)
on conflict (id) do nothing;
insert into public.oppe_evaluation_items (evaluation_id, indicator_id, sequence, category_id, category_code, code, name, data_type, unit_label, target_text,
  target_operator, target_value, trigger_text, trigger_operator, trigger_value, options, pass_values, attention_values, is_critical, weight,
  realization_text, realization_number, achievement, score, weighted_score, status, is_trigger, status_reason, source_data)
select 'dfb067da-de7f-46f7-8ffd-60024319ff4c', i.id, v.seq, i.category_id, v.cat, i.code, i.name, i.data_type, i.unit_label, i.target_text, i.target_operator, v.target_value,
  i.trigger_text, i.trigger_operator, i.trigger_value, i.options, i.pass_values, i.attention_values, i.is_critical, i.weight,
  v.rtext, v.rnum, v.ach, v.score, v.wscore, v.status, v.is_trigger, v.reason, i.source_data
from (values
  ('DRG-A1', 1, 'A', 95::numeric, '92.5', 92.5::numeric, 97.37::numeric, 70::numeric, 21::numeric, 'attention', false, 'Realisasi 92,5 belum mencapai target, belum menyentuh trigger'),
  ('DRG-A2', 2, 'A', 80::numeric, '82', 82::numeric, 102.5::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 82 memenuhi target'),
  ('DRG-A3', 3, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('DRG-A4', 4, 'A', null::numeric, 'Kurang', null::numeric, 0::numeric, 0::numeric, 0::numeric, 'trigger', true, '"Kurang" tidak sesuai target (Baik)'),
  ('DRG-A5', 5, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('DRG-B1', 6, 'B', 50::numeric, '62', 62::numeric, 124::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 62 memenuhi target'),
  ('DRG-B2', 7, 'B', null::numeric, 'Lulus', null::numeric, 100::numeric, 100::numeric, 20::numeric, 'met', false, '"Lulus" sesuai target (Lulus)'),
  ('DRG-B3', 8, 'B', 1::numeric, '2', 2::numeric, 200::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 2 memenuhi target'),
  ('DRG-C1', 9, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('DRG-C2', 10, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('DRG-C3', 11, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('DRG-C4', 12, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('DRG-C5', 13, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('DRG-C6', 14, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target')
) as v(icode, seq, cat, target_value, rtext, rnum, ach, score, wscore, status, is_trigger, reason)
join public.oppe_indicators i on i.code = v.icode
on conflict (evaluation_id, indicator_id) where indicator_id is not null do nothing;

-- dr. Hadi — semester_1 2026 — in_progress (fair) -> skor 80.7 Baik
insert into public.oppe_evaluations (id, evaluation_number, doctor_id, ksm_id, profession, specialty, template_id, period_type, year, semester,
  evaluator_name, evaluation_date, due_date, status, score_professional, score_development, score_clinical, weighted_score, final_score, category_scores,
  final_category, final_category_label, met_count, attention_count, trigger_count, no_data_count, critical_trigger_count, critical_indicators,
  requires_fppe, trend, previous_score, conclusion, recommendation, reviewed_at, approved_at, finalized_at, is_demo)
values ('46f4c6bf-ab25-40d7-be98-54935a50c352', 'OPPE-DEMO/2026/0014', '94b4465a-4d61-479e-86b4-9354bc404821', (select id from public.oppe_ksm where code = 'DU'), 'Dokter Umum', null,
  (select id from public.oppe_templates where code = 'UMUM'), 'semester_1', 2026, 1,
  'Ketua KSM (Demo)', '2026-07-15', '2026-07-31', 'in_progress',
  94, 66.67, 78.33, 80.7, 80.7,
  '[{"categoryId":null,"code":"A","name":"Perilaku Profesional","weight":30,"score":94,"weighted":28.2,"itemCount":5,"metCount":4},{"categoryId":null,"code":"B","name":"Pengembangan Profesional","weight":20,"score":66.67,"weighted":13.33,"itemCount":3,"metCount":2},{"categoryId":null,"code":"C","name":"Kinerja Klinis Spesifik","weight":50,"score":78.33,"weighted":39.17,"itemCount":6,"metCount":4}]'::jsonb,
  'baik', 'Baik', 10, 2, 2, 0,
  0, null, false, null, null,
  'Skor akhir OPPE 80,7 (Baik). 10 indikator memenuhi, 2 perlu perhatian, 2 trigger. Tidak ada indikator kritis yang terkena trigger.', 'Direkomendasikan melanjutkan kewenangan klinis dengan monitoring rutin.
Rencana perbaikan dan pemantauan pada indikator trigger: Pemenuhan poin SKP tahunan (Kemenkes/IDI); Kelengkapan Asesmen Gawat Darurat / Medis Awal < 2 jam.', null, null, null, true)
on conflict (id) do nothing;
insert into public.oppe_evaluation_items (evaluation_id, indicator_id, sequence, category_id, category_code, code, name, data_type, unit_label, target_text,
  target_operator, target_value, trigger_text, trigger_operator, trigger_value, options, pass_values, attention_values, is_critical, weight,
  realization_text, realization_number, achievement, score, weighted_score, status, is_trigger, status_reason, source_data)
select '46f4c6bf-ab25-40d7-be98-54935a50c352', i.id, v.seq, i.category_id, v.cat, i.code, i.name, i.data_type, i.unit_label, i.target_text, i.target_operator, v.target_value,
  i.trigger_text, i.trigger_operator, i.trigger_value, i.options, i.pass_values, i.attention_values, i.is_critical, i.weight,
  v.rtext, v.rnum, v.ach, v.score, v.wscore, v.status, v.is_trigger, v.reason, i.source_data
from (values
  ('UMUM-A1', 1, 'A', 95::numeric, '92.5', 92.5::numeric, 97.37::numeric, 70::numeric, 21::numeric, 'attention', false, 'Realisasi 92,5 belum mencapai target, belum menyentuh trigger'),
  ('UMUM-A2', 2, 'A', 80::numeric, '80', 80::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 80 memenuhi target'),
  ('UMUM-A3', 3, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('UMUM-A4', 4, 'A', null::numeric, 'Baik', null::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, '"Baik" sesuai target (Baik)'),
  ('UMUM-A5', 5, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('UMUM-B1', 6, 'B', 50::numeric, '30', 30::numeric, 60::numeric, 0::numeric, 0::numeric, 'trigger', true, 'Realisasi 30 menyentuh batas trigger'),
  ('UMUM-B2', 7, 'B', null::numeric, 'Aktif', null::numeric, 100::numeric, 100::numeric, 20::numeric, 'met', false, '"Aktif" sesuai target (Aktif)'),
  ('UMUM-B3', 8, 'B', null::numeric, 'Lulus', null::numeric, 100::numeric, 100::numeric, 20::numeric, 'met', false, '"Lulus" sesuai target (Lulus)'),
  ('UMUM-C1', 9, 'C', 95::numeric, '92.5', 92.5::numeric, 97.37::numeric, 70::numeric, 35::numeric, 'attention', false, 'Realisasi 92,5 belum mencapai target, belum menyentuh trigger'),
  ('UMUM-C2', 10, 'C', 100::numeric, '86', 86::numeric, 86::numeric, 0::numeric, 0::numeric, 'trigger', true, 'Realisasi 86 menyentuh batas trigger'),
  ('UMUM-C3', 11, 'C', 95::numeric, '95', 95::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 95 memenuhi target'),
  ('UMUM-C4', 12, 'C', 90::numeric, '92', 92::numeric, 102.22::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 92 memenuhi target'),
  ('UMUM-C5', 13, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('UMUM-C6', 14, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target')
) as v(icode, seq, cat, target_value, rtext, rnum, ach, score, wscore, status, is_trigger, reason)
join public.oppe_indicators i on i.code = v.icode
on conflict (evaluation_id, indicator_id) where indicator_id is not null do nothing;

-- dr. Intan — semester_2 2025 — finalized (excellent) -> skor 100 Sangat Baik
insert into public.oppe_evaluations (id, evaluation_number, doctor_id, ksm_id, profession, specialty, template_id, period_type, year, semester,
  evaluator_name, evaluation_date, due_date, status, score_professional, score_development, score_clinical, weighted_score, final_score, category_scores,
  final_category, final_category_label, met_count, attention_count, trigger_count, no_data_count, critical_trigger_count, critical_indicators,
  requires_fppe, trend, previous_score, conclusion, recommendation, reviewed_at, approved_at, finalized_at, is_demo)
values ('b0e04e06-8b4c-4c1d-8357-db9c639b50b0', 'OPPE-DEMO/2025/0015', '53de5b34-c7e4-485d-b734-a27fac5abf44', (select id from public.oppe_ksm where code = 'OBG'), 'Dokter Spesialis', 'Obstetri dan Ginekologi (Sp.OG)',
  (select id from public.oppe_templates where code = 'OBG'), 'semester_2', 2025, 2,
  'Ketua KSM (Demo)', '2025-12-20', '2025-12-31', 'finalized',
  100, 100, 100, 100, 100,
  '[{"categoryId":null,"code":"A","name":"Perilaku Profesional","weight":30,"score":100,"weighted":30,"itemCount":5,"metCount":5},{"categoryId":null,"code":"B","name":"Pengembangan Profesional","weight":20,"score":100,"weighted":20,"itemCount":3,"metCount":3},{"categoryId":null,"code":"C","name":"Kinerja Klinis Spesifik","weight":50,"score":100,"weighted":50,"itemCount":6,"metCount":6}]'::jsonb,
  'sangat_baik', 'Sangat Baik', 14, 0, 0, 0,
  0, null, false, null, null,
  'Skor akhir OPPE 100 (Sangat Baik). 14 indikator memenuhi, 0 perlu perhatian, 0 trigger. Tidak ada indikator kritis yang terkena trigger.', 'Direkomendasikan mempertahankan kewenangan klinis dan melanjutkan monitoring OPPE rutin.', '2025-12-20 10:00:00+07', '2025-12-20 10:00:00+07', '2025-12-20 10:00:00+07', true)
on conflict (id) do nothing;
insert into public.oppe_evaluation_items (evaluation_id, indicator_id, sequence, category_id, category_code, code, name, data_type, unit_label, target_text,
  target_operator, target_value, trigger_text, trigger_operator, trigger_value, options, pass_values, attention_values, is_critical, weight,
  realization_text, realization_number, achievement, score, weighted_score, status, is_trigger, status_reason, source_data)
select 'b0e04e06-8b4c-4c1d-8357-db9c639b50b0', i.id, v.seq, i.category_id, v.cat, i.code, i.name, i.data_type, i.unit_label, i.target_text, i.target_operator, v.target_value,
  i.trigger_text, i.trigger_operator, i.trigger_value, i.options, i.pass_values, i.attention_values, i.is_critical, i.weight,
  v.rtext, v.rnum, v.ach, v.score, v.wscore, v.status, v.is_trigger, v.reason, i.source_data
from (values
  ('OBG-A1', 1, 'A', 95::numeric, '97', 97::numeric, 102.11::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 97 memenuhi target'),
  ('OBG-A2', 2, 'A', 80::numeric, '82', 82::numeric, 102.5::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 82 memenuhi target'),
  ('OBG-A3', 3, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('OBG-A4', 4, 'A', null::numeric, 'Baik', null::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, '"Baik" sesuai target (Baik)'),
  ('OBG-A5', 5, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('OBG-B1', 6, 'B', 50::numeric, '62', 62::numeric, 124::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 62 memenuhi target'),
  ('OBG-B2', 7, 'B', null::numeric, 'Lulus', null::numeric, 100::numeric, 100::numeric, 20::numeric, 'met', false, '"Lulus" sesuai target (Lulus)'),
  ('OBG-B3', 8, 'B', 1::numeric, '2', 2::numeric, 200::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 2 memenuhi target'),
  ('OBG-C1', 9, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('OBG-C2', 10, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('OBG-C3', 11, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('OBG-C4', 12, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('OBG-C5', 13, 'C', 5::numeric, '2.5', 2.5::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 2,5 memenuhi target'),
  ('OBG-C6', 14, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target')
) as v(icode, seq, cat, target_value, rtext, rnum, ach, score, wscore, status, is_trigger, reason)
join public.oppe_indicators i on i.code = v.icode
on conflict (evaluation_id, indicator_id) where indicator_id is not null do nothing;

-- dr. Intan — semester_1 2026 — approved (good) -> skor 94 Sangat Baik
insert into public.oppe_evaluations (id, evaluation_number, doctor_id, ksm_id, profession, specialty, template_id, period_type, year, semester,
  evaluator_name, evaluation_date, due_date, status, score_professional, score_development, score_clinical, weighted_score, final_score, category_scores,
  final_category, final_category_label, met_count, attention_count, trigger_count, no_data_count, critical_trigger_count, critical_indicators,
  requires_fppe, trend, previous_score, conclusion, recommendation, reviewed_at, approved_at, finalized_at, is_demo)
values ('ab2bd372-befd-4462-90eb-8b4f58f01209', 'OPPE-DEMO/2026/0016', '53de5b34-c7e4-485d-b734-a27fac5abf44', (select id from public.oppe_ksm where code = 'OBG'), 'Dokter Spesialis', 'Obstetri dan Ginekologi (Sp.OG)',
  (select id from public.oppe_templates where code = 'OBG'), 'semester_1', 2026, 1,
  'Ketua KSM (Demo)', '2026-07-15', '2026-07-31', 'approved',
  80, 100, 100, 94, 94,
  '[{"categoryId":null,"code":"A","name":"Perilaku Profesional","weight":30,"score":80,"weighted":24,"itemCount":5,"metCount":4},{"categoryId":null,"code":"B","name":"Pengembangan Profesional","weight":20,"score":100,"weighted":20,"itemCount":3,"metCount":3},{"categoryId":null,"code":"C","name":"Kinerja Klinis Spesifik","weight":50,"score":100,"weighted":50,"itemCount":6,"metCount":6}]'::jsonb,
  'sangat_baik', 'Sangat Baik', 13, 0, 1, 0,
  0, null, false, 'turun', 100,
  'Skor akhir OPPE 94 (Sangat Baik). 13 indikator memenuhi, 0 perlu perhatian, 1 trigger. Tidak ada indikator kritis yang terkena trigger. Trend dibanding periode sebelumnya: turun.', 'Direkomendasikan mempertahankan kewenangan klinis dan melanjutkan monitoring OPPE rutin.
Rencana perbaikan dan pemantauan pada indikator trigger: Komunikasi efektif antar-profesi dengan bidan & perawat.', '2026-07-15 10:00:00+07', '2026-07-15 10:00:00+07', null, true)
on conflict (id) do nothing;
insert into public.oppe_evaluation_items (evaluation_id, indicator_id, sequence, category_id, category_code, code, name, data_type, unit_label, target_text,
  target_operator, target_value, trigger_text, trigger_operator, trigger_value, options, pass_values, attention_values, is_critical, weight,
  realization_text, realization_number, achievement, score, weighted_score, status, is_trigger, status_reason, source_data)
select 'ab2bd372-befd-4462-90eb-8b4f58f01209', i.id, v.seq, i.category_id, v.cat, i.code, i.name, i.data_type, i.unit_label, i.target_text, i.target_operator, v.target_value,
  i.trigger_text, i.trigger_operator, i.trigger_value, i.options, i.pass_values, i.attention_values, i.is_critical, i.weight,
  v.rtext, v.rnum, v.ach, v.score, v.wscore, v.status, v.is_trigger, v.reason, i.source_data
from (values
  ('OBG-A1', 1, 'A', 95::numeric, '95', 95::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 95 memenuhi target'),
  ('OBG-A2', 2, 'A', 80::numeric, '82', 82::numeric, 102.5::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 82 memenuhi target'),
  ('OBG-A3', 3, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('OBG-A4', 4, 'A', null::numeric, 'Kurang', null::numeric, 0::numeric, 0::numeric, 0::numeric, 'trigger', true, '"Kurang" tidak sesuai target (Baik)'),
  ('OBG-A5', 5, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('OBG-B1', 6, 'B', 50::numeric, '62', 62::numeric, 124::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 62 memenuhi target'),
  ('OBG-B2', 7, 'B', null::numeric, 'Lulus', null::numeric, 100::numeric, 100::numeric, 20::numeric, 'met', false, '"Lulus" sesuai target (Lulus)'),
  ('OBG-B3', 8, 'B', 1::numeric, '2', 2::numeric, 200::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 2 memenuhi target'),
  ('OBG-C1', 9, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('OBG-C2', 10, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('OBG-C3', 11, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target'),
  ('OBG-C4', 12, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('OBG-C5', 13, 'C', 5::numeric, '2.5', 2.5::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 2,5 memenuhi target'),
  ('OBG-C6', 14, 'C', 100::numeric, '100', 100::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 100 memenuhi target')
) as v(icode, seq, cat, target_value, rtext, rnum, ach, score, wscore, status, is_trigger, reason)
join public.oppe_indicators i on i.code = v.icode
on conflict (evaluation_id, indicator_id) where indicator_id is not null do nothing;

-- dr. Joko — semester_2 2025 — finalized (good) -> skor 91.5 Sangat Baik
insert into public.oppe_evaluations (id, evaluation_number, doctor_id, ksm_id, profession, specialty, template_id, period_type, year, semester,
  evaluator_name, evaluation_date, due_date, status, score_professional, score_development, score_clinical, weighted_score, final_score, category_scores,
  final_category, final_category_label, met_count, attention_count, trigger_count, no_data_count, critical_trigger_count, critical_indicators,
  requires_fppe, trend, previous_score, conclusion, recommendation, reviewed_at, approved_at, finalized_at, is_demo)
values ('c2c39196-bd0d-444a-90b8-cb0805732ece', 'OPPE-DEMO/2025/0017', '5ba4e6d9-e33e-45c3-9b30-9298a1f220d9', (select id from public.oppe_ksm where code = 'NBDH'), 'Dokter Spesialis', 'Penyakit Dalam (Sp.PD)',
  (select id from public.oppe_templates where code = 'NBDH'), 'semester_2', 2025, 2,
  'Ketua KSM (Demo)', '2025-12-20', '2025-12-31', 'finalized',
  80, 100, 95, 91.5, 91.5,
  '[{"categoryId":null,"code":"A","name":"Perilaku Profesional","weight":30,"score":80,"weighted":24,"itemCount":5,"metCount":4},{"categoryId":null,"code":"B","name":"Pengembangan Profesional","weight":20,"score":100,"weighted":20,"itemCount":3,"metCount":3},{"categoryId":null,"code":"C","name":"Kinerja Klinis Spesifik","weight":50,"score":95,"weighted":47.5,"itemCount":6,"metCount":5}]'::jsonb,
  'sangat_baik', 'Sangat Baik', 12, 1, 1, 0,
  0, null, false, null, null,
  'Skor akhir OPPE 91,5 (Sangat Baik). 12 indikator memenuhi, 1 perlu perhatian, 1 trigger. Tidak ada indikator kritis yang terkena trigger.', 'Direkomendasikan mempertahankan kewenangan klinis dan melanjutkan monitoring OPPE rutin.
Rencana perbaikan dan pemantauan pada indikator trigger: Komunikasi efektif antar-profesi (SBAR/TBAK).', '2025-12-20 10:00:00+07', '2025-12-20 10:00:00+07', '2025-12-20 10:00:00+07', true)
on conflict (id) do nothing;
insert into public.oppe_evaluation_items (evaluation_id, indicator_id, sequence, category_id, category_code, code, name, data_type, unit_label, target_text,
  target_operator, target_value, trigger_text, trigger_operator, trigger_value, options, pass_values, attention_values, is_critical, weight,
  realization_text, realization_number, achievement, score, weighted_score, status, is_trigger, status_reason, source_data)
select 'c2c39196-bd0d-444a-90b8-cb0805732ece', i.id, v.seq, i.category_id, v.cat, i.code, i.name, i.data_type, i.unit_label, i.target_text, i.target_operator, v.target_value,
  i.trigger_text, i.trigger_operator, i.trigger_value, i.options, i.pass_values, i.attention_values, i.is_critical, i.weight,
  v.rtext, v.rnum, v.ach, v.score, v.wscore, v.status, v.is_trigger, v.reason, i.source_data
from (values
  ('NBDH-A1', 1, 'A', 80::numeric, '80', 80::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 80 memenuhi target'),
  ('NBDH-A2', 2, 'A', 80::numeric, '82', 82::numeric, 102.5::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 82 memenuhi target'),
  ('NBDH-A3', 3, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('NBDH-A4', 4, 'A', null::numeric, 'Kurang', null::numeric, 0::numeric, 0::numeric, 0::numeric, 'trigger', true, '"Kurang" tidak sesuai target (Baik)'),
  ('NBDH-A5', 5, 'A', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 30::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('NBDH-B1', 6, 'B', 50::numeric, '62', 62::numeric, 124::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 62 memenuhi target'),
  ('NBDH-B2', 7, 'B', null::numeric, 'Lulus', null::numeric, 100::numeric, 100::numeric, 20::numeric, 'met', false, '"Lulus" sesuai target (Lulus)'),
  ('NBDH-B3', 8, 'B', 1::numeric, '2', 2::numeric, 200::numeric, 100::numeric, 20::numeric, 'met', false, 'Realisasi 2 memenuhi target'),
  ('NBDH-C1', 9, 'C', 100::numeric, '95', 95::numeric, 95::numeric, 70::numeric, 35::numeric, 'attention', false, 'Realisasi 95 belum mencapai target, belum menyentuh trigger'),
  ('NBDH-C2', 10, 'C', 95::numeric, '97', 97::numeric, 102.11::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 97 memenuhi target'),
  ('NBDH-C3', 11, 'C', 5::numeric, '2.5', 2.5::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 2,5 memenuhi target'),
  ('NBDH-C4', 12, 'C', 80::numeric, '80', 80::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 80 memenuhi target'),
  ('NBDH-C5', 13, 'C', 0::numeric, '0', 0::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 0 memenuhi target'),
  ('NBDH-C6', 14, 'C', 2.5::numeric, '1,8', 1.8::numeric, 100::numeric, 100::numeric, 50::numeric, 'met', false, 'Realisasi 1,8 memenuhi target')
) as v(icode, seq, cat, target_value, rtext, rnum, ach, score, wscore, status, is_trigger, reason)
join public.oppe_indicators i on i.code = v.icode
on conflict (evaluation_id, indicator_id) where indicator_id is not null do nothing;

-- dr. Andi — semester_2 2026 — draft (empty) -> skor - 
insert into public.oppe_evaluations (id, evaluation_number, doctor_id, ksm_id, profession, specialty, template_id, period_type, year, semester,
  evaluator_name, evaluation_date, due_date, status, score_professional, score_development, score_clinical, weighted_score, final_score, category_scores,
  final_category, final_category_label, met_count, attention_count, trigger_count, no_data_count, critical_trigger_count, critical_indicators,
  requires_fppe, trend, previous_score, conclusion, recommendation, reviewed_at, approved_at, finalized_at, is_demo)
values ('71bbad0e-18e8-42e2-a03c-6f136580eca9', 'OPPE-DEMO/2026/0018', '242a4cc1-0b50-4a56-8ca6-31c09f343ff2', (select id from public.oppe_ksm where code = 'ANS'), 'Dokter Spesialis', 'Anestesiologi dan Terapi Intensif (Sp.An)',
  (select id from public.oppe_templates where code = 'ANS'), 'semester_2', 2026, 2,
  'Ketua KSM (Demo)', null, '2026-12-31', 'draft',
  null, null, null, null, null,
  '[{"categoryId":null,"code":"A","name":"Perilaku Profesional","weight":30,"score":null,"weighted":null,"itemCount":5,"metCount":0},{"categoryId":null,"code":"B","name":"Pengembangan Profesional","weight":20,"score":null,"weighted":null,"itemCount":3,"metCount":0},{"categoryId":null,"code":"C","name":"Kinerja Klinis Spesifik","weight":50,"score":null,"weighted":null,"itemCount":6,"metCount":0}]'::jsonb,
  null, null, 0, 0, 0, 14,
  0, null, false, null, 91.67,
  null, null, null, null, null, true)
on conflict (id) do nothing;
insert into public.oppe_evaluation_items (evaluation_id, indicator_id, sequence, category_id, category_code, code, name, data_type, unit_label, target_text,
  target_operator, target_value, trigger_text, trigger_operator, trigger_value, options, pass_values, attention_values, is_critical, weight,
  realization_text, realization_number, achievement, score, weighted_score, status, is_trigger, status_reason, source_data)
select '71bbad0e-18e8-42e2-a03c-6f136580eca9', i.id, v.seq, i.category_id, v.cat, i.code, i.name, i.data_type, i.unit_label, i.target_text, i.target_operator, v.target_value,
  i.trigger_text, i.trigger_operator, i.trigger_value, i.options, i.pass_values, i.attention_values, i.is_critical, i.weight,
  v.rtext, v.rnum, v.ach, v.score, v.wscore, v.status, v.is_trigger, v.reason, i.source_data
from (values
  ('ANS-A1', 1, 'A', 95::numeric, null, null::numeric, null::numeric, null::numeric, null::numeric, 'no_data', false, 'Realisasi belum diisi'),
  ('ANS-A2', 2, 'A', 80::numeric, null, null::numeric, null::numeric, null::numeric, null::numeric, 'no_data', false, 'Realisasi belum diisi'),
  ('ANS-A3', 3, 'A', 0::numeric, null, null::numeric, null::numeric, null::numeric, null::numeric, 'no_data', false, 'Realisasi belum diisi'),
  ('ANS-A4', 4, 'A', null::numeric, null, null::numeric, null::numeric, null::numeric, null::numeric, 'no_data', false, 'Realisasi belum diisi'),
  ('ANS-A5', 5, 'A', 0::numeric, null, null::numeric, null::numeric, null::numeric, null::numeric, 'no_data', false, 'Realisasi belum diisi'),
  ('ANS-B1', 6, 'B', null::numeric, null, null::numeric, null::numeric, null::numeric, null::numeric, 'no_data', false, 'Realisasi belum diisi'),
  ('ANS-B2', 7, 'B', null::numeric, null, null::numeric, null::numeric, null::numeric, null::numeric, 'no_data', false, 'Realisasi belum diisi'),
  ('ANS-B3', 8, 'B', null::numeric, null, null::numeric, null::numeric, null::numeric, null::numeric, 'no_data', false, 'Realisasi belum diisi'),
  ('ANS-C1', 9, 'C', 100::numeric, null, null::numeric, null::numeric, null::numeric, null::numeric, 'no_data', false, 'Realisasi belum diisi'),
  ('ANS-C2', 10, 'C', 100::numeric, null, null::numeric, null::numeric, null::numeric, null::numeric, 'no_data', false, 'Realisasi belum diisi'),
  ('ANS-C3', 11, 'C', 1::numeric, null, null::numeric, null::numeric, null::numeric, null::numeric, 'no_data', false, 'Realisasi belum diisi'),
  ('ANS-C4', 12, 'C', 0::numeric, null, null::numeric, null::numeric, null::numeric, null::numeric, 'no_data', false, 'Realisasi belum diisi'),
  ('ANS-C5', 13, 'C', 100::numeric, null, null::numeric, null::numeric, null::numeric, null::numeric, 'no_data', false, 'Realisasi belum diisi'),
  ('ANS-C6', 14, 'C', 0::numeric, null, null::numeric, null::numeric, null::numeric, null::numeric, 'no_data', false, 'Realisasi belum diisi')
) as v(icode, seq, cat, target_value, rtext, rnum, ach, score, wscore, status, is_trigger, reason)
join public.oppe_indicators i on i.code = v.icode
on conflict (evaluation_id, indicator_id) where indicator_id is not null do nothing;

insert into public.oppe_fppe (id, fppe_number, evaluation_id, doctor_id, ksm_id, trigger_indicator_id, trigger_indicator_name, reason, area, start_date, end_date,
  evaluator_name, plan, status, is_demo)
values ('20631160-b60d-45df-96aa-302c069c2e1c', 'FPPE-DEMO/2026/001', '8c2d6f80-924d-44f6-854c-08570b27e53d', '242a4cc1-0b50-4a56-8ca6-31c09f343ff2', (select id from public.oppe_ksm where code = 'ANS'),
  (select id from public.oppe_indicators where code = 'ANS-C4'), 'Kejadian henti jantung peri-anestesi (Perioperative Cardiac Arrest)',
  'Indikator kritis terkena trigger pada OPPE 2026: Kejadian henti jantung peri-anestesi (Perioperative Cardiac Arrest)',
  'Kinerja klinis spesifik — tata laksana peri-anestesi', '2026-08-01', '2026-10-31',
  'Subkomite Mutu Profesi (Demo)', 'Review kasus oleh peer, observasi langsung 10 tindakan, audit rekam medis 3 bulan.', 'berjalan', true)
on conflict (id) do nothing;
insert into public.oppe_fppe (id, fppe_number, evaluation_id, doctor_id, ksm_id, trigger_indicator_id, trigger_indicator_name, reason, area, start_date, end_date,
  evaluator_name, plan, status, is_demo)
values ('c18419a3-b521-4bcd-b7d3-e838873750cb', 'FPPE-DEMO/2026/002', '8dabd3ed-7a19-4dc1-a003-e2518346df60', 'ad7335f5-92ae-4276-95b6-0a6642bb52f6', (select id from public.oppe_ksm where code = 'THT'),
  (select id from public.oppe_indicators where code = 'THT-C2'), 'Kejadian perdarahan pasca-operasi tonsilektomi yang membutuhkan intervensi atau re-operasi < 24 jam',
  'Indikator kritis terkena trigger pada OPPE 2026: Kejadian perdarahan pasca-operasi tonsilektomi yang membutuhkan intervensi atau re-operasi < 24 jam',
  'Kinerja klinis spesifik — tata laksana peri-anestesi', '2026-08-01', '2026-10-31',
  'Subkomite Mutu Profesi (Demo)', 'Review kasus oleh peer, observasi langsung 10 tindakan, audit rekam medis 3 bulan.', 'berjalan', true)
on conflict (id) do nothing;
insert into public.oppe_fppe (id, fppe_number, evaluation_id, doctor_id, ksm_id, trigger_indicator_id, trigger_indicator_name, reason, area, start_date, end_date,
  evaluator_name, plan, status, is_demo)
values ('4464ad62-6bde-422e-922e-00b13c84ccf6', 'FPPE-DEMO/2026/003', '1cef9569-f907-4e16-90bd-35346edf9c78', 'a46b5edb-5761-4aec-a153-03750183986a', (select id from public.oppe_ksm where code = 'KFR'),
  null, 'Penurunan skor OPPE signifikan & beberapa indikator trigger',
  'Skor OPPE turun signifikan dan beberapa indikator menyentuh trigger.',
  'Perilaku profesional & kinerja klinis', '2026-08-01', '2026-10-31',
  'Subkomite Mutu Profesi (Demo)', 'Review kasus oleh peer, observasi langsung 10 tindakan, audit rekam medis 3 bulan.', 'direncanakan', true)
on conflict (id) do nothing;
