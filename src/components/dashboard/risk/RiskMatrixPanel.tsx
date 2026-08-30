'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { type Risk, RISK_LEVEL_COLOR, RISK_LEVEL_LABEL, matrixLevelFromScore } from '@/types/risk';
import { subscribeToRisks } from '@/lib/riskData';

interface RiskMatrixPanelProps {
  onSelectRisk?: (id: string) => void;
}

/**
 * Risk Matrix interaktif 5x5 — SUMBU X: DAMPAK (1-5), SUMBU Y: PROBABILITAS (1-5).
 * Menggunakan matrixScore (Dampak x Probabilitas SAJA, TANPA Controllability) —
 * logika ini SENGAJA terpisah dari Skor Risiko (yang memakai 3 faktor), sesuai
 * instruksi poin 12. Batas level: Sangat Tinggi >15, Tinggi 10-14, Sedang 5-9,
 * Rendah 3-4, Sangat Rendah 1-2 — persis sesuai dokumen acuan.
 */
export function RiskMatrixPanel({ onSelectRisk }: RiskMatrixPanelProps) {
  const [rows, setRows] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{ p: number; d: number } | null>(null);

  useEffect(() => {
    const unsub = subscribeToRisks({}, (data) => { setRows(data); setLoading(false); }, () => setLoading(false));
    return unsub;
  }, []);

  const grid = useMemo(() => {
    const cells: Record<string, Risk[]> = {};
    for (const r of rows) {
      if (!r.assessment) continue;
      const key = `${r.assessment.probabilitas}-${r.assessment.dampak}`;
      (cells[key] ??= []).push(r);
    }
    return cells;
  }, [rows]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  const probLevels = [5, 4, 3, 2, 1]; // sumbu Y, dari atas (tertinggi) ke bawah
  const dampakLevels = [1, 2, 3, 4, 5]; // sumbu X, dari kiri ke kanan

  const selectedRisks = selectedCell ? grid[`${selectedCell.p}-${selectedCell.d}`] ?? [] : [];

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Risk Matrix (Probabilitas × Dampak)</h2>
      <p className="text-xs text-muted-foreground max-w-2xl">
        Matrix ini HANYA menggunakan Probabilitas × Dampak (tanpa Controllability) — berbeda dari
        Skor Risiko final pada Risk Register yang memakai tiga faktor (Dampak × Probabilitas × Controllability).
      </p>

      <div className="flex gap-4">
        <Card className="flex-1">
          <CardContent className="pt-6">
            <div className="flex">
              <div className="flex flex-col justify-around items-center mr-2 text-xs font-medium text-muted-foreground -rotate-0">
                <span className="[writing-mode:vertical-rl] rotate-180 mb-2">PROBABILITAS</span>
              </div>
              <div className="flex-1">
                <div className="grid grid-cols-5 gap-1.5">
                  {probLevels.map((p) =>
                    dampakLevels.map((d) => {
                      const score = p * d;
                      const level = matrixLevelFromScore(score);
                      const cellRisks = grid[`${p}-${d}`] ?? [];
                      const isSelected = selectedCell?.p === p && selectedCell?.d === d;
                      return (
                        <button
                          key={`${p}-${d}`}
                          onClick={() => setSelectedCell(isSelected ? null : { p, d })}
                          className="aspect-square rounded-md flex flex-col items-center justify-center text-white transition-transform hover:scale-105 relative"
                          style={{ backgroundColor: RISK_LEVEL_COLOR[level], outline: isSelected ? '3px solid #0f172a' : 'none' }}
                        >
                          <span className="text-lg font-bold leading-none">{score}</span>
                          {cellRisks.length > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-white text-[10px] font-bold text-slate-800 rounded-full size-5 flex items-center justify-center border">
                              {cellRisks.length}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
                <div className="grid grid-cols-5 gap-1.5 mt-1.5">
                  {dampakLevels.map((d) => <div key={d} className="text-center text-[10px] text-muted-foreground">{d}</div>)}
                </div>
                <p className="text-center text-xs font-medium text-muted-foreground mt-1">DAMPAK</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 justify-center mt-4">
              {Object.entries(RISK_LEVEL_LABEL).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1.5 text-xs">
                  <span className="size-3 rounded" style={{ backgroundColor: RISK_LEVEL_COLOR[k as keyof typeof RISK_LEVEL_COLOR] }} />
                  {v}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="w-80 shrink-0">
          <CardHeader><CardTitle className="text-sm">
            {selectedCell ? `Risiko pada P${selectedCell.p} × D${selectedCell.d}` : 'Klik sel matrix untuk melihat daftar risiko'}
          </CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
            {selectedCell && selectedRisks.length === 0 && <p className="text-xs text-muted-foreground">Tidak ada risiko pada posisi ini.</p>}
            {selectedRisks.map((r) => (
              <button key={r.id} onClick={() => onSelectRisk?.(r.id)} className="w-full text-left border rounded-md p-2 hover:bg-muted/40">
                <p className="text-xs font-mono text-muted-foreground">{r.riskCode}</p>
                <p className="text-sm font-medium truncate">{r.risiko}</p>
                <p className="text-xs text-muted-foreground">{r.unitLokasi}</p>
                {r.assessment && <Badge variant="outline" className="text-[10px] mt-1">Skor Risiko: {r.assessment.skorRisiko}</Badge>}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
