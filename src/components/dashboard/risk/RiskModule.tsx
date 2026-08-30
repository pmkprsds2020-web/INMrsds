'use client';

import { useEffect, useState } from 'react';
import { RiskDashboardPanel } from './RiskDashboardPanel';
import { RiskRegisterList } from './RiskRegisterList';
import { RiskIdentificationForm } from './RiskIdentificationForm';
import { RiskDetail } from './RiskDetail';
import { RiskMatrixPanel } from './RiskMatrixPanel';
import { RiskWorklistPanel } from './RiskWorklistPanel';
import { RiskTrendComparisonPanel } from './RiskTrendComparisonPanel';
import { RiskLaporanPanel } from './RiskLaporanPanel';
import { RiskMasterDataPanel } from './RiskMasterDataPanel';
import { RiskAuditTrailPanel } from './RiskAuditTrailPanel';
import type { Risk } from '@/types/risk';

/**
 * Satu-satunya titik integrasi modul Manajemen Risiko ke src/app/page.tsx,
 * mengikuti pola persis src/components/dashboard/ikp/IkpModule.tsx, supaya
 * perubahan pada modul Risiko tidak menyentuh (dan tidak berisiko merusak)
 * logika activeTab/rendering yang sudah ada di page.tsx & DashboardSidebar.
 *
 * activeTab yang dikenali (diberikan oleh DashboardSidebar):
 *   risk-dashboard | risk-register | risk-form | risk-matrix | risk-mitigasi
 *   risk-monitoring | risk-review | risk-trend | risk-laporan | risk-master | risk-audit
 */
interface RiskModuleProps {
  activeTab: string;
  userId: string;
  userName: string;
  activeUnit: string;
  /** true untuk role manajemen/pj_mutu/direktur/admin (lihat page.tsx). */
  canReview: boolean;
  /** true HANYA untuk role='admin' — dipakai gerbang Master Data. */
  isAdmin: boolean;
  onNavigate: (tab: string) => void;
}

type DetailTarget = { riskId: string; focusTab: string } | null;
type EditTarget = Risk | null;

export function RiskModule({ activeTab, userId, userName, activeUnit, canReview, isAdmin, onNavigate }: RiskModuleProps) {
  const [detail, setDetail] = useState<DetailTarget>(null);
  const [editing, setEditing] = useState<EditTarget>(null);

  // Kalau sidebar diklik ke tab lain, keluar dari tampilan detail/edit.
  useEffect(() => { setDetail(null); setEditing(null); }, [activeTab]);

  if (editing !== null || (activeTab === 'risk-form' && !detail)) {
    return (
      <RiskIdentificationForm
        userId={userId}
        userName={userName}
        activeUnit={activeUnit}
        draft={editing}
        onDone={(id) => { setEditing(null); setDetail({ riskId: id, focusTab: 'info' }); }}
        onCancel={() => { setEditing(null); onNavigate('risk-register'); }}
      />
    );
  }

  if (detail) {
    return (
      <RiskDetail
        riskId={detail.riskId}
        userId={userId}
        userName={userName}
        canReview={canReview}
        initialTab={detail.focusTab}
        onBack={() => setDetail(null)}
        onEdit={(risk) => setEditing(risk)}
      />
    );
  }

  switch (activeTab) {
    case 'risk-dashboard':
      return <RiskDashboardPanel />;

    case 'risk-register':
      return (
        <RiskRegisterList
          onSelect={(id) => setDetail({ riskId: id, focusTab: 'info' })}
          onCreateNew={() => onNavigate('risk-form')}
        />
      );

    case 'risk-matrix':
      return <RiskMatrixPanel onSelectRisk={(id) => setDetail({ riskId: id, focusTab: 'info' })} />;

    case 'risk-mitigasi':
      return <RiskWorklistPanel mode="mitigasi" onSelectRisk={(id, tab) => setDetail({ riskId: id, focusTab: tab })} />;

    case 'risk-monitoring':
      return <RiskWorklistPanel mode="monitoring" onSelectRisk={(id, tab) => setDetail({ riskId: id, focusTab: tab })} />;

    case 'risk-review':
      return <RiskWorklistPanel mode="review" onSelectRisk={(id, tab) => setDetail({ riskId: id, focusTab: tab })} />;

    case 'risk-trend':
      return <RiskTrendComparisonPanel onSelectRisk={(id) => setDetail({ riskId: id, focusTab: 'info' })} />;

    case 'risk-laporan':
      return <RiskLaporanPanel />;

    case 'risk-master':
      return <RiskMasterDataPanel isAdmin={isAdmin} />;

    case 'risk-audit':
      return <RiskAuditTrailPanel />;

    default:
      return <RiskDashboardPanel />;
  }
}
