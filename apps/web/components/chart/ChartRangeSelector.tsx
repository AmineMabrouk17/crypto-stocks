"use client";

import { CHART_RANGES, type ChartRange } from "@crypto-stocks/lib";
import { SharedLayoutBg } from "../motion/shared-layout-bg";
import { ToolbarMenu } from "./ToolbarMenu";

/** Ranges that stay one click away; the rest live behind the More disclosure. */
export const INLINE_RANGES: ChartRange[] = ["1D", "1W", "1M"];
const MORE_RANGES = CHART_RANGES.filter((r) => !INLINE_RANGES.includes(r));

const RANGE_LABELS: Record<ChartRange, string> = {
  "1D": "1 day",
  "1W": "1 week",
  "1M": "1 month",
  "6M": "6 months",
  "1Y": "1 year",
  YTD: "Year to date",
  ALL: "All time",
};

const CHIP_CLASS = "rounded-lg px-2.5 py-1 font-mono text-xs font-semibold transition";

function chipClass(active: boolean) {
  return `${CHIP_CLASS} ${
    active
      ? "bg-white text-zinc-900 shadow-sm dark:bg-white/20 dark:text-white dark:shadow-none"
      : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
  }`;
}

export function ChartRangeSelector({
  range,
  onChange,
}: {
  range: ChartRange;
  onChange: (range: ChartRange) => void;
}) {
  const activeOverflow = MORE_RANGES.includes(range) ? range : null;
  const moreLabel = activeOverflow ? `${activeOverflow} (selected)` : "More";

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Chart range">
      <SharedLayoutBg
        className="flex-row gap-0"
        pillClassName="bg-primary/[0.08] dark:bg-primary/[0.12]"
        inset={2}
      >
        {INLINE_RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            aria-label={RANGE_LABELS[r]}
            aria-pressed={range === r}
            title={RANGE_LABELS[r]}
            className={chipClass(range === r)}
          >
            {r}
          </button>
        ))}
      </SharedLayoutBg>

      <ToolbarMenu
        trigger={<span className="font-mono text-xs font-semibold">{moreLabel}</span>}
        triggerLabel={activeOverflow ? `More chart ranges. ${RANGE_LABELS[activeOverflow]} selected` : "More chart ranges"}
        triggerTitle="More chart ranges"
        triggerClassName={
          activeOverflow
            ? "h-6 gap-0.5 border-transparent bg-white px-2 text-zinc-900 shadow-sm hover:text-zinc-900 dark:bg-white/20 dark:text-white dark:hover:text-white dark:shadow-none"
            : "h-6 gap-0.5 border-transparent bg-transparent px-2 hover:bg-black/5 dark:bg-transparent dark:hover:bg-white/[0.06]"
        }
        menuLabel="More chart ranges"
        items={MORE_RANGES.map((r) => ({ value: r, label: `${r} — ${RANGE_LABELS[r]}` }))}
        selectedValue={range}
        singleChoice
        onSelect={(value) => onChange(value as ChartRange)}
      />
    </div>
  );
}
