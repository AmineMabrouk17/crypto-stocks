"use client";

import {
  CHART_TYPES,
  decimalsForPrice,
  formatCurrency,
  formatNumber,
  type AssetRef,
  type Candle,
  type ChartRange,
  type DayStats,
} from "@crypto-stocks/lib";
import { Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useChartRange } from "@/lib/useChartRange";
import { useChartType } from "@/lib/useChartType";
import { SharedLayoutBg } from "../motion/shared-layout-bg";
import { AnimatedBadge, type AnimatedBadgeStatus } from "../motion/animated-badge";
import { Loader } from "../motion/loader";
import { NumberTicker } from "../motion/number-ticker";
import { ChartRangeSelector } from "../chart/ChartRangeSelector";
import { MarketSignals } from "../chart/MarketSignals";
import { PriceChart, type PriceChartHandle } from "../chart/PriceChart";
import { useCrypto24hStats } from "../chart/useCrypto24hStats";
import { useCryptoKlineStream } from "../chart/useCryptoKlineStream";
import { useStockDayStats } from "../chart/useStockDayStats";
import { useStockPolling } from "../chart/useStockPolling";
import { useSelectedAsset } from "../providers/SelectedAssetContext";
import { PriceAlertPanel } from "./PriceAlertPanel";

const STATUS_TO_BADGE: Record<"connecting" | "open" | "closed", AnimatedBadgeStatus> = {
  connecting: "loading",
  open: "success",
  closed: "danger",
};

const STATUS_LABEL: Record<"connecting" | "open" | "closed", string> = {
  connecting: "Connecting",
  open: "Live",
  closed: "Disconnected",
};

function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) return `${(volume / 1_000_000_000).toFixed(2)}B`;
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(2)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(2)}K`;
  return volume.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function AssetHeader({
  asset,
  status,
  price,
  stats,
  statsWindowLabel,
}: {
  asset: AssetRef;
  status: "connecting" | "open" | "closed";
  price: number | null;
  stats: DayStats;
  statsWindowLabel: string;
}) {
  const positive = (stats.changePercent ?? 0) >= 0;

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-500 to-emerald-400 p-[1px] shadow-glow-accent">
            <span className="flex h-full w-full items-center justify-center rounded-[11px] bg-bento-surface font-mono text-sm font-bold text-emerald-400">
              {asset.symbol.charAt(0)}
            </span>
          </span>
          <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xl font-bold tracking-tight text-zinc-900 lg:text-2xl dark:text-white">
            {asset.name}
            <span className="font-mono text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
              {asset.symbol}
            </span>
            <Link
              href={
                asset.kind === "crypto"
                  ? `/asset/${asset.symbol}?id=${encodeURIComponent(asset.id)}`
                  : `/asset/${asset.symbol}`
              }
              aria-label={`Open ${asset.symbol} full page`}
              title="Open full page"
              className="text-zinc-400 transition hover:text-emerald-600 dark:text-zinc-500 dark:hover:text-emerald-400"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </h2>
          <StatusBadge status={status} />
        </div>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono">
          <span className="text-3xl font-extrabold tracking-tight tabular-nums text-zinc-900 lg:text-4xl dark:text-white">
            {price != null ? (
              (() => {
                const decimals = decimalsForPrice(price);
                const scale = 10 ** decimals;
                return (
                  <NumberTicker
                    value={Math.round(price * scale)}
                    duration={0.5}
                    stagger={0.02}
                    prefix="$"
                    format={(n) => formatNumber(n / scale, decimals)}
                  />
                );
              })()
            ) : (
              "—"
            )}
          </span>
          {stats.changePercent != null && (
            <span
              className={`text-sm font-semibold tabular-nums ${
                positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {positive ? "+" : ""}
              {stats.changePercent.toFixed(2)}%{" "}
              <span className="font-sans text-xs font-normal text-zinc-500 dark:text-zinc-400">
                ({statsWindowLabel})
              </span>
            </span>
          )}
        </div>
      </div>

      <StatsRow stats={stats} statsWindowLabel={statsWindowLabel} />
    </div>
  );
}

function StatusBadge({ status }: { status: "connecting" | "open" | "closed" }) {
  return (
    <AnimatedBadge
      status={STATUS_TO_BADGE[status]}
      size="sm"
      contentKey={status}
      className="font-mono uppercase tracking-wide"
    >
      {STATUS_LABEL[status]}
    </AnimatedBadge>
  );
}

function StatsRow({ stats, statsWindowLabel }: { stats: DayStats; statsWindowLabel: string }) {
  const hasAny = stats.high != null || stats.low != null || stats.volume != null;
  if (!hasAny) return null;

  const prefix = statsWindowLabel === "24h" ? "24h" : "Today";
  const segments: { label: string; value: string }[] = [];
  if (stats.high != null) segments.push({ label: `${prefix} High`, value: formatCurrency(stats.high) });
  if (stats.low != null) segments.push({ label: `${prefix} Low`, value: formatCurrency(stats.low) });
  if (stats.volume != null) segments.push({ label: "Volume", value: formatVolume(stats.volume) });

  return (
    <div className="flex flex-wrap items-center rounded-2xl border border-black/5 bg-black/[0.03] p-2 dark:border-white/[0.05] dark:bg-white/[0.03]">
      {segments.map((seg, i) => (
        <div key={seg.label} className="flex items-center gap-x-3 sm:gap-x-4">
          {i > 0 && (
            <span
              className="mx-1 h-5 w-px shrink-0 bg-black/10 sm:mx-0 dark:bg-white/[0.08]"
              aria-hidden
            />
          )}
          <span className="px-1">
            <span className="block font-sans text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {seg.label}
            </span>
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{seg.value}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportCandlesToCsv(asset: AssetRef, range: ChartRange, candles: Candle[]) {
  const header = "Time,Open,High,Low,Close";
  const rows = candles.map((c) => {
    const iso = new Date(c.time * 1000).toISOString();
    return `${iso},${c.open},${c.high},${c.low},${c.close}`;
  });
  const csv = [header, ...rows].join("\n");
  downloadTextFile(`${asset.symbol}_${range}.csv`, csv, "text/csv;charset=utf-8;");
}

export function AssetChartPanel({
  asset,
  showSignals = true,
}: {
  asset: AssetRef;
  showSignals?: boolean;
}) {
  const [chartHandle, setChartHandle] = useState<PriceChartHandle | null>(null);
  const { range, setRange } = useChartRange();
  const [chartType, setChartType] = useChartType();
  const handleReady = useCallback((handle: PriceChartHandle) => setChartHandle(handle), []);

  const { setLivePrice, setMarketStats } = useSelectedAsset();

  const {
    price: cryptoPrice,
    stats: cryptoStats,
    status: cryptoStatus,
    seeding: cryptoSeeding,
  } = useCryptoKlineStream(
    asset.kind === "crypto" ? asset.symbol : "",
    range,
    asset.kind === "crypto" ? chartHandle : null,
  );
  const cryptoDayStats = useCrypto24hStats(asset.kind === "crypto" ? asset.symbol : "");

  const {
    price: stockPrice,
    stats: stockStats,
    status: stockStatus,
    seeding: stockSeeding,
  } = useStockPolling(
    asset.kind === "stock" ? asset.symbol : "",
    range,
    asset.kind === "stock" ? chartHandle : null,
  );
  const stockDayStats = useStockDayStats(asset.kind === "stock" ? asset.symbol : "");

  const isCrypto = asset.kind === "crypto";
  const price = isCrypto ? cryptoPrice : stockPrice;
  const stats = isCrypto ? cryptoStats : stockStats;
  const status = isCrypto ? cryptoStatus : stockStatus;
  const streamSeeding = isCrypto ? cryptoSeeding : stockSeeding;
  const dayStats = isCrypto ? cryptoDayStats : stockDayStats;
  const statsWindowLabel = isCrypto ? "24h" : "Today";

  useEffect(() => {
    setLivePrice(price);
    setMarketStats(stats);
  }, [price, stats, setLivePrice, setMarketStats]);

  const handleExportCsv = useCallback(() => {
    if (!chartHandle) return;
    const candles = chartHandle.getData();
    if (candles.length === 0) return;
    exportCandlesToCsv(asset, range, candles);
  }, [chartHandle, asset, range]);

  return (
    <div className="glass-tile relative flex flex-col gap-4 overflow-hidden rounded-3xl p-4 sm:p-5 lg:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl"
      />
      <div className="relative z-10 flex flex-col gap-4">
        <AssetHeader asset={asset} status={status} price={price} stats={dayStats} statsWindowLabel={statsWindowLabel} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-black/5 bg-black/[0.03] p-1 dark:border-white/[0.06] dark:bg-white/[0.04]">
              <ChartRangeSelector range={range} onChange={setRange} />
            </div>
            <div className="inline-flex rounded-xl border border-black/5 bg-black/[0.03] p-1 dark:border-white/[0.06] dark:bg-white/[0.04]">
              <SharedLayoutBg className="flex-row gap-0" pillClassName="bg-primary/[0.12] dark:bg-primary/[0.18]" inset={2}>
                {CHART_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setChartType(t)}
                    className={`rounded-lg px-2.5 py-1 font-mono text-xs font-medium transition ${
                      chartType === t
                        ? "bg-white text-zinc-900 shadow-sm dark:bg-white/20 dark:text-white dark:shadow-none"
                        : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                    }`}
                  >
                    {t === "area" ? "Area" : "Candle"}
                  </button>
                ))}
              </SharedLayoutBg>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <PriceAlertPanel asset={asset} price={price} />
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!chartHandle}
              aria-label={`Export ${asset.symbol} chart data as CSV`}
              title="Export CSV"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/5 bg-black/[0.03] text-zinc-500 transition hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="relative">
          {streamSeeding && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/60 backdrop-blur-sm dark:bg-zinc-950/50">
              <Loader variant="dots" size={28} />
            </div>
          )}
          <PriceChart height={320} onReady={handleReady} timeVisible={range === "1D" || range === "1W"} chartType={chartType} />
        </div>

        {showSignals && <MarketSignals asset={asset} />}
      </div>
    </div>
  );
}
