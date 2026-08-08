'use client';

import { motion } from 'framer-motion';
import { ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { UNIT_MAP, INDICATORS, type IndicatorType } from '@/types';

/* ── Props ────────────────────────────────────────────────────── */
export interface UnitChangeModalProps {
  open: boolean;
  onClose: () => void;
  activeUnit: string;
  onUnitChange: (unit: string) => void;
}

/* ── Animation variants ──────────────────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', damping: 22, stiffness: 260 },
  },
};

/* ── Component ───────────────────────────────────────────────── */
export function UnitChangeModal({
  open,
  onClose,
  activeUnit,
  onUnitChange,
}: UnitChangeModalProps) {
  const unitKeys = Object.keys(UNIT_MAP).filter((k) => k !== 'all');

  const handleSelect = (unit: string) => {
    onUnitChange(unit);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-2xl border-border p-0 gap-0 overflow-hidden"
        
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#4f8ef7]/10">
              <ArrowLeftRight className="size-4 text-[#4f8ef7]" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Pilih Unit
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Pilih unit untuk melihat dan mengelola indikator mutu
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="p-4">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {/* "Semua Unit" card */}
              <motion.button
                variants={cardVariants}
                onClick={() => handleSelect('all')}
                className={`
                  group relative flex flex-col rounded-xl border p-4 text-left transition-all duration-200
                  ${
                    activeUnit === 'all'
                      ? 'border-[#4f8ef7]/50 bg-[#4f8ef7]/10 shadow-[0_0_24px_rgba(79,142,247,0.1)]'
                      : 'border-border bg-muted/20 hover:border-foreground/20 hover:bg-muted/30'
                  }
                `}
              >
                {activeUnit === 'all' && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle2 className="size-4 text-[#4f8ef7]" />
                  </div>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="flex size-10 items-center justify-center rounded-lg text-xs font-bold"
                    style={{
                      backgroundColor: `${UNIT_MAP['all'].color}20`,
                      color: UNIT_MAP['all'].color,
                    }}
                  >
                    ALL
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Semua Unit</p>
                    <p className="text-[10px] text-muted-foreground">
                      {INDICATORS.length} indikator
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {INDICATORS.slice(0, 6).map((ind) => (
                    <Badge
                      key={ind.id}
                      className="bg-muted/30 text-muted-foreground border-border text-[9px] px-1.5 py-0"
                    >
                      {ind.label}
                    </Badge>
                  ))}
                  {INDICATORS.length > 6 && (
                    <Badge className="bg-muted/30 text-muted-foreground/60 border-border text-[9px] px-1.5 py-0">
                      +{INDICATORS.length - 6}
                    </Badge>
                  )}
                </div>
              </motion.button>

              {/* Individual unit cards */}
              {unitKeys.map((key) => {
                const meta = UNIT_MAP[key];
                if (!meta) return null;
                const isActive = activeUnit === key;
                const unitIndicators = INDICATORS.filter((ind) =>
                  meta.inds.includes(ind.id as IndicatorType)
                );

                return (
                  <motion.button
                    key={key}
                    variants={cardVariants}
                    onClick={() => handleSelect(key)}
                    className={`
                      group relative flex flex-col rounded-xl border p-4 text-left transition-all duration-200
                      ${
                        isActive
                          ? 'bg-muted/50 shadow-[0_0_24px_rgba(255,255,255,0.02)]'
                          : 'border-border bg-muted/20 hover:border-foreground/20 hover:bg-muted/30'
                      }
                    `}
                    style={{
                      borderColor: isActive ? `${meta.color}50` : undefined,
                    }}
                  >
                    {isActive && (
                      <div className="absolute top-3 right-3">
                        <CheckCircle2 className="size-4" style={{ color: meta.color }} />
                      </div>
                    )}
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="flex size-10 items-center justify-center rounded-lg text-xs font-bold"
                        style={{
                          backgroundColor: `${meta.color}20`,
                          color: meta.color,
                        }}
                      >
                        {meta.abbr}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {meta.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {unitIndicators.length} indikator
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {unitIndicators.slice(0, 5).map((ind) => (
                        <Badge
                          key={ind.id}
                          className="border-0 text-[9px] px-1.5 py-0"
                          style={{
                            backgroundColor: `${ind.color}15`,
                            color: `${ind.color}cc`,
                          }}
                        >
                          {ind.label}
                        </Badge>
                      ))}
                      {unitIndicators.length > 5 && (
                        <Badge
                          className="border-0 text-[9px] px-1.5 py-0"
                          style={{
                            backgroundColor: `${meta.color}15`,
                            color: `${meta.color}99`,
                          }}
                        >
                          +{unitIndicators.length - 5}
                        </Badge>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
