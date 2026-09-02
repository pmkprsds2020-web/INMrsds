'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import LoginPage from '@/components/auth/LoginPage';
import SignupPage from '@/components/auth/SignupPage';
import ForgotPasswordPage from '@/components/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/components/auth/ResetPasswordPage';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { IndicatorPanel } from '@/components/dashboard/IndicatorPanel';
import { TrenBulananPanel } from '@/components/dashboard/TrenBulananPanel';
import { KepatuhanUnitPanel } from '@/components/dashboard/KepatuhanUnitPanel';
import { AuditTrailPanel } from '@/components/dashboard/AuditTrailPanel';
import { DashboardOverviewPanel } from '@/components/dashboard/DashboardOverviewPanel';
import { UserProfilePanel } from '@/components/dashboard/UserProfilePanel';
import { UnitChangeModal } from '@/components/dashboard/UnitChangeModal';
import { NotificationPanel } from '@/components/dashboard/NotificationPanel';
import { RingkasanLaporanPanel } from '@/components/dashboard/RingkasanLaporanPanel';
import { DashboardFooter } from '@/components/dashboard/DashboardFooter';
import { AiInsightsPanel } from '@/components/dashboard/AiInsightsPanel';
import { ActivityHeatmap } from '@/components/dashboard/ActivityHeatmap';
import { DataQualityPanel } from '@/components/dashboard/DataQualityPanel';
import { KeyboardShortcutsDialog } from '@/components/dashboard/KeyboardShortcutsDialog';
import { SettingsPanel } from '@/components/dashboard/SettingsPanel';
import { ComplianceTimeline } from '@/components/dashboard/ComplianceTimeline';
import { QuickActionsWidget } from '@/components/dashboard/QuickActionsWidget';
import { CommandPalette } from '@/components/dashboard/CommandPalette';
import { DataExportTemplates } from '@/components/dashboard/DataExportTemplates';
import { IkpModule } from '@/components/dashboard/ikp/IkpModule';
import { RiskModule } from '@/components/dashboard/risk/RiskModule';
import { BudayaModule } from '@/components/dashboard/budaya/BudayaModule';
import { UimuModule } from '@/components/dashboard/uimu/UimuModule';
import { CustomIndicatorModule } from '@/components/dashboard/custom-indicators/CustomIndicatorModule';
import { UnitIndicatorModule } from '@/components/dashboard/custom-indicators/UnitIndicatorModule';
import { KepuasanModule } from '@/components/dashboard/kepuasan/KepuasanModule';
import { PriorityIndicatorModule } from '@/components/dashboard/custom-indicators/PriorityIndicatorModule';
import { useKeyboardShortcuts, getDashboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  type IndicatorType,
  type IndicatorEntry,
  type AuditLogEntry,
  UNIT_MAP,
  INDICATORS,
  ACCESS_RULES,
} from '@/types';
import {
  createEntry,
  updateEntry,
  deleteEntry,
  getFilteredEntries,
  getAllEntriesForCompliance,
  batchImportEntries,
  addAuditLog as firestoreAddAuditLog,
  getRecentAuditLogs,
  subscribeToAuditLogs,
  subscribeToAllIndicators,
  clearAuditLogs as firestoreClearAuditLogs,
  type AuditLogDocument,
} from '@/lib/supabaseData';
import {
  type TanganEntry,
  type VisiteEntry,
  type IdentitasEntry,
  type ApdEntry,
  type JatuhEntry,
  type ScEntry,
  type WtrjEntry,
  type OpEntry,
  type LabEntry,
  type FornasEntry,
  type CpEntry,
} from '@/types';
import { createDefaultEntry, calculateStats, todayStr, isVisitePatuh, timeDiffMinutes } from '@/lib/calculations';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Loader2, Mail, X, Keyboard } from 'lucide-react';

// ──────────────────────────────────────────────
// Auth wrapper - shows auth pages or dashboard
// ──────────────────────────────────────────────

type AuthPage = 'login' | 'signup' | 'forgot' | 'reset';

function AppContent() {
  const { user, loading, unitId, logout } = useAuth();
  const [authPage, setAuthPage] = useState<AuthPage>('login');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={authPage}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {authPage === 'signup' && <SignupPage onNavigate={(p) => setAuthPage(p)} />}
          {authPage === 'forgot' && <ForgotPasswordPage onNavigate={(p) => setAuthPage(p)} />}
          {authPage === 'reset' && <ResetPasswordPage onNavigate={(p) => setAuthPage(p)} />}
          {authPage === 'login' && <LoginPage onNavigate={(p) => setAuthPage(p)} />}
        </motion.div>
      </AnimatePresence>
    );
  }

  return <Dashboard />;
}

// ──────────────────────────────────────────────
// Main Dashboard
// ──────────────────────────────────────────────

function Dashboard() {
  const { user, unitId, role, ikpRoles, riskRoles, budayaRoles, uimuRoles, customIndicatorRoles, logout, sendVerification } = useAuth();

  // Hak akses reviewer modul IKP (verifikator/tim_mutu/pimpinan/admin) —
  // lihat src/components/dashboard/ikp/. Tidak memengaruhi hak akses modul
  // INM lain, yang masih memakai `role` seperti sebelumnya.
  const canReviewIkp = role === 'admin' || (ikpRoles ?? []).some((r) => ['verifikator', 'tim_mutu', 'pimpinan'].includes(r));
  const isIkpAdmin = role === 'admin';

  // Hak akses reviewer modul Manajemen Risiko (manajemen/pj_mutu/direktur/admin) —
  // lihat src/components/dashboard/risk/. Tidak memengaruhi hak akses modul
  // INM/IKP lain, yang masih memakai `role`/`ikpRoles` seperti sebelumnya.
  const canReviewRisk = role === 'admin' || (riskRoles ?? []).some((r) => ['manajemen', 'pj_mutu', 'direktur'].includes(r));
  const isRiskAdmin = role === 'admin';

  // Hak akses reviewer modul Survey Budaya Keselamatan Pasien
  // (komite_mutu/manajemen/kepala_unit/admin) — lihat
  // src/components/dashboard/budaya/. Tidak memengaruhi hak akses modul
  // INM/IKP/Risiko lain, yang masih memakai role/ikpRoles/riskRoles seperti
  // sebelumnya.
  const canReviewBudaya = role === 'admin' || (budayaRoles ?? []).some((r) => ['komite_mutu', 'manajemen', 'kepala_unit'].includes(r));
  const isBudayaAdmin = role === 'admin';
  // Sub-hak yang lebih sempit dari canReviewBudaya: hanya komite_mutu/admin
  // yang boleh MEMBUAT/MENGUBAH survei (poin BE — Manajemen & Kepala Unit
  // hanya punya hak lihat/approval/tindak lanjut, bukan kelola survei),
  // sesuai kebijakan RLS budaya_surveys_write di migration_budaya.sql.
  const canManageBudayaSurvey = role === 'admin' || (budayaRoles ?? []).includes('komite_mutu');

  // Hak akses modul Survey Kepuasan Pasien. MVP: admin saja boleh
  // membuat/mengelola survei — lihat README_KEPUASAN_MODULE.md untuk cara
  // menambah hak granular lewat profiles.kepuasan_roles bila dibutuhkan.
  const canManageKepuasanSurvey = role === 'admin';

  // Hak akses modul Usulan Indikator Mutu Unit (kepala_unit/komite_mutu/
  // manajemen/admin) — lihat src/components/dashboard/uimu/. Tidak
  // memengaruhi hak akses modul lain. Pemeriksaan tahap yang lebih rinci
  // (siapa boleh review unit vs telaah komite vs persetujuan akhir)
  // dilakukan di dalam UimuModule berdasarkan prop `uimuRoles` mentah,
  // konsisten dengan enforcement RLS di migration_usulan_indikator.sql.
  const canReviewUimu = role === 'admin' || (uimuRoles ?? []).some((r) => ['kepala_unit', 'komite_mutu', 'manajemen'].includes(r));
  const isUimuAdmin = role === 'admin';

  // Hak akses modul Master Indikator Mutu Custom (komite_mutu/admin dapat
  // kelola master; manajemen punya hak approval Prioritas RS) — lihat
  // src/components/dashboard/custom-indicators/. Tidak memengaruhi modul lain.
  const isCustomIndicatorManager = role === 'admin' || (customIndicatorRoles ?? []).includes('komite_mutu');
  const isCustomIndicatorManagement = role === 'admin' || (customIndicatorRoles ?? []).includes('manajemen');

  // Active tab state
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [activeUnit, setActiveUnit] = useState<string>(unitId || 'all');

  // Data state
  const [entries, setEntries] = useState<IndicatorEntry[]>([]);
  const [allEntries, setAllEntries] = useState<IndicatorEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Date filters per indicator
  const [dateFilters, setDateFilters] = useState<Record<string, { start: string; end: string }>>({});

  // Audit trail
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Realtime subscription ref
  const realtimeUnsubRef = useRef<(() => void) | null>(null);
  const auditUnsubRef = useRef<(() => void) | null>(null);

  // User profile panel
  const [profileOpen, setProfileOpen] = useState(false);

  // Unit change modal
  const [showUnitModal, setShowUnitModal] = useState(false);

  // Notification panel
  const [notificationOpen, setNotificationOpen] = useState(false);

  // Mobile sidebar
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Email verification dismiss
  const [verifyDismissed, setVerifyDismissed] = useState(false);

  // Email verification sending state
  const [verifySending, setVerifySending] = useState(false);

  // Keyboard shortcuts
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);

  // Settings panel
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Command palette
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Sync unit from auth
  useEffect(() => {
    if (unitId) {
      setActiveUnit(unitId);
    }
  }, [unitId]);

  // Initialize date filters — default to no filter so all imported data is visible
  useEffect(() => {
    const initial: Record<string, { start: string; end: string }> = {};
    INDICATORS.forEach(ind => {
      initial[ind.id] = {
        start: '',
        end: '',
      };
    });
    setDateFilters(initial);
  }, []);

  // Current date filter for active tab (avoids unnecessary reloads from other tab filters)
  const currentDateFilter = dateFilters[activeTab] || { start: '', end: '' };

  // Load entries when tab or filter changes
  useEffect(() => {
    let cancelled = false;
    async function loadEntries() {
      if (!activeTab || activeTab === 'tren' || activeTab === 'kepatuhan' || activeTab === 'overview' || activeTab === 'ringkasan' || activeTab === 'ai-insights' || activeTab === 'activity-heatmap' || activeTab === 'data-quality' || activeTab === 'compliance-timeline' || activeTab === 'export-templates' || activeTab.startsWith('ikp-') || activeTab.startsWith('risk-') || activeTab.startsWith('budaya-') || activeTab.startsWith('kepuasan-') || activeTab.startsWith('uimu-') || activeTab.startsWith('custom-ind-') || activeTab.startsWith('unit-ind-') || activeTab.startsWith('priority-ind-')) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const type = activeTab as IndicatorType;
        const filter = currentDateFilter;
        const data = await getFilteredEntries(
          type,
          activeUnit === 'all' ? null : activeUnit,
          filter.start || undefined,
          filter.end || undefined
        );
        if (!cancelled) setEntries(data);
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading entries:', err);
          setEntries([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadEntries();
    return () => { cancelled = true; };
  }, [activeTab, activeUnit, currentDateFilter]);

  // Load all entries for compliance check, trend analysis, AI insights, and overview
  // This runs on initial load and whenever the tab changes to an analytics/overview tab
  useEffect(() => {
    let cancelled = false;
    const shouldLoad = activeTab === 'overview' || activeTab === 'kepatuhan' || activeTab === 'tren' || activeTab === 'ai-insights' || activeTab === 'activity-heatmap' || activeTab === 'data-quality' || activeTab === 'compliance-timeline' || activeTab === 'ringkasan';
    if (shouldLoad) {
      getAllEntriesForCompliance().then(data => {
        if (!cancelled) setAllEntries(data);
      }).catch(() => {
        if (!cancelled) setAllEntries([]);
      });
    }
    return () => { cancelled = true; };
  }, [activeTab]);

  // Group allEntries by indicator type for TrenBulananPanel
  const trendEntries = useMemo(() => {
    const grouped: Partial<Record<IndicatorType, IndicatorEntry[]>> = {};
    for (const e of allEntries) {
      const type = e.indicatorType as IndicatorType;
      if (!grouped[type]) grouped[type] = [];
      grouped[type]!.push(e);
    }
    return grouped;
  }, [allEntries]);

  // Check access control
  const accessBlocked = useMemo(() => {
    if (!activeUnit || activeUnit === 'all') return false;
    const rule = ACCESS_RULES[activeTab];
    if (!rule) return false;
    return !rule.owners.includes(activeUnit);
  }, [activeTab, activeUnit]);

  const blockReason = useMemo(() => {
    if (!accessBlocked) return '';
    const rule = ACCESS_RULES[activeTab];
    return rule?.reason || 'Anda tidak memiliki akses ke indikator ini.';
  }, [accessBlocked, activeTab]);

  // Add audit log entry (persists to Firestore)
  const addAuditLog = useCallback((type: AuditLogEntry['type'], msg: string, badge: string) => {
    const entry: AuditLogEntry = {
      id: Date.now().toString(),
      type,
      msg,
      badge,
      ts: new Date().toLocaleString('id-ID'),
      userId: user?.uid,
      unitId: activeUnit,
    };
    setAuditLogs(prev => [entry, ...prev].slice(0, 200));

    // Persist to Firestore (fire-and-forget)
    firestoreAddAuditLog({
      type,
      msg,
      badge,
      ts: entry.ts,
      userId: user?.uid,
      unitId: activeUnit,
    }).catch(err => console.error('Failed to persist audit log:', err));
  }, [user, activeUnit]);

  // Entry counts for sidebar — computed from allEntries for accuracy
  const entryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    INDICATORS.forEach(ind => {
      counts[ind.id] = 0;
    });
    // Use allEntries for counts so all indicators show their entry count
    if (allEntries.length > 0) {
      const grouped: Partial<Record<string, number>> = {};
      for (const e of allEntries) {
        const t = e.indicatorType;
        if (!grouped[t]) grouped[t] = 0;
        grouped[t]!++;
      }
      for (const [type, count] of Object.entries(grouped)) {
        if (type in counts) counts[type] = count;
      }
    }
    // Override with current tab's filtered entries for accuracy
    if (activeTab !== 'tren' && activeTab !== 'kepatuhan' && activeTab !== 'overview' && activeTab !== 'ringkasan' && activeTab !== 'ai-insights' && activeTab !== 'activity-heatmap' && activeTab !== 'data-quality' && activeTab !== 'compliance-timeline' && activeTab !== 'export-templates' && !activeTab.startsWith('ikp-') && !activeTab.startsWith('risk-') && !activeTab.startsWith('uimu-') && !activeTab.startsWith('custom-ind-') && !activeTab.startsWith('unit-ind-') && !activeTab.startsWith('priority-ind-')) {
      counts[activeTab] = entries.length;
    }
    return counts;
  }, [activeTab, entries.length, allEntries]);

  // ── Compliance data for sidebar status dots ──
  const complianceData = useMemo(() => {
    const data: Record<string, { pct: number; ok: boolean }> = {};
    // Group allEntries by indicator type
    const grouped: Partial<Record<string, IndicatorEntry[]>> = {};
    for (const e of allEntries) {
      const t = e.indicatorType;
      if (!grouped[t]) grouped[t] = [];
      grouped[t]!.push(e);
    }
    for (const ind of INDICATORS) {
      const typeEntries = grouped[ind.id] || [];
      if (typeEntries.length === 0) continue;
      const stats = calculateStats(ind.id, typeEntries);
      data[ind.id] = { pct: stats.pct, ok: stats.ok };
    }
    return data;
  }, [allEntries]);

  // ── Real-time indicator data subscription ──────────────
  useEffect(() => {
    let cancelled = false;
    const unsub = subscribeToAllIndicators(
      activeUnit === 'all' ? null : activeUnit,
      (update) => {
        if (cancelled) return;
        // Build a set of document IDs from this update for efficient lookup
        const updateDocIds = new Set(update.entries.map(e => e.id));

        // If the update is for the currently viewed indicator, refresh entries
        if (update.indicatorType === activeTab) {
          const filter = dateFilters[activeTab] || { start: '', end: '' };
          let filtered = update.entries;
          if (filter.start) filtered = filtered.filter(e => (e.date || '') >= filter.start);
          if (filter.end) filtered = filtered.filter(e => (e.date || '') <= filter.end);
          setEntries(filtered);
        }
        // Always update allEntries — merge by document ID to avoid duplicates
        setAllEntries(prev => {
          // Remove entries whose IDs are in the update (they'll be replaced)
          const updated = prev.filter(e => !updateDocIds.has(e.id));
          // Also remove entries of this indicatorType from the same units that are in the update
          // (handles the case where docs were deleted)
          const updateUnitIds = new Set(update.entries.map(e => e.unitId).filter(Boolean));
          const final = updated.filter(e =>
            !(e.indicatorType === update.indicatorType && updateUnitIds.has(e.unitId) && !updateDocIds.has(e.id))
          );
          return [...final, ...update.entries];
        });
      },
      (error) => {
        console.error('Real-time subscription error:', error);
      }
    );
    realtimeUnsubRef.current = unsub;
    return () => {
      cancelled = true;
      unsub();
      realtimeUnsubRef.current = null;
    };
  }, [activeUnit]); // Only resubscribe when unit changes

  // ── Real-time audit trail subscription ───────────────────
  useEffect(() => {
    const unsub = subscribeToAuditLogs((docs) => {
      const logs: AuditLogEntry[] = docs.map(d => ({
        id: d.id || Date.now().toString(),
        type: d.type,
        msg: d.msg,
        badge: d.badge,
        ts: d.ts,
        userId: d.userId,
        unitId: d.unitId,
      }));
      setAuditLogs(logs);
    });
    auditUnsubRef.current = unsub;
    return () => {
      unsub();
      auditUnsubRef.current = null;
    };
  }, []);

  // ── CRUD Handlers ──────────────────────────────

  const handleAddEntry = useCallback(async (entry: Omit<IndicatorEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    const targetUnit = entry.unitId || activeUnit;
    if (!targetUnit || targetUnit === 'all') {
      throw new Error('Pilih unit terlebih dahulu untuk menambah data');
    }
    // Ensure createdBy is always set to the current user for RLS compliance
    const entryWithOwner = {
      ...entry,
      createdBy: (entry as Record<string, unknown>).createdBy || user?.uid || '',
    };
    const id = await createEntry(targetUnit, entryWithOwner);
    addAuditLog('input', `Data ${entry.indicatorType} ditambahkan oleh unit ${UNIT_MAP[targetUnit]?.label || targetUnit}`, 'Input Data');
    // Refresh local state
    const newEntry = { ...entry, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as IndicatorEntry;
    setEntries(prev => [newEntry, ...prev]);
    setAllEntries(prev => [newEntry, ...prev]);
  }, [activeUnit, addAuditLog]);

  const handleUpdateEntry = useCallback(async (id: string, data: Partial<IndicatorEntry>) => {
    // Find the entry's unit
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    const targetUnit = entry.unitId || activeUnit;
    if (!targetUnit || targetUnit === 'all') return;
    await updateEntry(targetUnit, id, data);
    // Update local state for both entries and allEntries
    const updatedEntry = { ...entry, ...data, updatedAt: new Date().toISOString() } as IndicatorEntry;
    setEntries(prev => prev.map(e => e.id === id ? updatedEntry : e));
    setAllEntries(prev => prev.map(e => e.id === id ? updatedEntry : e));
  }, [entries, activeUnit]);

  const handleDeleteEntry = useCallback(async (id: string) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    const targetUnit = entry.unitId || activeUnit;
    if (!targetUnit || targetUnit === 'all') return;
    await deleteEntry(targetUnit, id);
    setEntries(prev => prev.filter(e => e.id !== id));
    setAllEntries(prev => prev.filter(e => e.id !== id));
  }, [entries, activeUnit]);

  const handleImport = useCallback(async (importEntries: Omit<IndicatorEntry, 'id' | 'createdAt' | 'updatedAt'>[]) => {
    const targetUnit = activeUnit;
    if (!targetUnit || targetUnit === 'all') {
      throw new Error('Pilih unit terlebih dahulu untuk import data');
    }
    // Ensure createdBy is always set to the current user for RLS compliance
    const entriesWithOwner = importEntries.map(entry => ({
      ...entry,
      createdBy: (entry as Record<string, unknown>).createdBy || user?.uid || '',
    }));
    const count = await batchImportEntries(targetUnit, entriesWithOwner);
    addAuditLog('input', `Import ${count} baris data oleh unit ${UNIT_MAP[targetUnit]?.label || targetUnit}`, 'Import Excel');
    // Wait briefly for Firestore to propagate writes, then refresh
    await new Promise(resolve => setTimeout(resolve, 500));
    // Refresh entries for current tab
    const type = activeTab as IndicatorType;
    const filter = dateFilters[type] || { start: '', end: '' };
    const data = await getFilteredEntries(type, targetUnit === 'all' ? null : targetUnit, filter.start || undefined, filter.end || undefined);
    setEntries(data);
    // Also refresh allEntries for overview/compliance
    try {
      const allData = await getAllEntriesForCompliance();
      setAllEntries(allData);
    } catch { /* non-critical */ }
  }, [activeUnit, activeTab, dateFilters, addAuditLog]);

  const handleDateFilterChange = useCallback((filter: { start: string; end: string }) => {
    setDateFilters(prev => ({
      ...prev,
      [activeTab]: filter,
    }));
  }, [activeTab]);

  // ── Export Excel handler ──────────────────────
  const handleExportExcel = useCallback(async () => {
    // Dynamic import of xlsx
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // For each indicator, create a sheet
    for (const ind of INDICATORS) {
      try {
        const filter = dateFilters[ind.id] || { start: '', end: '' };
        const data = await getFilteredEntries(
          ind.id,
          activeUnit === 'all' ? null : activeUnit,
          filter.start || undefined,
          filter.end || undefined
        );
        if (data.length === 0) continue;

        const rows = data.map((e, idx) => {
          const base: Record<string, unknown> = {
            'No': idx + 1,
            'Tanggal': e.date || '',
            'Unit': e.unitId || '',
          };
          // Add type-specific fields
          switch (e.indicatorType) {
            case 'tangan': {
              const t = e as TanganEntry;
              Object.assign(base, {
                'Petugas': t.staff, 'Observer': t.observer, 'Ruangan': t.room,
                'M1': t.m1 ? 'Ya' : 'Tidak', 'M2': t.m2 ? 'Ya' : 'Tidak', 'M3': t.m3 ? 'Ya' : 'Tidak',
                'M4': t.m4 ? 'Ya' : 'Tidak', 'M5': t.m5 ? 'Ya' : 'Tidak',
                'Metode': t.method, 'Patuh': t.patuh === true ? 'Ya' : t.patuh === false ? 'Tidak' : '—',
              });
              break;
            }
            case 'visite': {
              const v = e as VisiteEntry;
              Object.assign(base, { 'Dokter': v.doctor, 'Waktu': v.time, 'Patuh': isVisitePatuh(v.time) ? 'Ya' : 'Tidak' });
              break;
            }
            case 'identitas': {
              const i = e as IdentitasEntry;
              Object.assign(base, { 'Petugas': i.staff, 'Observer': i.observer, 'Ruangan': i.room, 'Nama Pasien': i.name, 'No RM': i.rm, 'Pelayanan': i.service, 'Cek Nama': i.nama ? 'Ya' : 'Tidak', 'Cek Tgl': i.tgl ? 'Ya' : 'Tidak' });
              break;
            }
            case 'apd': {
              const a = e as ApdEntry;
              Object.assign(base, { 'Ruangan': a.room, 'Petugas': a.staff, 'Kepatuhan': a.comp });
              break;
            }
            case 'jatuh': {
              const j = e as JatuhEntry;
              Object.assign(base, { 'No RM': j.rm, 'Awal': j.awal ? 'Ya' : 'Tidak', 'Reassessment': j.re ? 'Ya' : 'Tidak', 'Intervensi': j.inv ? 'Ya' : 'Tidak', 'Cedera': j.cedera ? 'Ya' : 'Tidak' });
              break;
            }
            case 'sc': {
              const s = e as ScEntry;
              Object.assign(base, { 'No RM': s.rm, 'Diagnosis': s.diag, '\u226430 Menit': s.ok ? 'Ya' : 'Tidak' });
              break;
            }
            case 'wtrj': {
              const w = e as WtrjEntry;
              Object.assign(base, { 'No RM': w.rm, 'Dokter/Poli': w.doc, 'Pendaftaran': w.t1, 'Dilayani': w.t2, 'Selisih (mnt)': timeDiffMinutes(w.t1, w.t2), '>60 Mnt': w.st_checked ? 'Ya' : 'Tidak' });
              break;
            }
            case 'op': {
              const o = e as OpEntry;
              Object.assign(base, { 'No RM': o.rm, 'Jadwal': o.t1, 'Aktual': o.t2, 'Selisih (mnt)': timeDiffMinutes(o.t1, o.t2), 'Tertunda': o.tertunda ? 'Ya' : 'Tidak', 'Alasan': o.r });
              break;
            }
            case 'lab': {
              const l = e as LabEntry;
              Object.assign(base, { 'No RM': l.rm, 'Pemeriksaan': l.exam, 'Keluar Hasil': l.t1, 'Diterima': l.t2, '\u226430 Mnt': l.num ? 'Ya' : 'Tidak' });
              break;
            }
            case 'fornas': {
              const f = e as FornasEntry;
              Object.assign(base, { 'R/Sesuai': f.num, 'R/Tidak Sesuai': f.non, 'Keterangan': f.note });
              break;
            }
            case 'cp': {
              const c = e as CpEntry;
              Object.assign(base, { 'Nama Pasien': c.name, 'No RM': c.rm, 'Diagnosis': c.diag, 'Var Terapi': c.vTerapi, 'Var Lab': c.vLab, 'Var Rad': c.vRad, 'Var Lain': c.vLain, 'Ket Lain': c.vLainKet, 'Perawat': c.perawat, 'Farmasi': c.farmasi, 'Gizi': c.gizi, 'LOS': c.los, 'Keterangan': c.ket });
              break;
            }
          }
          return base;
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, ind.label.slice(0, 31));
      } catch { /* skip */ }
    }

    // Summary sheet
    const summary: Record<string, unknown>[] = [];
    for (const ind of INDICATORS) {
      try {
        const filter = dateFilters[ind.id] || { start: '', end: '' };
        const data = await getFilteredEntries(ind.id, activeUnit === 'all' ? null : activeUnit, filter.start || undefined, filter.end || undefined);
        const stats = calculateStats(ind.id, data);
        summary.push({
          'Indikator': ind.label,
          'Target': ind.targetLabel,
          'Numerator': stats.num,
          'Denominator': stats.den,
          'Capaian (%)': stats.pct,
          'Status': stats.ok ? 'MENCAPAI TARGET' : 'BELUM MENCAPAI',
        });
      } catch { /* skip */ }
    }

    if (summary.length > 0) {
      const ws = XLSX.utils.json_to_sheet(summary);
      XLSX.utils.book_append_sheet(wb, ws, 'RINGKASAN');
    }

    XLSX.writeFile(wb, `MutuRS_${todayStr()}.xlsx`);
  }, [activeUnit, dateFilters]);

  // ── Clear audit logs handler (persists clear to Firestore) ──
  const handleClearAuditLogs = useCallback(async () => {
    setAuditLogs([]);
    try {
      await firestoreClearAuditLogs();
    } catch (err) {
      console.error('Failed to clear audit logs from Firestore:', err);
    }
  }, []);

  // ── Logout handler ────────────────────────────
  const handleLogout = useCallback(async () => {
    addAuditLog('login', `Logout dari unit ${UNIT_MAP[activeUnit]?.label || activeUnit}`, 'Logout');
    // Unsubscribe from realtime listeners
    if (realtimeUnsubRef.current) realtimeUnsubRef.current();
    if (auditUnsubRef.current) auditUnsubRef.current();
    await logout();
  }, [logout, activeUnit, addAuditLog]);

  // ── Tab change with access control ────────────
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    // Check if access should be blocked
    if (activeUnit && activeUnit !== 'all') {
      const rule = ACCESS_RULES[tab];
      if (rule && !rule.owners.includes(activeUnit)) {
        addAuditLog('block', `Unit ${UNIT_MAP[activeUnit]?.label || activeUnit} mencoba mengakses ${rule.label} — akses diblokir`, 'Akses Diblokir');
      }
    }
  }, [activeUnit, addAuditLog]);

  // ── Navigate from overview to indicator ──────
  const handleNavigateToIndicator = useCallback((type: IndicatorType) => {
    setActiveTab(type);
  }, []);

  // ── Keyboard shortcuts ──────────────────────
  useKeyboardShortcuts({
    shortcuts: getDashboardShortcuts({
      onAddNew: () => {
        if (activeTab !== 'overview' && activeTab !== 'tren' && activeTab !== 'kepatuhan' && activeTab !== 'ringkasan' && activeTab !== 'ai-insights' && !activeTab.startsWith('ikp-') && !activeTab.startsWith('risk-') && !activeTab.startsWith('budaya-') && !activeTab.startsWith('kepuasan-') && !activeTab.startsWith('uimu-') && !activeTab.startsWith('custom-ind-') && !activeTab.startsWith('unit-ind-') && !activeTab.startsWith('priority-ind-') && !accessBlocked) {
          const entry = createDefaultEntry(activeTab as IndicatorType, activeUnit, user?.uid || '');
          handleAddEntry(entry).catch(() => {});
        }
      },
      onExport: () => {
        handleExportExcel().catch(() => {});
      },
      onFocusSearch: () => {
        const searchInput = document.querySelector('input[placeholder="Cari data..."]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      },
      onEscape: () => {
        const searchInput = document.querySelector('input[placeholder="Cari data..."]') as HTMLInputElement;
        if (searchInput && document.activeElement === searchInput) {
          searchInput.value = '';
          searchInput.blur();
        }
      },
      onShowHelp: () => {
        setShortcutsDialogOpen(true);
      },
    }),
  });

  // ── Ctrl+K for Command Palette ──────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Render active panel ───────────────────────
  const renderPanel = () => {
    // Scrollable wrapper for analytics/overview panels
    const scrollWrap = (el: JSX.Element) => (
      <div className="flex-1 min-h-0 overflow-y-auto">{el}</div>
    );

    if (activeTab === 'overview') {
      return scrollWrap(
        <DashboardOverviewPanel
          activeUnit={activeUnit}
          onNavigateToIndicator={handleNavigateToIndicator}
          userName={user?.displayName || user?.email || 'Pengguna'}
        />
      );
    }
    if (activeTab === 'tren') {
      return scrollWrap(<TrenBulananPanel entries={trendEntries} activeUnit={activeUnit} />);
    }
    if (activeTab === 'kepatuhan') {
      return scrollWrap(<KepatuhanUnitPanel allEntries={allEntries} activeUnit={activeUnit} />);
    }
    if (activeTab === 'ringkasan') {
      return scrollWrap(<RingkasanLaporanPanel activeUnit={activeUnit} />);
    }
    if (activeTab === 'ai-insights') {
      return scrollWrap(
        <AiInsightsPanel
          entries={entries}
          allEntries={allEntries}
          activeUnit={activeUnit}
        />
      );
    }
    if (activeTab === 'export-templates') {
      return scrollWrap(<DataExportTemplates activeUnit={activeUnit} />);
    }
    if (activeTab === 'activity-heatmap') {
      return scrollWrap(
        <ActivityHeatmap
          allEntries={allEntries}
          activeUnit={activeUnit}
        />
      );
    }
    if (activeTab === 'data-quality') {
      return scrollWrap(
        <DataQualityPanel
          allEntries={allEntries}
          activeUnit={activeUnit}
        />
      );
    }
    if (activeTab === 'compliance-timeline') {
      return scrollWrap(
        <ComplianceTimeline
          allEntries={allEntries}
          activeUnit={activeUnit}
        />
      );
    }
    if (activeTab.startsWith('ikp-')) {
      return (
        <IkpModule
          activeTab={activeTab}
          userId={user?.uid || ''}
          userName={user?.displayName || user?.email || 'Pengguna'}
          activeUnit={activeUnit}
          canReview={canReviewIkp}
          isAdmin={isIkpAdmin}
          onNavigate={(tab) => setActiveTab(tab)}
        />
      );
    }
    if (activeTab.startsWith('risk-')) {
      return (
        <RiskModule
          activeTab={activeTab}
          userId={user?.uid || ''}
          userName={user?.displayName || user?.email || 'Pengguna'}
          activeUnit={activeUnit}
          canReview={canReviewRisk}
          isAdmin={isRiskAdmin}
          onNavigate={(tab) => setActiveTab(tab)}
        />
      );
    }
    if (activeTab.startsWith('budaya-')) {
      return (
        <BudayaModule
          activeTab={activeTab}
          userId={user?.uid || ''}
          userName={user?.displayName || user?.email || 'Pengguna'}
          activeUnit={activeUnit}
          canReview={canReviewBudaya}
          canManageSurvey={canManageBudayaSurvey}
          isAdmin={isBudayaAdmin}
          onNavigate={(tab) => setActiveTab(tab)}
        />
      );
    }
    if (activeTab.startsWith('kepuasan-')) {
      return (
        <KepuasanModule
          activeTab={activeTab}
          userId={user?.uid || ''}
          userName={user?.displayName || user?.email || 'Pengguna'}
          canManageSurvey={canManageKepuasanSurvey}
          onNavigate={(tab) => setActiveTab(tab)}
        />
      );
    }
    if (activeTab.startsWith('uimu-')) {
      return (
        <UimuModule
          activeTab={activeTab}
          userId={user?.uid || ''}
          userName={user?.displayName || user?.email || 'Pengguna'}
          activeUnit={activeUnit}
          uimuRoles={uimuRoles ?? []}
          canReview={canReviewUimu}
          isAdmin={isUimuAdmin}
          onNavigate={(tab) => setActiveTab(tab)}
        />
      );
    }
    if (activeTab.startsWith('custom-ind-')) {
      return (
        <CustomIndicatorModule
          activeTab={activeTab}
          userId={user?.uid || ''}
          userName={user?.displayName || user?.email || 'Pengguna'}
          activeUnit={activeUnit}
          isManager={isCustomIndicatorManager}
          isManagement={isCustomIndicatorManagement}
          onNavigate={(tab) => setActiveTab(tab)}
        />
      );
    }
    if (activeTab.startsWith('unit-ind-')) {
      return (
        <UnitIndicatorModule
          activeTab={activeTab}
          userId={user?.uid || ''}
          userName={user?.displayName || user?.email || 'Pengguna'}
          activeUnit={activeUnit}
          onNavigate={(tab) => setActiveTab(tab)}
        />
      );
    }
    if (activeTab.startsWith('priority-ind-')) {
      return (
        <PriorityIndicatorModule
          activeTab={activeTab}
          userId={user?.uid || ''}
          userName={user?.displayName || user?.email || 'Pengguna'}
          activeUnit={activeUnit}
          onNavigate={(tab) => setActiveTab(tab)}
        />
      );
    }
    return (
      <IndicatorPanel
        type={activeTab as IndicatorType}
        entries={entries}
        activeUnit={activeUnit}
        userId={user?.uid || ''}
        isLoading={isLoading}
        onAddEntry={handleAddEntry}
        onUpdateEntry={handleUpdateEntry}
        onDeleteEntry={handleDeleteEntry}
        onImport={handleImport}
        dateFilter={dateFilters[activeTab] || { start: '', end: '' }}
        onDateFilterChange={handleDateFilterChange}
        accessBlocked={accessBlocked}
        blockReason={blockReason}
        allEntries={allEntries}
      />
    );
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen flex flex-col bg-background dot-pattern">
        {/* Header */}
        <DashboardHeader
          activeUnit={activeUnit}
          onExportExcel={handleExportExcel}
          onPrint={() => window.print()}
          onLogout={handleLogout}
          onProfileClick={() => setProfileOpen(true)}
          userName={user?.displayName || user?.email || 'Pengguna'}
          onUnitChange={(unit) => setActiveUnit(unit)}
          availableUnits={Object.keys(UNIT_MAP).filter((k) => k !== 'all')}
          unreadNotificationCount={auditLogs.filter(log => {
            // Count logs from the last hour as "recent unread"
            try {
              const ts = new Date(log.ts);
              return Date.now() - ts.getTime() < 3600000;
            } catch { return false; }
          }).length}
          onNotificationClick={() => setNotificationOpen(true)}
          onMenuClick={() => setMobileSidebarOpen(true)}
          onSettingsClick={() => setSettingsOpen(true)}
        />

        {/* Email Verification Banner */}
        <AnimatePresence>
          {user && !user.emailVerified && !verifyDismissed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-amber-500/20 bg-amber-500/10"
            >
              <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Mail className="size-4 text-amber-500 shrink-0" />
                <span className="text-amber-700 dark:text-amber-200/90 flex-1">
                  Email Anda belum diverifikasi. Silakan cek inbox email untuk link verifikasi.
                </span>
                <button
                  onClick={async () => {
                    setVerifySending(true);
                    try {
                      await sendVerification();
                    } catch { /* already sent */ }
                    setVerifySending(false);
                  }}
                  disabled={verifySending}
                  className="rounded-md bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                >
                  {verifySending ? 'Mengirim...' : 'Kirim Ulang'}
                </button>
                <button
                  onClick={() => setVerifyDismissed(true)}
                  className="text-amber-500/50 hover:text-amber-400 transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Desktop sidebar */}
          <div className="hidden md:flex">
            <DashboardSidebar
              activeUnit={activeUnit}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              onUnitChange={() => setShowUnitModal(true)}
              entryCounts={entryCounts}
              complianceData={complianceData}
            />
          </div>

          {/* Main content */}
          <main className="flex-1 overflow-hidden flex flex-col p-4 md:p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="flex-1 min-h-0 flex flex-col"
              >
                {renderPanel()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Footer */}
        <DashboardFooter />

        {/* Mobile sidebar as Sheet */}
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent
            side="left"
            className="w-[260px] p-0"
          >
            <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
            <DashboardSidebar
              activeUnit={activeUnit}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              onUnitChange={() => { setShowUnitModal(true); setMobileSidebarOpen(false); }}
              entryCounts={entryCounts}
              complianceData={complianceData}
              onNavClick={() => setMobileSidebarOpen(false)}
            />
          </SheetContent>
        </Sheet>

        {/* User Profile Panel */}
        <UserProfilePanel
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
        />

        {/* Unit Change Modal */}
        <UnitChangeModal
          open={showUnitModal}
          onClose={() => setShowUnitModal(false)}
          activeUnit={activeUnit}
          onUnitChange={(unit) => setActiveUnit(unit)}
        />

        {/* Notification Panel */}
        <NotificationPanel
          open={notificationOpen}
          onClose={() => setNotificationOpen(false)}
          logs={auditLogs}
          activeUnit={activeUnit}
        />

        {/* Audit Trail Panel */}
        <AuditTrailPanel
          open={auditOpen}
          onClose={() => setAuditOpen(false)}
          logs={auditLogs}
          onClear={handleClearAuditLogs}
        />

        {/* Audit toggle button */}
        <button
          onClick={() => setAuditOpen(!auditOpen)}
          className="fixed right-0 bottom-20 z-40 flex flex-col items-center gap-1 rounded-l-lg border border-foreground/10 border-r-0 bg-card px-2 py-3 text-[9px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-[#4f8ef7] hover:border-[#4f8ef7]/40"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Audit
        </button>

        {/* Keyboard shortcuts help button */}
        <button
          onClick={() => setShortcutsDialogOpen(true)}
          className="fixed right-0 bottom-10 z-40 flex items-center gap-1 rounded-l-lg border border-foreground/10 border-r-0 bg-card px-2 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-[#4f8ef7] hover:border-[#4f8ef7]/40"
          title="Pintasan Keyboard (?)"
        >
          <Keyboard className="size-4" />
        </button>

        {/* Keyboard Shortcuts Dialog */}
        <KeyboardShortcutsDialog
          open={shortcutsDialogOpen}
          onOpenChange={setShortcutsDialogOpen}
        />

        {/* Command Palette */}
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          onNavigate={handleTabChange}
        />

        {/* Settings Panel */}
        <SettingsPanel
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />

        {/* Quick Actions Widget */}
        <QuickActionsWidget
          onAddEntry={() => {
            if (activeTab !== 'overview' && activeTab !== 'tren' && activeTab !== 'kepatuhan' && activeTab !== 'ringkasan' && activeTab !== 'ai-insights' && activeTab !== 'activity-heatmap' && activeTab !== 'data-quality' && activeTab !== 'compliance-timeline' && !activeTab.startsWith('ikp-') && !activeTab.startsWith('risk-') && !activeTab.startsWith('budaya-') && !activeTab.startsWith('kepuasan-') && !activeTab.startsWith('uimu-') && !activeTab.startsWith('custom-ind-') && !activeTab.startsWith('unit-ind-') && !activeTab.startsWith('priority-ind-') && !accessBlocked) {
              const entry = createDefaultEntry(activeTab as IndicatorType, activeUnit, user?.uid || '');
              handleAddEntry(entry).catch(() => {});
            }
          }}
          onExport={() => handleExportExcel().catch(() => {})}
          onUnitChange={() => setShowUnitModal(true)}
          onNavigateToReport={() => setActiveTab('ringkasan')}
          onNavigateToAI={() => setActiveTab('ai-insights')}
          onNavigateToExport={() => setActiveTab('export-templates')}
        />
      </div>
    </TooltipProvider>
  );
}

// ──────────────────────────────────────────────
// Root page with AuthProvider
// ──────────────────────────────────────────────

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
