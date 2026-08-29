'use client';

import { useEffect, useState } from 'react';
import { IkpDashboardPanel } from './IkpDashboardPanel';
import { IkpReportForm } from './IkpReportForm';
import { IkpIncidentList } from './IkpIncidentList';
import { IkpIncidentDetail } from './IkpIncidentDetail';
import { IkpWorklistPanel } from './IkpWorklistPanel';
import { IkpLaporanPanel } from './IkpLaporanPanel';
import { IkpMasterDataPanel } from './IkpMasterDataPanel';
import { IkpAuditTrailPanel } from './IkpAuditTrailPanel';

/**
 * Satu-satunya titik integrasi modul IKP ke src/app/page.tsx, supaya
 * perubahan pada modul IKP tidak menyentuh (dan tidak berisiko merusak)
 * logika activeTab/rendering yang sudah ada di page.tsx & DashboardSidebar.
 *
 * activeTab yang dikenali (diberikan oleh DashboardSidebar):
 *   ikp-dashboard | ikp-form | ikp-list | ikp-investigasi | ikp-analisis
 *   ikp-tindak-lanjut | ikp-laporan | ikp-master | ikp-audit
 */
interface IkpModuleProps {
  activeTab: string;
  userId: string;
  userName: string;
  activeUnit: string;
  /** true untuk role verifikator/tim_mutu/pimpinan/admin (lihat page.tsx). */
  canReview: boolean;
  /** true HANYA untuk role='admin' — dipakai gerbang Manajemen Pengguna. */
  isAdmin: boolean;
  onNavigate: (tab: string) => void;
}

type DetailTarget = { incidentId: string; focusTab: string } | null;

export function IkpModule({ activeTab, userId, userName, activeUnit, canReview, isAdmin, onNavigate }: IkpModuleProps) {
  const [detail, setDetail] = useState<DetailTarget>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

  // Kalau sidebar diklik ke tab lain, keluar dari tampilan detail.
  useEffect(() => { setDetail(null); }, [activeTab]);

  if (detail) {
    return (
      <IkpIncidentDetail
        incidentId={detail.incidentId}
        userId={userId}
        userName={userName}
        canReview={canReview}
        initialTab={detail.focusTab}
        onBack={() => setDetail(null)}
      />
    );
  }

  switch (activeTab) {
    case 'ikp-dashboard':
      return <IkpDashboardPanel />;

    case 'ikp-form':
      return (
        <IkpReportForm
          userId={userId}
          userName={userName}
          activeUnit={activeUnit}
          onDone={(id) => setDetail({ incidentId: id, focusTab: 'ringkasan' })}
          onCancel={() => onNavigate('ikp-list')}
        />
      );

    case 'ikp-list':
      return (
        <IkpIncidentList
          onSelect={(id) => setDetail({ incidentId: id, focusTab: 'ringkasan' })}
          onCreateNew={() => onNavigate('ikp-form')}
        />
      );

    case 'ikp-investigasi':
      return <IkpWorklistPanel mode="investigasi" onSelectIncident={(id, tab) => setDetail({ incidentId: id, focusTab: tab })} />;

    case 'ikp-analisis':
      return <IkpWorklistPanel mode="analisis" onSelectIncident={(id, tab) => setDetail({ incidentId: id, focusTab: tab })} />;

    case 'ikp-tindak-lanjut':
      return <IkpWorklistPanel mode="tindak_lanjut" onSelectIncident={(id, tab) => setDetail({ incidentId: id, focusTab: tab })} />;

    case 'ikp-laporan':
      return <IkpLaporanPanel />;

    case 'ikp-master':
      return <IkpMasterDataPanel isAdmin={isAdmin} currentUserId={userId} />;

    case 'ikp-audit':
      return <IkpAuditTrailPanel />;

    default:
      return <IkpDashboardPanel />;
  }
}
