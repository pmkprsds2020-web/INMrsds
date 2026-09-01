'use client';

import { useEffect, useState } from 'react';
import { CustomIndicatorDashboardPanel } from './CustomIndicatorDashboardPanel';
import { CustomIndicatorList } from './CustomIndicatorList';
import { CustomIndicatorForm } from './CustomIndicatorForm';
import { CustomIndicatorDetail } from './CustomIndicatorDetail';
import { CustomIndicatorAuditTrailPanel } from './CustomIndicatorAuditTrailPanel';

/**
 * Satu-satunya titik integrasi modul Master Indikator Mutu Custom ke
 * src/app/page.tsx, mengikuti pola IkpModule/UimuModule.
 *
 * activeTab yang dikenali (diberikan oleh DashboardSidebar):
 *   custom-ind-dashboard | custom-ind-all | custom-ind-active |
 *   custom-ind-inactive | custom-ind-unit | custom-ind-priority |
 *   custom-ind-new | custom-ind-audit
 *
 * Sengaja TERPISAH dari section "Indikator" existing (11 indikator legacy)
 * di sidebar — bukan disisipkan — supaya getSections()/IndicatorPanel.tsx
 * yang sudah ada tidak perlu diubah sama sekali (lihat README_CUSTOM_INDICATOR_MODULE.md).
 */
interface CustomIndicatorModuleProps {
  activeTab: string;
  userId: string;
  userName: string;
  activeUnit: string;
  /** true untuk role admin ATAU 'komite_mutu' di custom_indicator_roles — hak kelola master indikator. */
  isManager: boolean;
  /** true untuk role admin ATAU 'manajemen' — dipakai untuk hak approval Prioritas RS di masa depan. */
  isManagement: boolean;
  onNavigate: (tab: string) => void;
}

type DetailTarget = { indicatorId: string } | null;

export function CustomIndicatorModule({ activeTab, userId, userName, activeUnit, isManager, isManagement, onNavigate }: CustomIndicatorModuleProps) {
  const [detail, setDetail] = useState<DetailTarget>(null);

  useEffect(() => { setDetail(null); }, [activeTab]);

  if (detail) {
    return (
      <CustomIndicatorDetail
        indicatorId={detail.indicatorId}
        userId={userId}
        userName={userName}
        activeUnit={activeUnit}
        isManager={isManager}
        onBack={() => setDetail(null)}
      />
    );
  }

  switch (activeTab) {
    case 'custom-ind-dashboard':
      return <CustomIndicatorDashboardPanel onSelect={(id) => setDetail({ indicatorId: id })} />;

    case 'custom-ind-new':
      return (
        <CustomIndicatorForm
          mode="create"
          userId={userId}
          onDone={(id) => setDetail({ indicatorId: id })}
          onCancel={() => onNavigate('custom-ind-all')}
        />
      );

    case 'custom-ind-all':
      return <CustomIndicatorList scope="all" isManager={isManager} onSelect={(id) => setDetail({ indicatorId: id })} onCreateNew={() => onNavigate('custom-ind-new')} />;

    case 'custom-ind-active':
      return <CustomIndicatorList scope="active" isManager={isManager} onSelect={(id) => setDetail({ indicatorId: id })} onCreateNew={() => onNavigate('custom-ind-new')} />;

    case 'custom-ind-inactive':
      return <CustomIndicatorList scope="inactive" isManager={isManager} onSelect={(id) => setDetail({ indicatorId: id })} onCreateNew={() => onNavigate('custom-ind-new')} />;

    case 'custom-ind-unit':
      return <CustomIndicatorList scope="unit" isManager={isManager} onSelect={(id) => setDetail({ indicatorId: id })} onCreateNew={() => onNavigate('custom-ind-new')} />;

    case 'custom-ind-priority':
      return <CustomIndicatorList scope="priority_rs" isManager={isManager} onSelect={(id) => setDetail({ indicatorId: id })} onCreateNew={() => onNavigate('custom-ind-new')} />;

    case 'custom-ind-audit':
      return <CustomIndicatorAuditTrailPanel />;

    default:
      return <CustomIndicatorDashboardPanel onSelect={(id) => setDetail({ indicatorId: id })} />;
  }
}
