"use client";

import type { AssetRef } from "@crypto-stocks/lib";
import { SentimentIndex } from "./SentimentIndex";

/**
 * Read-only market signals strip, shown only for crypto assets. Polymarket
 * has no stock up/down markets and the Fear & Greed index is crypto-wide, so
 * the whole strip is hidden for stocks.
 */
export function MarketSignals({ asset }: { asset: AssetRef }) {
  if (asset.kind !== "crypto") return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SentimentIndex />
    </div>
  );
}
