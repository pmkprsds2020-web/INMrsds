'use client';

import { useState, useCallback, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sun,
  Moon,
  Monitor,
  Bell,
  BellOff,
  Database,
  Info,
  Settings,
  Flame,
  Check,
  Volume2,
  VolumeX,
  Layout,
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { UNIT_MAP } from '@/types';

/* ── Settings types ────────────────────────────────────────────── */
interface AppSettings {
  // Display
  defaultUnit: string;
  compactMode: boolean;
  // Notifications
  notificationSound: boolean;
  notificationPosition: 'top-right' | 'bottom-right';
  // Data
  defaultDateRange: 'month' | 'quarter' | 'year' | 'all';
  entriesPerPage: 10 | 15 | 25 | 50;
}

const SETTINGS_KEY = 'dashboard-mutu-settings';

const DEFAULT_SETTINGS: AppSettings = {
  defaultUnit: 'all',
  compactMode: false,
  notificationSound: true,
  notificationPosition: 'top-right',
  defaultDateRange: 'month',
  entriesPerPage: 15,
};

function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: AppSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

/* ── Props ─────────────────────────────────────────────────────── */
export interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

/* ── Setting row component ─────────────────────────────────────── */
function SettingRow({
  icon,
  label,
  description,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground/90">{label}</p>
          <p className="text-[10px] text-muted-foreground leading-tight">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/* ── Section component ─────────────────────────────────────────── */
function SettingsSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="flex size-6 items-center justify-center rounded-md bg-[#4f8ef7]/10 text-[#4f8ef7]">
          {icon}
        </div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/70">{title}</h3>
      </div>
      <div className="ml-8 pl-0">
        {children}
      </div>
      <Separator className="mt-2 mb-4 bg-border/50" />
    </motion.div>
  );
}

/* ── Theme selector card ───────────────────────────────────────── */
function ThemeCard({
  value,
  currentTheme,
  label,
  icon,
  onClick,
}: {
  value: string;
  currentTheme: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  const isActive = currentTheme === value;
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all cursor-pointer ${
        isActive
          ? 'border-[#4f8ef7]/50 bg-[#4f8ef7]/10 text-[#4f8ef7]'
          : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
      }`}
    >
      <div className="size-6 flex items-center justify-center">{icon}</div>
      <span className="text-[10px] font-medium">{label}</span>
      {isActive && (
        <div className="size-3.5 rounded-full bg-[#4f8ef7] flex items-center justify-center">
          <Check className="size-2.5 text-white" />
        </div>
      )}
    </button>
  );
}

/* ── Main Component ────────────────────────────────────────────── */
export function SettingsPanel({
  open,
  onClose,
}: SettingsPanelProps) {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings>(() => {
    if (typeof window !== 'undefined') {
      return loadSettings();
    }
    return DEFAULT_SETTINGS;
  });
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Persist settings when changed
  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
  }, []);

  // Supabase status check (simple static indicator)
  const supabaseStatus: 'checking' | 'connected' | 'error' = 'connected';

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280, mass: 0.8 }}
            className="fixed right-0 top-0 z-50 h-full w-full sm:w-[400px] flex flex-col border-l border-border bg-card"
          >
            {/* ── Header ───────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-[#4f8ef7]/10">
                  <Settings className="size-4 text-[#4f8ef7]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Pengaturan</h2>
                  <p className="text-[10px] text-muted-foreground">
                    Kustomisasi tampilan & perilaku aplikasi
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                onClick={onClose}
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* ── Settings sections ─────────────────────────────── */}
            <ScrollArea className="flex-1">
              <div className="px-5 py-4 space-y-0">
                {/* ── Tampilan (Display) ──────────────────────────── */}
                <SettingsSection title="Tampilan" icon={<Layout className="size-3.5" />}>
                  {/* Theme selector */}
                  <SettingRow
                    icon={<Sun className="size-3.5" />}
                    label="Tema Aplikasi"
                    description="Pilih tampilan terang, gelap, atau otomatis mengikuti sistem"
                  >
                    <div className="flex gap-1.5">
                      {mounted && (
                        <>
                          <ThemeCard
                            value="light"
                            currentTheme={theme || 'dark'}
                            label="Terang"
                            icon={<Sun className="size-3.5" />}
                            onClick={() => setTheme('light')}
                          />
                          <ThemeCard
                            value="dark"
                            currentTheme={theme || 'dark'}
                            label="Gelap"
                            icon={<Moon className="size-3.5" />}
                            onClick={() => setTheme('dark')}
                          />
                          <ThemeCard
                            value="system"
                            currentTheme={theme || 'dark'}
                            label="Otomatis"
                            icon={<Monitor className="size-3.5" />}
                            onClick={() => setTheme('system')}
                          />
                        </>
                      )}
                    </div>
                  </SettingRow>

                  {/* Default unit */}
                  <SettingRow
                    icon={<Settings className="size-3.5" />}
                    label="Unit Default"
                    description="Unit yang ditampilkan saat pertama masuk"
                  >
                    <Select
                      value={settings.defaultUnit}
                      onValueChange={(v) => updateSettings({ defaultUnit: v })}
                    >
                      <SelectTrigger className="h-8 w-[130px] bg-muted/50 border-border text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="all" className="text-xs">Semua Unit</SelectItem>
                        {Object.entries(UNIT_MAP)
                          .filter(([k]) => k !== 'all')
                          .map(([key, meta]) => (
                            <SelectItem key={key} value={key} className="text-xs">
                              {meta.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </SettingRow>

                  {/* Compact mode */}
                  <SettingRow
                    icon={<Layout className="size-3.5" />}
                    label="Mode Ringkas"
                    description="Tampilkan data dalam tampilan yang lebih padat"
                  >
                    <Switch
                      checked={settings.compactMode}
                      onCheckedChange={(v) => updateSettings({ compactMode: v })}
                    />
                  </SettingRow>
                </SettingsSection>

                {/* ── Notifikasi ──────────────────────────────────── */}
                <SettingsSection title="Notifikasi" icon={<Bell className="size-3.5" />}>
                  {/* Notification sound */}
                  <SettingRow
                    icon={settings.notificationSound ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
                    label="Suara Notifikasi"
                    description="Putar suara saat ada notifikasi baru"
                  >
                    <Switch
                      checked={settings.notificationSound}
                      onCheckedChange={(v) => updateSettings({ notificationSound: v })}
                    />
                  </SettingRow>

                  {/* Notification position */}
                  <SettingRow
                    icon={<Bell className="size-3.5" />}
                    label="Posisi Notifikasi"
                    description="Lokasi tampilan notifikasi di layar"
                  >
                    <Select
                      value={settings.notificationPosition}
                      onValueChange={(v) => updateSettings({ notificationPosition: v as 'top-right' | 'bottom-right' })}
                    >
                      <SelectTrigger className="h-8 w-[130px] bg-muted/50 border-border text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="top-right" className="text-xs">Atas Kanan</SelectItem>
                        <SelectItem value="bottom-right" className="text-xs">Bawah Kanan</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingRow>
                </SettingsSection>

                {/* ── Data ────────────────────────────────────────── */}
                <SettingsSection title="Data" icon={<Database className="size-3.5" />}>
                  {/* Default date range */}
                  <SettingRow
                    icon={<Database className="size-3.5" />}
                    label="Rentang Tanggal Default"
                    description="Periode data yang ditampilkan saat pertama membuka indikator"
                  >
                    <Select
                      value={settings.defaultDateRange}
                      onValueChange={(v) => updateSettings({ defaultDateRange: v as AppSettings['defaultDateRange'] })}
                    >
                      <SelectTrigger className="h-8 w-[130px] bg-muted/50 border-border text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="month" className="text-xs">Bulan Ini</SelectItem>
                        <SelectItem value="quarter" className="text-xs">Kuartal Ini</SelectItem>
                        <SelectItem value="year" className="text-xs">Tahun Ini</SelectItem>
                        <SelectItem value="all" className="text-xs">Semua</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingRow>

                  {/* Entries per page */}
                  <SettingRow
                    icon={<Database className="size-3.5" />}
                    label="Data Per Halaman"
                    description="Jumlah baris data yang ditampilkan per halaman pada tabel"
                  >
                    <Select
                      value={String(settings.entriesPerPage)}
                      onValueChange={(v) => updateSettings({ entriesPerPage: parseInt(v) as AppSettings['entriesPerPage'] })}
                    >
                      <SelectTrigger className="h-8 w-[80px] bg-muted/50 border-border text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="10" className="text-xs">10</SelectItem>
                        <SelectItem value="15" className="text-xs">15</SelectItem>
                        <SelectItem value="25" className="text-xs">25</SelectItem>
                        <SelectItem value="50" className="text-xs">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingRow>
                </SettingsSection>

                {/* ── Tentang (About) ─────────────────────────────── */}
                <SettingsSection title="Tentang" icon={<Info className="size-3.5" />}>
                  <div className="space-y-3">
                    {/* App version */}
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground/80">Versi Aplikasi</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        v2.2.0
                      </Badge>
                    </div>

                    {/* Supabase status */}
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <Flame className="size-3.5 text-orange-400" />
                        <span className="text-sm text-foreground/80">Supabase</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`size-2 rounded-full ${
                            supabaseStatus === 'connected'
                              ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
                              : supabaseStatus === 'error'
                                ? 'bg-red-400'
                                : 'bg-amber-400 animate-pulse'
                          }`}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {supabaseStatus === 'connected'
                            ? 'Terhubung'
                            : supabaseStatus === 'error'
                              ? 'Gagal'
                              : 'Memeriksa...'}
                        </span>
                      </div>
                    </div>

                    {/* Credits */}
                    <div className="rounded-lg bg-muted/30 border border-border p-3 mt-2">
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Dashboard Mutu RS — Sistem Monitoring Indikator Mutu Rumah Sakit.
                        Dibangun dengan Next.js 16, React 19, Supabase, shadcn/ui, dan Tailwind CSS.
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                        © {new Date().getFullYear()} Dashboard Mutu RS. All rights reserved.
                      </p>
                    </div>
                  </div>
                </SettingsSection>
              </div>
            </ScrollArea>

            {/* ── Footer ──────────────────────────────────────────── */}
            <div className="border-t border-border px-5 py-3 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSettings(DEFAULT_SETTINGS);
                  saveSettings(DEFAULT_SETTINGS);
                }}
                className="h-8 border-border text-foreground/60 hover:text-foreground hover:bg-muted text-xs gap-1.5"
              >
                Reset ke Default
              </Button>
              <Button
                size="sm"
                onClick={onClose}
                className="h-8 bg-[#4f8ef7]/20 text-[#4f8ef7] hover:bg-[#4f8ef7]/30 border-0 text-xs font-medium"
              >
                Selesai
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
