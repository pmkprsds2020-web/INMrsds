'use client';

import { useEffect, useState } from 'react';
import { UimuDashboardPanel } from './UimuDashboardPanel';
import { UimuForm } from './UimuForm';
import { UimuList } from './UimuList';
import { UimuDetail } from './UimuDetail';
import { UimuMasterPanel } from './UimuMasterPanel';
import { UimuLaporanPanel } from './UimuLaporanPanel';
import { UimuAuditTrailPanel } from './UimuAuditTrailPanel';

/**
 * Satu-satunya titik integrasi modul UIMU (Usulan Indikator Mutu Unit) ke
 * src/app/page.tsx, mengikuti pola src/components/dashboard/ikp/IkpModule.tsx
 * supaya perubahan pada modul ini tidak menyentuh logika activeTab/rendering
 * yang sudah ada di page.tsx & DashboardSidebar.
 *
 * activeTab yang dikenali (diberikan oleh DashboardSidebar):
 *   uimu-dashboard | uimu-form | uimu-list | uimu-review | uimu-telaah
 *   uimu-approval | uimu-master | uimu-laporan | uimu-audit
 */
interface UimuModuleProps {
  activeTab: string;
  userId: string;
  userName: string;
  activeUnit: string;
  /** Peran mentah dari profiles.uimu_roles ('kepala_unit' | 'komite_mutu' | 'manajemen'). */
  uimuRoles: string[];
  /** true untuk role admin ATAU salah satu dari uimuRoles (lihat page.tsx). Dipakai gerbang umum "punya akses reviewer". */
  canReview: boolean;
  /** true HANYA untuk role='admin' — dipakai gerbang Master Unit & Manajemen Pengguna. */
  isAdmin: boolean;
  onNavigate: (tab: string) => void;
}

type DetailTarget = { proposalId: string; focusTab?: string } | null;

export function UimuModule({ activeTab, userId, userName, activeUnit, uimuRoles, canReview, isAdmin, onNavigate }: UimuModuleProps) {
  const [detail, setDetail] = useState<DetailTarget>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

  // Kalau sidebar diklik ke tab lain, keluar dari tampilan detail/edit.
  useEffect(() => { setDetail(null); setEditingDraftId(null); }, [activeTab]);

  const isKepalaUnit = isAdmin || uimuRoles.includes('kepala_unit');
  const isKomiteMutu = isAdmin || uimuRoles.includes('komite_mutu');
  const isManajemen = isAdmin || uimuRoles.includes('manajemen');

  if (editingDraftId) {
    return (
      <UimuForm
        userId={userId}
        userName={userName}
        activeUnit={activeUnit}
        proposalId={editingDraftId}
        onDone={(id) => { setEditingDraftId(null); setDetail({ proposalId: id }); }}
        onCancel={() => { setEditingDraftId(null); onNavigate('uimu-list'); }}
      />
    );
  }

  if (detail) {
    return (
      <UimuDetail
        proposalId={detail.proposalId}
        userId={userId}
        userName={userName}
        isKepalaUnit={isKepalaUnit}
        isKomiteMutu={isKomiteMutu}
        isManajemen={isManajemen}
        isAdmin={isAdmin}
        onBack={() => setDetail(null)}
        onEdit={(id) => setEditingDraftId(id)}
      />
    );
  }

  switch (activeTab) {
    case 'uimu-dashboard':
      return <UimuDashboardPanel onSelect={(id) => setDetail({ proposalId: id })} />;

    case 'uimu-form':
      return (
        <UimuForm
          userId={userId}
          userName={userName}
          activeUnit={activeUnit}
          onDone={(id) => setDetail({ proposalId: id })}
          onCancel={() => onNavigate('uimu-list')}
        />
      );

    case 'uimu-list':
      return (
        <UimuList
          userId={userId}
          mode="mine"
          onSelect={(id) => setDetail({ proposalId: id })}
          onCreateNew={() => onNavigate('uimu-form')}
          onEditDraft={(id) => setEditingDraftId(id)}
        />
      );

    case 'uimu-review':
      return (
        <UimuList
          userId={userId}
          mode="review_unit"
          canReview={canReview}
          onSelect={(id) => setDetail({ proposalId: id })}
          onCreateNew={() => onNavigate('uimu-form')}
        />
      );

    case 'uimu-telaah':
      return (
        <UimuList
          userId={userId}
          mode="telaah_mutu"
          canReview={canReview}
          onSelect={(id) => setDetail({ proposalId: id })}
          onCreateNew={() => onNavigate('uimu-form')}
        />
      );

    case 'uimu-approval':
      return (
        <UimuList
          userId={userId}
          mode="approval"
          canReview={canReview}
          onSelect={(id) => setDetail({ proposalId: id })}
          onCreateNew={() => onNavigate('uimu-form')}
        />
      );

    case 'uimu-master':
      return <UimuMasterPanel isAdmin={isAdmin} currentUserId={userId} onSelectProposal={(id) => setDetail({ proposalId: id })} />;

    case 'uimu-laporan':
      return <UimuLaporanPanel />;

    case 'uimu-audit':
      return <UimuAuditTrailPanel />;

    default:
      return <UimuDashboardPanel onSelect={(id) => setDetail({ proposalId: id })} />;
  }
}
