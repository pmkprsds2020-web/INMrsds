'use client';

import { motion } from 'framer-motion';
import { ClipboardList, Plus, Search, Database, BarChart3, FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { INDICATORS, type IndicatorType } from '@/types';

/* ── Contextual tips per indicator type ──────────────────────── */
const INDICATOR_TIPS: Partial<Record<IndicatorType, string>> = {
  tangan: 'Pastikan 5 momen kepatuhan tangan tercatat setiap shift.',
  visite: 'Catat waktu visite dokter untuk memastikan kepatuhan jam visite.',
  identitas: 'Verifikasi identitas pasien minimal 2 kali sebelum tindakan.',
  apd: 'Periksa kepatuhan APD sesuai jenis tindakan yang dilakukan.',
  jatuh: 'Lakukan assessment risiko jatuh saat admisi dan re-assessment rutin.',
  sc: 'Pastikan informed consent ditandatangani ≤30 menit sebelum prosedur.',
  wtrj: 'Catat waktu pendaftaran dan waktu dilayani untuk monitoring ≤60 menit.',
  op: 'Monitor penundaan operasi dan catat alasan keterlambatan.',
  lab: 'Pastikan hasil lab diterima ≤30 menit dari waktu keluar hasil.',
  fornas: 'Verifikasi kesesuaian resep dengan formularium nasional.',
  cp: 'Pastikan clinical pathway diikuti dan varian dicatat dengan benar.',
};

const INDICATOR_ICONS: Partial<Record<IndicatorType, typeof Database>> = {
  tangan: ClipboardList,
  visite: BarChart3,
  identitas: Database,
  apd: Database,
  jatuh: Database,
  sc: Database,
  wtrj: Database,
  op: Database,
  lab: Database,
  fornas: Database,
  cp: FileQuestion,
};

interface EmptyStateProps {
  /** Icon to display (defaults to ClipboardList) */
  icon?: React.ReactNode;
  /** Title text */
  title?: string;
  /** Description text */
  description?: string;
  /** Optional action button label */
  actionLabel?: string;
  /** Optional action button callback */
  onAction?: () => void;
  /** Indicator type for contextual tips */
  indicatorType?: IndicatorType;
}

export function EmptyState({
  icon,
  title = 'Belum Ada Data',
  description = 'Data untuk indikator ini belum tersedia. Klik tombol "Tambah Data" untuk mulai mengisi.',
  actionLabel,
  onAction,
  indicatorType,
}: EmptyStateProps) {
  const tip = indicatorType ? INDICATOR_TIPS[indicatorType] : undefined;
  const TipIcon = indicatorType ? INDICATOR_ICONS[indicatorType] : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-1 flex-col items-center justify-center py-16 px-4"
    >
      {/* Floating animated illustration */}
      <motion.div
        animate={{
          y: [0, -8, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="relative mb-6"
      >
        {/* Outer glow ring */}
        <div className="absolute -inset-4 rounded-3xl bg-muted/20 blur-xl" />

        {/* Main icon container */}
        <div className="relative flex size-20 items-center justify-center rounded-2xl bg-muted/30 border border-border/50">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            {icon ?? (
              <div className="relative">
                <ClipboardList className="size-10 text-muted-foreground/40" />
                {/* Small search icon overlay */}
                <Search className="absolute -bottom-1 -right-1 size-4 text-muted-foreground/25" />
              </div>
            )}
          </motion.div>

          {/* Decorative dots */}
          <div className="absolute -top-2 -right-2 size-3 rounded-full bg-[#4f8ef7]/20" />
          <div className="absolute -bottom-1 -left-1 size-2 rounded-full bg-emerald-400/20" />
        </div>
      </motion.div>

      <h3 className="text-sm font-semibold text-foreground/60 mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground/60 text-center max-w-xs mb-4">{description}</p>

      {/* Contextual tip */}
      {tip && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="flex items-start gap-2.5 rounded-lg border border-[#4f8ef7]/15 bg-[#4f8ef7]/5 px-4 py-3 mb-4 max-w-xs"
        >
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[#4f8ef7]/15">
            {TipIcon ? (
              <TipIcon className="size-3 text-[#4f8ef7]" />
            ) : (
              <Database className="size-3 text-[#4f8ef7]" />
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#4f8ef7] mb-0.5">Tips</p>
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">{tip}</p>
          </div>
        </motion.div>
      )}

      {actionLabel && onAction && (
        <Button
          size="sm"
          onClick={onAction}
          className="h-8 bg-[#4f8ef7]/20 text-[#4f8ef7] hover:bg-[#4f8ef7]/30 border-0 text-xs font-medium gap-1.5"
        >
          <Plus className="size-3.5" />
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}
