'use client';

import { useEffect, useState } from 'react';
import { BudayaDashboardPanel } from './BudayaDashboardPanel';
import { BudayaSurveyList } from './BudayaSurveyList';
import { BudayaSurveyForm } from './BudayaSurveyForm';
import { BudayaQuestionnairePanel } from './BudayaQuestionnairePanel';
import { BudayaRespondentsPanel } from './BudayaRespondentsPanel';
import { BudayaResultsPanel } from './BudayaResultsPanel';
import { BudayaDimensionAnalysisPanel } from './BudayaDimensionAnalysisPanel';
import { BudayaUnitAnalysisPanel } from './BudayaUnitAnalysisPanel';
import { BudayaRiskAreaPanel } from './BudayaRiskAreaPanel';
import { BudayaFollowupPanel } from './BudayaFollowupPanel';
import { BudayaMonitoringPanel } from './BudayaMonitoringPanel';
import { BudayaLaporanPanel } from './BudayaLaporanPanel';
import { BudayaMasterDataPanel } from './BudayaMasterDataPanel';

/**
 * Satu-satunya titik integrasi modul Survey Budaya Keselamatan Pasien ke
 * src/app/page.tsx, mengikuti pola persis IkpModule.tsx/RiskModule.tsx,
 * supaya perubahan pada modul ini tidak menyentuh (dan tidak berisiko
 * merusak) logika activeTab/rendering yang sudah ada.
 *
 * activeTab yang dikenali (diberikan oleh DashboardSidebar):
 *   budaya-dashboard | budaya-aktif | budaya-buat | budaya-kuesioner |
 *   budaya-responden | budaya-hasil | budaya-analisis-dimensi |
 *   budaya-analisis-unit | budaya-risk-area | budaya-tindak-lanjut |
 *   budaya-monitoring | budaya-laporan | budaya-riwayat | budaya-master
 *
 * CATATAN: halaman PENGISIAN oleh responden (publik/anonim, tanpa login)
 * BUKAN bagian dari modul ini — itu route terpisah di luar dashboard
 * (mis. src/app/survey-budaya/[token]/page.tsx), karena responden tidak
 * login sebagai staf INMrsds. 'budaya-kuesioner' di sini adalah panel
 * ADMIN untuk melihat struktur instrumen (read-only) dan mengelola link
 * distribusi, bukan form pengisian itu sendiri.
 */
interface BudayaModuleProps {
  activeTab: string;
  userId: string;
  userName: string;
  activeUnit: string;
  /** true untuk role komite_mutu/manajemen/kepala_unit/admin (lihat page.tsx). */
  canReview: boolean;
  /** true HANYA untuk role='admin' — dipakai gerbang Master Data. */
  isAdmin: boolean;
  onNavigate: (tab: string) => void;
}

type DetailTarget = { surveyId: string; focusTab: string } | null;

export function BudayaModule({ activeTab, userId, userName, activeUnit, canReview, isAdmin, onNavigate }: BudayaModuleProps) {
  const [detail, setDetail] = useState<DetailTarget>(null);

  // Kalau sidebar diklik ke tab lain, keluar dari tampilan detail survei.
  useEffect(() => { setDetail(null); }, [activeTab]);

  const openSurvey = (surveyId: string, focusTab = 'ringkasan') => setDetail({ surveyId, focusTab });

  switch (activeTab) {
    case 'budaya-dashboard':
      return <BudayaDashboardPanel onSelectSurvey={openSurvey} />;

    case 'budaya-aktif':
      return (
        <BudayaSurveyList
          statusFilter={['draft', 'aktif']}
          title="Survey Aktif"
          canReview={canReview}
          userId={userId}
          onSelect={openSurvey}
          onCreateNew={() => onNavigate('budaya-buat')}
        />
      );

    case 'budaya-riwayat':
      return (
        <BudayaSurveyList
          statusFilter={['ditutup', 'final', 'arsip']}
          title="Riwayat Survey"
          canReview={canReview}
          userId={userId}
          onSelect={openSurvey}
        />
      );

    case 'budaya-buat':
      return (
        <BudayaSurveyForm
          userId={userId}
          survey={detail ? undefined : undefined}
          onDone={(id) => openSurvey(id, 'ringkasan')}
          onCancel={() => onNavigate('budaya-aktif')}
        />
      );

    case 'budaya-kuesioner':
      return <BudayaQuestionnairePanel surveyId={detail?.surveyId} onSelectSurvey={openSurvey} />;

    case 'budaya-responden':
      return <BudayaRespondentsPanel surveyId={detail?.surveyId} onSelectSurvey={openSurvey} />;

    case 'budaya-hasil':
      return (
        <BudayaResultsPanel
          surveyId={detail?.surveyId}
          canReview={canReview}
          userId={userId}
          onSelectSurvey={openSurvey}
          onNavigate={onNavigate}
        />
      );

    case 'budaya-analisis-dimensi':
      return <BudayaDimensionAnalysisPanel surveyId={detail?.surveyId} onSelectSurvey={openSurvey} />;

    case 'budaya-analisis-unit':
      return <BudayaUnitAnalysisPanel surveyId={detail?.surveyId} onSelectSurvey={openSurvey} />;

    case 'budaya-risk-area':
      return <BudayaRiskAreaPanel surveyId={detail?.surveyId} userId={userId} onSelectSurvey={openSurvey} onNavigateFollowup={() => onNavigate('budaya-tindak-lanjut')} />;

    case 'budaya-tindak-lanjut':
      return <BudayaFollowupPanel surveyId={detail?.surveyId} userId={userId} canReview={canReview} onSelectSurvey={openSurvey} />;

    case 'budaya-monitoring':
      return <BudayaMonitoringPanel userId={userId} canReview={canReview} />;

    case 'budaya-laporan':
      return <BudayaLaporanPanel surveyId={detail?.surveyId} userId={userId} userName={userName} canReview={canReview} onSelectSurvey={openSurvey} />;

    case 'budaya-master':
      return <BudayaMasterDataPanel isAdmin={isAdmin} currentUserId={userId} />;

    default:
      return <BudayaDashboardPanel onSelectSurvey={openSurvey} />;
  }
}
