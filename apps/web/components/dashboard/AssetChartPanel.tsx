"use client";

import {
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
import { AnimatedBadge, type AnimatedBadgeStatus } from "../motion/animated-badge";
import { Loader } from "../motion/loader";
import { NumberTicker } from "../motion/number-ticker";
import { ChartRangeSelector } from "../chart/ChartRangeSelector";
import { PriceChart, type PriceChartHandle } from "../chart/PriceChart";
import { useCrypto24hStats } from "../chart/useCrypto24hStats";
import { useCryptoKlineStream } from "../chart/useCryptoKlineStream";
import { useStockDayStats } from "../chart/useStockDayStats";
import { useStockPolling } from "../chart/useStockPolling";
import { useSelectedAsset } from "../providers/SelectedAssetContext";
import { PriceAlertPanel } from "./PriceAlertPanel";

function AssetHeader({
  asset,
  status,
  price,
  dayStats,
  windowLabel,
}: {
  asset: AssetRef;
  status: "connecting" | "open" | "closed";
  price: number | null;
  dayStats: DayStats;
  windowLabel: string;
}) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h2 className="flex items-center gap-1.5 text-lg font-semibold">
          {asset.name}{" "}
          <span className="font-mono text-sm font-normal text-zinc-500 dark:text-zinc-400">
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
            className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </h2>
        <DayStatsRow stats={dayStats} windowLabel={windowLabel} />
        <PriceAlertPanel asset={asset} price={price} />
      </div>
      <StatusBadge status={status} price={price} />
    </div>
  );
}

function CryptoChart({
  asset,
  range,
  chart,
  onSeedingChange,
}: {
  asset: AssetRef;
  range: ChartRange;
  chart: PriceChartHandle | null;
  onSeedingChange: (seeding: boolean) => void;
}) {
  const { setLivePrice, setMarketStats } = useSelectedAsset();
  const { price, stats, status, seeding } = useCryptoKlineStream(asset.symbol, range, chart);
  const dayStats = useCrypto24hStats(asset.symbol);

  useEffect(() => {
    setLivePrice(price);
    setMarketStats(stats);
  }, [price, stats, setLivePrice, setMarketStats]);

  useEffect(() => {
    onSeedingChange(seeding);
  }, [seeding, onSeedingChange]);

  return <AssetHeader asset={asset} status={status} price={price} dayStats={dayStats} windowLabel="24h" />;
}

function StockChart({
  asset,
  range,
  chart,
  onSeedingChange,
}: {
  asset: AssetRef;
  range: ChartRange;
  chart: PriceChartHandle | null;
  onSeedingChange: (seeding: boolean) => void;
}) {
  const { setLivePrice, setMarketStats } = useSelectedAsset();
  const { price, stats, status, seeding } = useStockPolling(asset.symbol, range, chart);
  const dayStats = useStockDayStats(asset.symbol);

  useEffect(() => {
    setLivePrice(price);
    setMarketStats(stats);
  }, [price, stats, setLivePrice, setMarketStats]);

  useEffect(() => {
    onSeedingChange(seeding);
  }, [seeding, onSeedingChange]);

  return <AssetHeader asset={asset} status={status} price={price} dayStats={dayStats} windowLabel="Today" />;
}

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

function StatusBadge({
  status,
  price,
}: {
  status: "connecting" | "open" | "closed";
  price: number | null;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-lg font-medium tabular-nums">
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
      <AnimatedBadge status={STATUS_TO_BADGE[status]} size="sm" contentKey={status}>
        {STATUS_LABEL[status]}
      </AnimatedBadge>
    </div>
  );
}

function DayStatsRow({ stats, windowLabel }: { stats: DayStats; windowLabel: string }) {
  const hasAny = stats.changePercent != null || stats.high != null || stats.low != null;
  if (!hasAny) return null;

  const positive = (stats.changePercent ?? 0) >= 0;

  return (
    <div className="font-mono mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
      {stats.changePercent != null && (
        <span className={positive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
          {positive ? "+" : ""}
          {stats.changePercent.toFixed(2)}% ({windowLabel})
        </span>
      )}
      {stats.high != null && <span>High {formatCurrency(stats.high)}</span>}
      {stats.low != null && <span>Low {formatCurrency(stats.low)}</span>}
      {stats.volume != null && <span>Vol {formatVolume(stats.volume)}</span>}
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

export function AssetChartPanel({ asset }: { asset: AssetRef }) {
  const [chartHandle, setChartHandle] = useState<PriceChartHandle | null>(null);
  const [seeding, setSeeding] = useState(true);
  const { range, setRange } = useChartRange();
  const handleReady = useCallback((handle: PriceChartHandle) => setChartHandle(handle), []);
  const rangeKey = `${asset.symbol}:${range}`;

  const handleExportCsv = useCallback(() => {
    if (!chartHandle) return;
    const candles = chartHandle.getData();
    if (candles.length === 0) return;
    exportCandlesToCsv(asset, range, candles);
  }, [chartHandle, asset, range]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {asset.kind === "crypto" ? (
          <CryptoChart
            key={rangeKey}
            asset={asset}
            range={range}
            chart={chartHandle}
            onSeedingChange={setSeeding}
          />
        ) : (
          <StockChart
            key={rangeKey}
            asset={asset}
            range={range}
            chart={chartHandle}
            onSeedingChange={setSeeding}
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <ChartRangeSelector range={range} onChange={setRange} />
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={!chartHandle}
          aria-label={`Export ${asset.symbol} chart data as CSV`}
          title="Export CSV"
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-white/10"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="relative">
        {seeding && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/60 backdrop-blur-sm dark:bg-zinc-950/60">
            <Loader variant="dots" size={28} />
          </div>
        )}
        <PriceChart onReady={handleReady} timeVisible={range === "1D" || range === "1W"} />
      </div>
    </div>
  );
}
