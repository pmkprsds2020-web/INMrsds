'use client';

import { useEffect, useState } from 'react';
import { deriveOppeAccess } from '@/types/oppe';
import { useOppeMasters, OppeLoading, OppeErrorState, OppeNoAccess } from './OppeShared';
import { OppeDashboardPanel } from './OppeDashboardPanel';
import { OppeDoctorList } from './OppeDoctorList';
import { OppeIndicatorList } from './OppeIndicatorList';
import { OppeEvaluationForm } from './OppeEvaluationForm';
import { OppeEvaluationDetail } from './OppeEvaluationDetail';
import { OppeMonitoringList } from './OppeMonitoringList';
import { OppeResultsPanel } from './OppeResultsPanel';
import { OppeFppePanel } from './OppeFppePanel';
import { OppeReportPanel, OppeExportPanel } from './OppeReportPanel';
import { OppeImportPanel } from './OppeImportPanel';
import { OppeAuditTrailPanel } from './OppeAuditTrailPanel';
import { OppeSettingsPanel } from './OppeSettingsPanel';

/**
 * Satu-satunya titik integrasi modul OPPE ke src/app/page.tsx — pola sama
 * dengan UimuModule/IkpModule. activeTab yang dikenali (dari DashboardSidebar
 * atau deep link /oppe/<halaman>):
 *   oppe-dashboard | oppe-doctors | oppe-evaluations | oppe-evaluations-new | oppe-indicators | oppe-templates
 *   oppe-monitoring | oppe-results | oppe-fppe | oppe-reports | oppe-import | oppe-export | oppe-audit | oppe-settings
 *   oppe-evaluation:<uuid> (deep link /oppe/evaluations/<id>)
 */
interface OppeModuleProps {
  activeTab: string;
  userId: string;
  userName: string;
  /** role dasar dari profiles ('user' | 'admin'). */
  role: string | null;
  /** profiles.oppe_roles: 'komite_medik' | 'evaluator' | 'dokter'. */
  oppeRoles: string[];
  onNavigate: (tab: string) => void;
}

export function OppeModule({ activeTab, userId, userName, role, oppeRoles, onNavigate }: OppeModuleProps) {
  const access = deriveOppeAccess(role, oppeRoles);
  const { masters, error, loading, reload } = useOppeMasters();
  const deepLinkEval = activeTab.startsWith('oppe-evaluation:') ? activeTab.slice('oppe-evaluation:'.length) : null;
  const [detailId, setDetailId] = useState<string | null>(deepLinkEval);
  const [creating, setCreating] = useState<{ doctorId?: string | null } | null>(activeTab === 'oppe-evaluations-new' ? {} : null);
  const [resultsDoctor, setResultsDoctor] = useState<string | null>(null);

  // Klik menu sidebar -> keluar dari tampilan detail/form.
  useEffect(() => {
    setDetailId(activeTab.startsWith('oppe-evaluation:') ? activeTab.slice('oppe-evaluation:'.length) : null);
    setCreating(activeTab === 'oppe-evaluations-new' ? {} : null);
  }, [activeTab]);

  const actor = { id: userId, name: userName };

  if (!access.hasAccess) return <OppeNoAccess />;
  if (loading && !masters) return <OppeLoading />;
  if (error || !masters) return <div className="p-4"><OppeErrorState message={error ?? 'Master data OPPE belum tersedia.'} onRetry={reload} /></div>;

  const openEvaluation = (id: string) => { setCreating(null); setDetailId(id); };

  if (detailId) {
    return (
      <OppeEvaluationDetail
        key={detailId}
        evaluationId={detailId}
        masters={masters}
        actor={actor}
        isAdmin={access.isAdmin}
        isCommittee={access.isCommittee}
        onBack={() => setDetailId(null)}
        onOpenEvaluation={openEvaluation}
      />
    );
  }

  // Dokter (tanpa peran evaluator/komite) hanya melihat hasil OPPE miliknya.
  if (!access.isEvaluator) {
    return <OppeResultsPanel masters={masters} userId={userId} doctorMode onOpenEvaluation={openEvaluation} />;
  }

  if (creating) {
    return (
      <OppeEvaluationForm
        masters={masters}
        actor={actor}
        isAdmin={access.isAdmin}
        isCommittee={access.isCommittee}
        initialDoctorId={creating.doctorId}
        onCreated={openEvaluation}
        onCancel={() => { setCreating(null); if (activeTab === 'oppe-evaluations-new') onNavigate('oppe-evaluations'); }}
      />
    );
  }

  switch (activeTab) {
    case 'oppe-doctors':
      return (
        <OppeDoctorList
          masters={masters}
          canManage={access.isCommittee}
          actor={actor}
          onCreateEvaluation={(doctorId) => setCreating({ doctorId })}
          onShowHistory={(doctorId) => { setResultsDoctor(doctorId); onNavigate('oppe-results'); }}
        />
      );
    case 'oppe-evaluations':
      return <OppeMonitoringList mode="evaluations" masters={masters} actor={actor} isAdmin={access.isAdmin} isCommittee={access.isCommittee} onOpen={openEvaluation} onCreateNew={() => setCreating({})} />;
    case 'oppe-indicators':
    case 'oppe-templates':
      return <OppeIndicatorList key={activeTab} masters={masters} canManage={access.isCommittee} actor={actor} onMastersChanged={reload} initialTab={activeTab === 'oppe-templates' ? 'templates' : 'indicators'} />;
    case 'oppe-monitoring':
      return <OppeMonitoringList mode="monitoring" masters={masters} actor={actor} isAdmin={access.isAdmin} isCommittee={access.isCommittee} onOpen={openEvaluation} onCreateNew={() => setCreating({})} />;
    case 'oppe-results':
      return <OppeResultsPanel masters={masters} userId={userId} doctorMode={false} initialDoctorId={resultsDoctor} onOpenEvaluation={openEvaluation} />;
    case 'oppe-fppe':
      return <OppeFppePanel masters={masters} canManage={access.isCommittee} actor={actor} onOpenEvaluation={openEvaluation} />;
    case 'oppe-reports':
      return <OppeReportPanel masters={masters} actor={actor} />;
    case 'oppe-import':
      return <OppeImportPanel masters={masters} actor={actor} />;
    case 'oppe-export':
      return <OppeExportPanel masters={masters} actor={actor} />;
    case 'oppe-audit':
      return <OppeAuditTrailPanel onOpenEvaluation={openEvaluation} />;
    case 'oppe-settings':
      return <OppeSettingsPanel masters={masters} isAdmin={access.isAdmin} isCommittee={access.isCommittee} actor={actor} onChanged={reload} />;
    case 'oppe-dashboard':
    default:
      return <OppeDashboardPanel masters={masters} onOpenEvaluation={openEvaluation} onNavigate={onNavigate} />;
  }
}
