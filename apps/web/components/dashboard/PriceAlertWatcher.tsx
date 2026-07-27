"use client";

import type { PriceAlert } from "@crypto-stocks/lib";
import { useEffect } from "react";
import { usePriceAlerts } from "@/lib/usePriceAlerts";
import { useSelectedAsset } from "../providers/SelectedAssetContext";

function isCrossed(alert: PriceAlert, price: number): boolean {
  return alert.direction === "above" ? price >= alert.targetPrice : price <= alert.targetPrice;
}

function notify(alert: PriceAlert, price: number) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const verb = alert.direction === "above" ? "rose above" : "fell below";
  try {
    new Notification(`${alert.assetSymbol} ${verb} your target`, {
      body: `${alert.assetName} is now $${price} (target ${alert.direction} $${alert.targetPrice})`,
      tag: alert.id,
    });
  } catch {
    // Notification constructor can throw in unsupported contexts — non-fatal.
  }
}

/**
 * Mounted once near the app root. Evaluates price alerts for the asset that
 * is currently selected/streaming.
 *
 * Live price data only exists for one asset at a time — the one the user has
 * open — so alerts for watchlist assets that aren't currently displayed are
 * simply not checked until the user opens them again. This is a deliberate
 * scope limitation, not a bug: streaming every watchlisted asset in the
 * background would require a WebSocket per symbol.
 */
export function PriceAlertWatcher() {
  const { selected, livePrice } = useSelectedAsset();
  const { alerts, markTriggered } = usePriceAlerts();

  useEffect(() => {
    if (livePrice == null) return;

    const matching = alerts.filter(
      (alert) =>
        alert.triggeredAt == null &&
        alert.assetKind === selected.kind &&
        alert.assetSymbol === selected.symbol,
    );

    for (const alert of matching) {
      if (isCrossed(alert, livePrice)) {
        markTriggered(alert.id);
        notify(alert, livePrice);
      }
    }
  }, [livePrice, selected, alerts, markTriggered]);

  return null;
}
