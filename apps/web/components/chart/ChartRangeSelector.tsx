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
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${
            range === r ? "bg-foreground text-background" : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {r}
        </button>
      ))}
    </SharedLayoutBg>
  );
}
