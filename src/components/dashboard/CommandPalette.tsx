'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Hand,
  Stethoscope,
  ScanLine,
  Shield,
  TriangleAlert,
  Clock,
  Monitor,
  FlaskConical,
  Pill,
  FileText,
  Scissors,
  BarChart3,
  Activity,
  FileBarChart,
  Sparkles,
  TrendingUp,
  Layers,
  Hash,
  Settings,
  Keyboard,
  Plus,
  Download,
  type LucideIcon,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { INDICATORS, type IndicatorType, UNIT_MAP } from '@/types';

/* ── Icon map ─────────────────────────────────────────────────── */
const ICON_MAP: Record<string, LucideIcon> = {
  hand: Hand,
  stethoscope: Stethoscope,
  'scan-line': ScanLine,
  shield: Shield,
  'triangle-alert': TriangleAlert,
  clock: Clock,
  monitor: Monitor,
  'flask-conical': FlaskConical,
  pill: Pill,
  'file-text': FileText,
  scissors: Scissors,
};

/* ── Types ────────────────────────────────────────────────────── */
interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  shortcut?: string;
  action: () => void;
  group: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateToIndicator: (type: IndicatorType) => void;
  onNavigateToTab: (tab: string) => void;
  onAddEntry?: () => void;
  onExport?: () => void;
  onShowSettings?: () => void;
  onShowShortcuts?: () => void;
}

/* ── Main Component ───────────────────────────────────────────── */
export function CommandPalette({
  open,
  onOpenChange,
  onNavigateToIndicator,
  onNavigateToTab,
  onAddEntry,
  onExport,
  onShowSettings,
  onShowShortcuts,
}: CommandPaletteProps) {
  const [recentActions, setRecentActions] = useState<string[]>([]);

  // Track recent actions
  const trackAction = useCallback((id: string) => {
    setRecentActions(prev => {
      const next = [id, ...prev.filter(r => r !== id)].slice(0, 5);
      return next;
    });
  }, []);

  // Build command list
  const commands: CommandAction[] = [];

  // Indicator navigation commands
  for (const ind of INDICATORS) {
    const Icon = ICON_MAP[ind.icon] ?? FileText;
    commands.push({
      id: `nav-${ind.id}`,
      label: ind.label,
      description: `Lihat data indikator ${ind.label}`,
      icon: Icon,
      action: () => {
        trackAction(`nav-${ind.id}`);
        onNavigateToIndicator(ind.id);
        onOpenChange(false);
      },
      group: 'Indikator',
    });
  }

  // Unit navigation commands
  for (const [key, meta] of Object.entries(UNIT_MAP)) {
    if (key === 'all') continue;
    commands.push({
      id: `unit-${key}`,
      label: meta.label,
      description: `Filter data unit ${meta.label}`,
      icon: Hash,
      action: () => {
        trackAction(`unit-${key}`);
        onOpenChange(false);
      },
      group: 'Unit',
    });
  }

  // Analytics & report commands
  const analyticsCommands: CommandAction[] = [
    {
      id: 'tab-overview',
      label: 'Dashboard Overview',
      description: 'Kembali ke halaman utama',
      icon: Layers,
      action: () => { onNavigateToTab('overview'); onOpenChange(false); },
      group: 'Analitik',
    },
    {
      id: 'tab-tren',
      label: 'Tren Bulanan',
      description: 'Grafik tren kepatuhan per bulan',
      icon: TrendingUp,
      action: () => { onNavigateToTab('tren'); onOpenChange(false); },
      group: 'Analitik',
    },
    {
      id: 'tab-kepatuhan',
      label: 'Kepatuhan Unit',
      description: 'Perbandingan kepatuhan antar unit',
      icon: BarChart3,
      action: () => { onNavigateToTab('kepatuhan'); onOpenChange(false); },
      group: 'Analitik',
    },
    {
      id: 'tab-ringkasan',
      label: 'Ringkasan Laporan',
      description: 'Buat laporan ringkasan mutu',
      icon: FileBarChart,
      action: () => { onNavigateToTab('ringkasan'); onOpenChange(false); },
      group: 'Analitik',
    },
    {
      id: 'tab-ai-insights',
      label: 'AI Insights',
      description: 'Analisis cerdas berbasis AI',
      icon: Sparkles,
      action: () => { onNavigateToTab('ai-insights'); onOpenChange(false); },
      group: 'Analitik',
    },
    {
      id: 'tab-activity-heatmap',
      label: 'Peta Aktivitas',
      description: 'Visualisasi aktivitas input data',
      icon: Activity,
      action: () => { onNavigateToTab('activity-heatmap'); onOpenChange(false); },
      group: 'Analitik',
    },
    {
      id: 'tab-data-quality',
      label: 'Kualitas Data',
      description: 'Analisis kelengkapan data',
      icon: Shield,
      action: () => { onNavigateToTab('data-quality'); onOpenChange(false); },
      group: 'Analitik',
    },
    {
      id: 'tab-compliance-timeline',
      label: 'Timeline Kepatuhan',
      description: 'Riwayat perubahan kepatuhan',
      icon: Clock,
      action: () => { onNavigateToTab('compliance-timeline'); onOpenChange(false); },
      group: 'Analitik',
    },
  ];

  // Quick actions
  if (onAddEntry) {
    commands.push({
      id: 'action-add',
      label: 'Tambah Data Baru',
      description: 'Tambahkan entri data baru',
      icon: Plus,
      shortcut: 'Ctrl+N',
      action: () => { trackAction('action-add'); onAddEntry(); onOpenChange(false); },
      group: 'Aksi Cepat',
    });
  }

  if (onExport) {
    commands.push({
      id: 'action-export',
      label: 'Export ke Excel',
      description: 'Ekspor semua data ke file Excel',
      icon: Download,
      shortcut: 'Ctrl+E',
      action: () => { trackAction('action-export'); onExport(); onOpenChange(false); },
      group: 'Aksi Cepat',
    });
  }

  if (onShowSettings) {
    commands.push({
      id: 'action-settings',
      label: 'Pengaturan',
      description: 'Buka panel pengaturan',
      icon: Settings,
      action: () => { onShowSettings(); onOpenChange(false); },
      group: 'Aksi Cepat',
    });
  }

  if (onShowShortcuts) {
    commands.push({
      id: 'action-shortcuts',
      label: 'Pintasan Keyboard',
      description: 'Lihat semua pintasan keyboard',
      icon: Keyboard,
      shortcut: '?',
      action: () => { onShowShortcuts(); onOpenChange(false); },
      group: 'Aksi Cepat',
    });
  }

  // All commands
  const allCommands = [...commands, ...analyticsCommands];

  // Recent commands
  const recentCommands = recentActions
    .map(id => allCommands.find(c => c.id === id))
    .filter(Boolean) as CommandAction[];

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command Palette" description="Cari navigasi, indikator, atau aksi cepat...">
      <CommandInput placeholder="Cari navigasi, indikator, atau aksi cepat..." />
      <CommandList>
        <CommandEmpty>Tidak ditemukan hasil.</CommandEmpty>

        {/* Recent actions */}
        {recentCommands.length > 0 && (
          <CommandGroup heading="Terakhir Digunakan">
            {recentCommands.map(cmd => (
              <CommandItem key={cmd.id} onSelect={cmd.action}>
                <cmd.icon className="size-4" />
                <span>{cmd.label}</span>
                {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Quick actions */}
        {allCommands.filter(c => c.group === 'Aksi Cepat').length > 0 && (
          <CommandGroup heading="Aksi Cepat">
            {allCommands.filter(c => c.group === 'Aksi Cepat').map(cmd => (
              <CommandItem key={cmd.id} onSelect={cmd.action}>
                <cmd.icon className="size-4" />
                <span>{cmd.label}</span>
                {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Indicators */}
        <CommandGroup heading="Indikator Mutu">
          {allCommands.filter(c => c.group === 'Indikator').map(cmd => (
            <CommandItem key={cmd.id} onSelect={cmd.action}>
              <cmd.icon className="size-4" />
              <span>{cmd.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Analytics */}
        <CommandGroup heading="Analitik & Laporan">
          {allCommands.filter(c => c.group === 'Analitik').map(cmd => (
            <CommandItem key={cmd.id} onSelect={cmd.action}>
              <cmd.icon className="size-4" />
              <span>{cmd.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Units */}
        <CommandSeparator />
        <CommandGroup heading="Unit Kerja">
          {allCommands.filter(c => c.group === 'Unit').map(cmd => (
            <CommandItem key={cmd.id} onSelect={cmd.action}>
              <cmd.icon className="size-4" />
              <span>{cmd.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
