'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ClipboardList, CheckCircle2, Building2, Trophy, TrendingUp, AlertTriangle } from 'lucide-react';
import { STATUS_LABEL, STATUS_COLOR } from '@/types/customIndicators';
import type { CustomIndicator } from '@/types/customIndicators';
import { getCustomIndicators, getLatestMeasurementsForIndicators, computeCustomIndicatorDashboardStats, subscribeToCustomIndicators } from '@/lib/customIndicatorData';

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}20`, color }}>
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function CustomIndicatorDashboardPanel({ onSelect }: { onSelect: (id: string) => void }) {
  const [indicators, setIndicators] = useState<CustomIndicator[]>([]);
  const [latestByIndicator, setLatestByIndicator] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const inds = await getCustomIndicators();
      setIndicators(inds);
      const activeIds = inds.filter((i) => i.status === 'active').map((i) => i.id);
      setLatestByIndicator(await getLatestMeasurementsForIndicators(activeIds));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const unsub = subscribeToCustomIndicators(() => load());
    return unsub;
  }, []);

  const stats = useMemo(() => computeCustomIndicatorDashboardStats(indicators, latestByIndicator), [indicators, latestByIndicator]);

  const activeIndicators = indicators.filter((i) => i.status === 'active');

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Dashboard Indikator Mutu RS</h2>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : indicators.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-2 text-center">
            <ClipboardList className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Belum ada indikator mutu custom.</p>
            <p className="text-xs text-muted-foreground max-w-sm">Buat indikator mutu sesuai kebutuhan unit atau prioritas Rumah Sakit lewat menu Master Indikator Mutu → Buat Indikator Baru.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard icon={ClipboardList} label="Total Indikator" value={stats.total} color="#4f8ef7" />
            <KpiCard icon={CheckCircle2} label="Indikator Aktif" value={stats.active} color="#22c55e" />
            <KpiCard icon={Building2} label="Indikator Unit" value={stats.unitCount} color="#a78bfa" />
            <KpiCard icon={Trophy} label="Prioritas RS" value={stats.priorityCount} color="#f59e0b" />
            <KpiCard icon={TrendingUp} label="Tercapai (Terakhir)" value={stats.achievedCount} color="#16a34a" />
            <KpiCard icon={AlertTriangle} label="Perlu Perbaikan" value={stats.needsImprovementCount} color="#ef4444" />
          </div>

          <Card>
            <CardContent className="pt-6 space-y-2">
              <p className="text-sm font-medium mb-2">Indikator Aktif — Capaian Terakhir</p>
              {activeIndicators.map((ind) => {
                const latest = latestByIndicator.get(ind.id);
                return (
                  <button key={ind.id} onClick={() => onSelect(ind.id)} className="w-full flex items-center justify-between gap-2 rounded-lg border p-2.5 text-left hover:bg-muted/40">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{ind.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{ind.code} · {ind.category}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {latest ? (
                        <Badge variant="outline" style={{ borderColor: latest.achievementStatus === 'tercapai' ? '#22c55e' : '#ef4444', color: latest.achievementStatus === 'tercapai' ? '#22c55e' : '#ef4444' }} className="text-[10px]">
                          {latest.value !== null ? latest.value.toFixed(1) : '—'} ({latest.period})
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Belum ada data</span>
                      )}
                    </div>
                  </button>
                );
              })}
              {activeIndicators.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Belum ada indikator berstatus aktif.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium mb-2">Distribusi per Kategori</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.byCategory).map(([cat, count]) => (
                  <Badge key={cat} variant="outline" className="text-xs">{cat}: {count}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
