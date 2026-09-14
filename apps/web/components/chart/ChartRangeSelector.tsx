"use client";

import { CHART_RANGES, type ChartRange } from "@crypto-stocks/lib";
import { SharedLayoutBg } from "../motion/shared-layout-bg";

export function ChartRangeSelector({
  range,
  onChange,
}: {
  range: ChartRange;
  onChange: (range: ChartRange) => void;
}) {
  return (
    <SharedLayoutBg
      className="flex-row gap-0"
      pillClassName="bg-primary/[0.08] dark:bg-primary/[0.12]"
      inset={2}
    >
      {CHART_RANGES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`rounded-lg px-2.5 py-1 font-mono text-xs font-semibold transition ${
            range === r
              ? "bg-white text-zinc-900 shadow-sm dark:bg-white/20 dark:text-white dark:shadow-none"
              : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          {r}
        </button>
      ))}
    </SharedLayoutBg>
  );
}

