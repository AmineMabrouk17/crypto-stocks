"use client";

import { formatCurrency, type AssetRef } from "@crypto-stocks/lib";
import { FileDown } from "lucide-react";
import { jsPDF } from "jspdf";
import { useCallback } from "react";
import { useSelectedAsset } from "../providers/SelectedAssetContext";
import { useWatchlist } from "@/lib/useWatchlist";
import { SharedLayoutBg } from "../motion/shared-layout-bg";

function isSameAsset(a: AssetRef, b: AssetRef) {
  return a.kind === b.kind && a.symbol === b.symbol;
}

function exportWatchlistToPdf(watchlist: AssetRef[], selected: AssetRef, livePrice: number | null) {
  const doc = new jsPDF();
  const marginX = 14;
  let y = 20;

  doc.setFontSize(18);
  doc.text("Portfolio Summary", marginX, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generated at ${new Date().toLocaleString()}`, marginX, y);
  doc.setTextColor(0);
  y += 10;

  if (livePrice != null) {
    doc.setFontSize(12);
    doc.text("Currently viewing", marginX, y);
    y += 7;
    doc.setFontSize(11);
    doc.text(
      `${selected.symbol} (${selected.name}) — ${formatCurrency(livePrice)}`,
      marginX,
      y,
    );
    y += 10;
  }

  doc.setFontSize(12);
  doc.text("Watchlist", marginX, y);
  y += 8;

  doc.setFontSize(10);
  doc.text("Kind", marginX, y);
  doc.text("Symbol", marginX + 25, y);
  doc.text("Name", marginX + 65, y);
  y += 2;
  doc.line(marginX, y, 196, y);
  y += 6;

  for (const asset of watchlist) {
    doc.text(asset.kind === "crypto" ? "Crypto" : "Stock", marginX, y);
    doc.text(asset.symbol, marginX + 25, y);
    doc.text(asset.name, marginX + 65, y);
    y += 7;
  }

  const date = new Date().toISOString().slice(0, 10);
  doc.save(`portfolio-summary-${date}.pdf`);
}

export function Watchlist() {
  const { watchlist, removeAsset } = useWatchlist();
  const { selected, setSelected, livePrice } = useSelectedAsset();

  const handleExportPdf = useCallback(() => {
    exportWatchlistToPdf(watchlist, selected, livePrice);
  }, [watchlist, selected, livePrice]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Watchlist
        </span>
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={watchlist.length === 0}
          aria-label="Export portfolio summary as PDF"
          title="Export PDF"
          className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-white/10"
        >
          <FileDown className="h-3.5 w-3.5" />
        </button>
      </div>
      <SharedLayoutBg className="gap-1" pillClassName="bg-primary/[0.08] dark:bg-primary/[0.12]">
        {watchlist.map((asset) => {
          const active = isSameAsset(asset, selected);
          return (
            <div
              key={`${asset.kind}:${asset.symbol}`}
              role="listitem"
              className={`group flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                active ? "bg-foreground text-background" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => setSelected(asset)}
                className="flex flex-1 items-center gap-2 text-left"
              >
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                    active
                      ? "bg-background/20"
                      : "bg-black/5 text-zinc-500 dark:bg-white/10 dark:text-zinc-400"
                  }`}
                >
                  {asset.kind === "crypto" ? "crypto" : "stock"}
                </span>
                <span className="font-mono font-medium">{asset.symbol}</span>
                <span
                  className={`truncate text-xs ${active ? "opacity-80" : "text-zinc-500 dark:text-zinc-400"}`}
                >
                  {asset.name}
                </span>
              </button>
              <button
                type="button"
                onClick={() => removeAsset(asset)}
                aria-label={`Remove ${asset.symbol} from watchlist`}
                className={`ml-2 rounded px-1 text-xs opacity-0 group-hover:opacity-100 ${
                  active ? "hover:bg-background/20" : "hover:bg-black/10 dark:hover:bg-white/10"
                }`}
              >
                ×
              </button>
            </div>
          );
        })}
      </SharedLayoutBg>
    </div>
  );
}
