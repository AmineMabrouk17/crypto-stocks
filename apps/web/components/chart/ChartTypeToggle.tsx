"use client";

import type { ChartType } from "@crypto-stocks/lib";
import { AreaChart, CandlestickChart } from "lucide-react";

const CHART_TYPE_VIEW: Record<ChartType, { label: string; next: ChartType; icon: typeof AreaChart }> = {
  area: { label: "Area", next: "candlestick", icon: AreaChart },
  candlestick: { label: "Candles", next: "area", icon: CandlestickChart },
};

/** One compact toggle that shows the active chart type and switches to the other. */
export function ChartTypeToggle({
  chartType,
  onChange,
}: {
  chartType: ChartType;
  onChange: (type: ChartType) => void;
}) {
  const current = CHART_TYPE_VIEW[chartType];
  const next = CHART_TYPE_VIEW[current.next];
  const Icon = current.icon;

  return (
    <button
      type="button"
      onClick={() => onChange(current.next)}
      aria-label={`Chart type: ${current.label}. Switch to ${next.label}`}
      title={`Chart type: ${current.label} — switch to ${next.label}`}
      className="flex h-8 items-center gap-1.5 rounded-xl border border-black/5 bg-black/[0.03] px-2.5 text-zinc-500 transition hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:text-zinc-200"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span className="font-mono text-xs font-medium">{current.label}</span>
    </button>
  );
}
