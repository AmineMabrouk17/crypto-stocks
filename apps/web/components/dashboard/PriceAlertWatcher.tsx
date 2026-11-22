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
 * is currently selected/streaming, and records that scope in the alert store.
 *
 * Live price data only exists for one asset at a time — the one the user has
 * open — and only while this tab is running, so alerts for other assets (or
 * after the tab closes) are persisted as paused. Streaming every watchlisted
 * asset in the background would require a WebSocket per symbol and a worker
 * that outlives the tab; neither exists here, so the panel must not imply it.
 */
export function PriceAlertWatcher() {
  const { selected, livePrice } = useSelectedAsset();
  const { alerts, markTriggered, markChecked, pauseAsset, pauseAllExcept, pauseAll } = usePriceAlerts();

  const assetKind = selected.kind;
  const assetSymbol = selected.symbol;

  // Leaving this asset (switch, route change, unmount) stops its tracking.
  useEffect(() => {
    const asset = { kind: assetKind, symbol: assetSymbol };
    return () => pauseAsset(asset);
  }, [assetKind, assetSymbol, pauseAsset]);

  // Alerts for assets that are not open cannot be checked this session. This
  // covers stale state from a closed/killed tab that never got to persist it.
  useEffect(() => {
    pauseAllExcept({ kind: assetKind, symbol: assetSymbol });
  }, [assetKind, assetSymbol, alerts, pauseAllExcept]);

  // Closing or navigating away ends all tracking before the tab goes.
  useEffect(() => {
    const handlePageHide = () => pauseAll();
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [pauseAll]);

  useEffect(() => {
    if (livePrice == null) return;

    markChecked({ kind: assetKind, symbol: assetSymbol });

    const matching = alerts.filter(
      (alert) =>
        alert.triggeredAt == null && alert.assetKind === assetKind && alert.assetSymbol === assetSymbol,
    );

    for (const alert of matching) {
      if (isCrossed(alert, livePrice)) {
        markTriggered(alert.id);
        notify(alert, livePrice);
      }
    }
  }, [livePrice, assetKind, assetSymbol, alerts, markTriggered, markChecked]);

  return null;
}
