'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  X,
  FileSpreadsheet,
  ArrowLeftRight,
  FileBarChart,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/* ── Types ────────────────────────────────────────────────────── */

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  onClick: () => void;
}

interface QuickActionsWidgetProps {
  onAddEntry: () => void;
  onExport: () => void;
  onUnitChange: () => void;
  onNavigateToReport: () => void;
  onNavigateToAI: () => void;
  onNavigateToExport?: () => void;
}

/* ── Animation variants ───────────────────────────────────────── */

const fabVariants = {
  collapsed: { rotate: 0, scale: 1 },
  expanded: { rotate: 135, scale: 1.05 },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const actionVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.05,
      duration: 0.2,
      ease: 'easeOut',
    },
  }),
  exit: (i: number) => ({
    opacity: 0,
    y: 10,
    scale: 0.8,
    transition: {
      delay: i * 0.03,
      duration: 0.15,
      ease: 'easeIn',
    },
  }),
};

/* ── Main Component ───────────────────────────────────────────── */

export function QuickActionsWidget({
  onAddEntry,
  onExport,
  onUnitChange,
  onNavigateToReport,
  onNavigateToAI,
  onNavigateToExport,
}: QuickActionsWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);

  const actions: QuickAction[] = [
    {
      id: 'add-entry',
      label: 'Tambah Data',
      icon: <Plus className="size-4" />,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/20',
      onClick: onAddEntry,
    },
    {
      id: 'export',
      label: 'Export Excel',
      icon: <FileSpreadsheet className="size-4" />,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-500/15 hover:bg-blue-500/25 border-blue-500/20',
      onClick: onExport,
    },
    {
      id: 'unit-change',
      label: 'Ganti Unit',
      icon: <ArrowLeftRight className="size-4" />,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/20',
      onClick: onUnitChange,
    },
    {
      id: 'report',
      label: 'Buat Laporan',
      icon: <FileBarChart className="size-4" />,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-500/15 hover:bg-purple-500/25 border-purple-500/20',
      onClick: onNavigateToReport,
    },
    {
      id: 'ai',
      label: 'AI Analisis',
      icon: <Sparkles className="size-4" />,
      color: 'text-pink-600 dark:text-pink-400',
      bgColor: 'bg-pink-500/15 hover:bg-pink-500/25 border-pink-500/20',
      onClick: onNavigateToAI,
    },
    ...(onNavigateToExport ? [{
      id: 'export-templates',
      label: 'Template Ekspor',
      icon: <FileSpreadsheet className="size-4" />,
      color: 'text-teal-600 dark:text-teal-400',
      bgColor: 'bg-teal-500/15 hover:bg-teal-500/25 border-teal-500/20',
      onClick: onNavigateToExport,
    }] : []),
  ];

  const toggleOpen = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const handleActionClick = useCallback((action: QuickAction) => {
    setIsOpen(false);
    action.onClick();
  }, []);

  return (
    <>
      {/* Backdrop overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-background/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Action items */}
      <div className="fixed bottom-24 right-4 z-[51] flex flex-col-reverse items-end gap-2 pointer-events-none">
        <AnimatePresence>
          {isOpen && actions.map((action, i) => (
            <motion.div
              key={action.id}
              custom={i}
              variants={actionVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="pointer-events-auto flex items-center gap-2"
            >
              {/* Label */}
              <span className={cn(
                'rounded-lg border px-2.5 py-1 text-xs font-medium whitespace-nowrap shadow-sm',
                'bg-card border-border text-foreground/80',
              )}>
                {action.label}
              </span>

              {/* Action button */}
              <button
                onClick={() => handleActionClick(action)}
                className={cn(
                  'flex size-10 items-center justify-center rounded-full border shadow-md transition-transform',
                  'hover:scale-110 active:scale-95',
                  action.bgColor,
                  action.color,
                )}
              >
                {action.icon}
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* FAB button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            onClick={toggleOpen}
            variants={fabVariants}
            animate={isOpen ? 'expanded' : 'collapsed'}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className={cn(
              'fixed bottom-24 right-4 z-50 flex size-12 items-center justify-center rounded-full shadow-lg transition-colors',
              isOpen
                ? 'bg-red-500/90 hover:bg-red-600 text-white'
                : 'bg-[#4f8ef7] hover:bg-[#4f8ef7]/90 text-white',
            )}
          >
            <Plus className="size-5" />
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">
          Pintasan Cepat
        </TooltipContent>
      </Tooltip>
    </>
  );
}
