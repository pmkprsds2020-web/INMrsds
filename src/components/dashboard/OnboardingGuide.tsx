'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hospital,
  Building2,
  PlusCircle,
  BarChart3,
  FileDown,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/* ── Types ────────────────────────────────────────────────────── */
interface OnboardingGuideProps {
  onComplete: () => void;
  onNavigateToIndicator?: () => void;
}

/* ── Step definitions ─────────────────────────────────────────── */
const STEPS = [
  {
    title: 'Selamat Datang di Dashboard Mutu RS!',
    description:
      'Sistem monitoring indikator mutu rumah sakit yang membantu Anda melacak kepatuhan, menganalisis tren, dan menghasilkan laporan berkualitas. Dashboard ini dirancang untuk memudahkan pengawasan mutu pelayanan secara real-time.',
    Icon: Hospital,
    iconBg: 'bg-[#4f8ef7]/15',
    iconColor: 'text-[#4f8ef7]',
    illustrationIcons: [BarChart3, Building2, CheckCircle2],
  },
  {
    title: 'Pilih Unit Anda',
    description:
      'Gunakan pemilih unit di bagian atas dashboard atau sidebar untuk memfilter data berdasarkan unit layanan. Setiap unit memiliki indikator spesifik yang relevan dengan pelayanan mereka.',
    Icon: Building2,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-500',
    illustrationIcons: [Hospital, ArrowRight, Building2],
  },
  {
    title: 'Mulai Input Data',
    description:
      'Klik tombol "Tambah Data" pada panel indikator untuk menambahkan entri baru. Anda juga dapat mengimpor data dari file Excel untuk efisiensi input yang lebih baik.',
    Icon: PlusCircle,
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-500',
    illustrationIcons: [PlusCircle, BarChart3, CheckCircle2],
  },
  {
    title: 'Pantau Capaian',
    description:
      'Dashboard overview menampilkan ringkasan capaian mutu secara visual dengan grafik kepatuhan, progress ring, dan heatmap aktivitas. Pantau indikator yang belum memenuhi target dengan mudah.',
    Icon: BarChart3,
    iconBg: 'bg-purple-500/15',
    iconColor: 'text-purple-500',
    illustrationIcons: [BarChart3, CheckCircle2, Hospital],
  },
  {
    title: 'Ekspor & Laporan',
    description:
      'Buat laporan ringkasan mutu yang komprehensif, ekspor data ke Excel, atau cetak laporan untuk keperluan audit. Gunakan panel AI Insights untuk analisis cerdas berbasis data.',
    Icon: FileDown,
    iconBg: 'bg-cyan-500/15',
    iconColor: 'text-cyan-500',
    illustrationIcons: [FileDown, BarChart3, Building2],
  },
];

/* ── Slide variants ───────────────────────────────────────────── */
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 80 : -80,
    opacity: 0,
  }),
};

/* ── OnboardingGuide Component ────────────────────────────────── */
export function OnboardingGuide({
  onComplete,
  onNavigateToIndicator,
}: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setDirection(1);
      setCurrentStep((s) => s + 1);
    } else {
      onComplete();
    }
  }, [currentStep, onComplete]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const step = STEPS[currentStep];
  const StepIcon = step.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20, transition: { duration: 0.3 } }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <Card className="relative overflow-hidden rounded-xl border border-border bg-card/80 backdrop-blur-xl shadow-lg">
        {/* Gradient top accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#4f8ef7] via-[#6ee7b7] to-[#a78bfa]" />

        {/* Skip button */}
        <button
          onClick={onComplete}
          className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground/60 transition-colors hover:text-foreground hover:bg-muted/50"
          aria-label="Lewati panduan"
        >
          <span>Lewati</span>
          <X className="size-3" />
        </button>

        <CardContent className="pt-5 pb-4 px-6">
          {/* Step progress indicator */}
          <div className="flex items-center justify-center gap-1.5 mb-5">
            {STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setDirection(idx > currentStep ? 1 : -1);
                  setCurrentStep(idx);
                }}
                className="transition-all duration-300 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f8ef7]/50"
                aria-label={`Langkah ${idx + 1}`}
              >
                <div
                  className={`rounded-full transition-all duration-300 ${
                    idx === currentStep
                      ? 'h-2 w-6 bg-[#4f8ef7]'
                      : idx < currentStep
                      ? 'h-2 w-2 bg-emerald-400'
                      : 'h-2 w-2 bg-muted-foreground/20'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Step content with slide animation */}
          <div className="relative overflow-hidden min-h-[220px]">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentStep}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="flex flex-col items-center text-center"
              >
                {/* Step number badge */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex size-6 items-center justify-center rounded-full bg-[#4f8ef7]/15 text-[10px] font-bold text-[#4f8ef7]">
                    {currentStep + 1}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                    Langkah {currentStep + 1} dari {STEPS.length}
                  </span>
                </div>

                {/* Illustration area with icons */}
                <div className={`flex items-center justify-center rounded-2xl ${step.iconBg} size-20 mb-4`}>
                  <StepIcon className={`size-10 ${step.iconColor}`} />
                </div>

                {/* Secondary illustration icons */}
                <div className="flex items-center gap-3 mb-4">
                  {step.illustrationIcons.map((IllIcon, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-center size-8 rounded-lg bg-muted/50 border border-border/50"
                    >
                      <IllIcon className="size-4 text-muted-foreground/50" />
                    </div>
                  ))}
                </div>

                {/* Title */}
                <h3 className="text-base font-bold text-foreground/90 mb-2">
                  {step.title}
                </h3>

                {/* Description */}
                <p className="text-xs text-muted-foreground/70 leading-relaxed max-w-md mx-auto">
                  {step.description}
                </p>

                {/* Special action for step 3 (Input Data) */}
                {currentStep === 2 && onNavigateToIndicator && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onNavigateToIndicator}
                    className="mt-3 gap-1.5 text-xs border-[#4f8ef7]/30 text-[#4f8ef7] hover:bg-[#4f8ef7]/10 hover:text-[#4f8ef7]"
                  >
                    <PlusCircle className="size-3.5" />
                    Coba Tambah Data
                  </Button>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="gap-1 text-xs text-muted-foreground/70 hover:text-foreground disabled:opacity-30"
            >
              <ChevronLeft className="size-3.5" />
              Sebelumnya
            </Button>

            <Button
              size="sm"
              onClick={handleNext}
              className="gap-1.5 text-xs bg-[#4f8ef7] hover:bg-[#4f8ef7]/90 text-white"
            >
              {currentStep === STEPS.length - 1 ? (
                <>
                  Mulai!
                  <CheckCircle2 className="size-3.5" />
                </>
              ) : (
                <>
                  Berikutnya
                  <ChevronRight className="size-3.5" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
