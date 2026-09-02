'use client';

import { useState } from 'react';
import { KepuasanDashboardPanel } from './KepuasanDashboardPanel';
import { KepuasanSurveyList } from './KepuasanSurveyList';
import { KepuasanSurveyForm } from './KepuasanSurveyForm';
import { KepuasanDistribusiPanel } from './KepuasanDistribusiPanel';
import { KepuasanResponsesPanel } from './KepuasanResponsesPanel';
import { KepuasanKritikSaranPanel } from './KepuasanKritikSaranPanel';
import { KepuasanMonevPanel } from './KepuasanMonevPanel';

/**
 * Satu-satunya titik integrasi modul Survey Kepuasan Pasien ke
 * src/app/page.tsx, mengikuti pola persis BudayaModule.tsx, supaya
 * perubahan pada modul ini tidak menyentuh (dan tidak berisiko merusak)
 * logika activeTab/rendering yang sudah ada.
 *
 * activeTab yang dikenali (diberikan oleh DashboardSidebar):
 *   kepuasan-dashboard | kepuasan-aktif | kepuasan-buat |
 *   kepuasan-distribusi | kepuasan-responses | kepuasan-kritik-saran |
 *   kepuasan-monev | kepuasan-riwayat
 *
 * CATATAN: halaman PENGISIAN oleh pasien (publik, tanpa login) BUKAN
 * bagian dari modul ini — itu route terpisah src/app/survey-kepuasan/
 * (mengikuti pola src/app/survey-budaya/), karena pasien tidak login
 * sebagai staf INMrsds.
 */
interface KepuasanModuleProps {
  activeTab: string;
  userId: string;
  userName: string;
  canManageSurvey: boolean;
  onNavigate: (tab: string) => void;
}

type DetailTarget = { surveyId: string } | null;

export function KepuasanModule({ activeTab, userId, userName, canManageSurvey, onNavigate }: KepuasanModuleProps) {
  void userName;
  const [detail, setDetail] = useState<DetailTarget>(null);

  const openSurvey = (surveyId: string, tab?: string) => {
    setDetail({ surveyId });
    if (tab) onNavigate(tab);
  };

  switch (activeTab) {
    case 'kepuasan-dashboard':
      return <KepuasanDashboardPanel surveyId={detail?.surveyId} userId={userId} onSelectSurvey={openSurvey} />;

    case 'kepuasan-aktif':
      return (
        <KepuasanSurveyList
          statusFilter={['draft', 'aktif']}
          title="Survey Kepuasan Pasien"
          canManageSurvey={canManageSurvey}
          onSelect={openSurvey}
          onCreateNew={() => onNavigate('kepuasan-buat')}
        />
      );

    case 'kepuasan-riwayat':
      return (
        <KepuasanSurveyList
          statusFilter={['ditutup', 'arsip']}
          title="Riwayat Survey"
          canManageSurvey={canManageSurvey}
          onSelect={openSurvey}
        />
      );

    case 'kepuasan-buat':
      return (
        <KepuasanSurveyForm
          userId={userId}
          onDone={(id) => openSurvey(id, 'kepuasan-distribusi')}
          onCancel={() => onNavigate('kepuasan-aktif')}
        />
      );

    case 'kepuasan-distribusi':
      return <KepuasanDistribusiPanel surveyId={detail?.surveyId} userId={userId} />;

    case 'kepuasan-responses':
      return <KepuasanResponsesPanel surveyId={detail?.surveyId} userId={userId} onSelectSurvey={openSurvey} />;

    case 'kepuasan-kritik-saran':
      return <KepuasanKritikSaranPanel surveyId={detail?.surveyId} userId={userId} />;

    case 'kepuasan-monev':
      return <KepuasanMonevPanel onSelectSurvey={openSurvey} />;

    default:
      return <KepuasanDashboardPanel surveyId={detail?.surveyId} userId={userId} onSelectSurvey={openSurvey} />;
  }
}
