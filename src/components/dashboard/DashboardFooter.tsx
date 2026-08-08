'use client';

import { Hospital, Flame, Heart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function DashboardFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-card footer-gradient-top">
      {/* Desktop: single row */}
      <div className="hidden sm:flex h-10 items-center justify-between px-4">
        {/* Left: Copyright */}
        <div className="flex items-center gap-1.5 text-[11px] text-foreground/40">
          <Hospital className="size-3 text-[#4f8ef7]" />
          <span>&copy; {new Date().getFullYear()} Dashboard Mutu RS</span>
        </div>

        {/* Center: Tagline */}
        <div className="text-[11px] text-foreground/30 text-center flex items-center gap-1">
          <Heart className="size-2.5 text-red-400/60" />
          Sistem Monitoring Indikator Mutu Rumah Sakit
        </div>

        {/* Right: Version & Powered by */}
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="bg-foreground/[0.06] text-foreground/50 text-[10px] font-mono px-1.5 py-0 h-5 border-0"
          >
            v2.0
          </Badge>
          <span className="flex items-center gap-1 text-[10px] text-foreground/30">
            <Flame className="size-3 text-orange-400" />
            Powered by Firebase
          </span>
        </div>
      </div>

      {/* Mobile: stacked layout with icons */}
      <div className="flex sm:hidden flex-col items-center gap-1.5 py-2.5 px-4">
        <div className="flex items-center gap-1.5 text-[11px] text-foreground/40">
          <Hospital className="size-3 text-[#4f8ef7]" />
          <span>&copy; {new Date().getFullYear()} Dashboard Mutu RS</span>
        </div>
        <div className="text-[10px] text-foreground/30 text-center flex items-center gap-1">
          <Heart className="size-2.5 text-red-400/60" />
          Sistem Monitoring Indikator Mutu Rumah Sakit
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="bg-foreground/[0.06] text-foreground/50 text-[10px] font-mono px-1.5 py-0 h-5 border-0"
          >
            v2.0
          </Badge>
          <span className="flex items-center gap-1 text-[10px] text-foreground/30">
            <Flame className="size-3 text-orange-400" />
            Firebase
          </span>
        </div>
      </div>
    </footer>
  );
}
