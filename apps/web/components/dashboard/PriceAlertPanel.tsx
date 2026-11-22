"use client";

import { decimalsForPrice, formatCurrency, type AssetRef } from "@crypto-stocks/lib";
import { Bell, BellOff, TrendingDown, TrendingUp, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { priceAlertScope, usePriceAlerts } from "@/lib/usePriceAlerts";
import { StatefulButton, type ButtonState } from "../motion/button/stateful";

type PermissionState = NotificationPermission | "unsupported";

function readPermission(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function isSameAsset(alert: { assetKind: string; assetSymbol: string }, asset: AssetRef) {
  return alert.assetKind === asset.kind && alert.assetSymbol === asset.symbol;
}

function joinSymbols(symbols: string[]): string {
  if (symbols.length <= 2) return symbols.join(" and ");
  return `${symbols.slice(0, 2).join(", ")} +${symbols.length - 2} more`;
}

function trackingStatus(count: number, tracked: number, symbol: string): string {
  const noun = count === 1 ? "alert" : "alerts";
  if (tracked === count) {
    return `Tracking ${count} active ${noun} — only while this tab is open.`;
  }
  if (tracked === 0) {
    return `Paused — ${count} ${noun} resume when ${symbol} is open here with live prices.`;
  }
  return `Tracking ${tracked} of ${count} ${noun} — the rest resume when ${symbol} has live prices.`;
}

export function PriceAlertPanel({ asset, price }: { asset: AssetRef; price: number | null }) {
  const { alerts, addAlert, removeAlert } = usePriceAlerts();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [buttonState, setButtonState] = useState<ButtonState>("idle");
  const [permission, setPermission] = useState<PermissionState>(readPermission);

  const assetAlerts = alerts.filter((a) => isSameAsset(a, asset));
  const activeAlerts = assetAlerts.filter((a) => a.triggeredAt == null);
  const live = price != null;
  const trackedCount = activeAlerts.filter(
    (a) => priceAlertScope(a, { assetOpen: true, live }) === "tracking",
  ).length;

  // Alerts for other assets are never watched here, so surface them as paused
  // instead of leaving them silently "active" in localStorage.
  const pausedElsewhere = alerts.filter(
    (a) => a.triggeredAt == null && !isSameAsset(a, asset),
  );
  const pausedSymbols = Array.from(new Set(pausedElsewhere.map((a) => a.assetSymbol)));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = Number(target);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setButtonState("error");
      window.setTimeout(() => setButtonState("idle"), 1400);
      return;
    }

    setButtonState("loading");

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      const result = await Notification.requestPermission();
      setPermission(result);
    }

    addAlert({
      assetKind: asset.kind,
      assetSymbol: asset.symbol,
      assetName: asset.name,
      targetPrice: parsed,
      direction,
    });

    setButtonState("success");
    setTarget("");
    window.setTimeout(() => setButtonState("idle"), 1200);
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={
          open
            ? "Close price alerts"
            : activeAlerts.length > 0
              ? `Price alerts — ${activeAlerts.length} active for ${asset.symbol}, tracked only while this tab is open`
              : "Set a price alert"
        }
        title="Price alerts"
        className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-black/5 bg-black/[0.03] text-zinc-500 transition hover:text-zinc-800 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <Bell className="h-3.5 w-3.5" />
        {activeAlerts.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-black/5 bg-indigo-600 px-1 text-[10px] font-semibold leading-none text-white dark:border-white/10">
            {activeAlerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 w-full min-w-72 max-w-xs rounded-2xl border border-black/10 bg-white/95 p-3 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-bento-surface/95">
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                required
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={
                  price != null ? formatCurrency(price, decimalsForPrice(price)) : "Target price"
                }
                aria-label="Target price"
                className="w-full min-w-0 rounded-lg border border-black/10 bg-black/[0.03] px-2 py-1.5 font-mono text-sm outline-none transition focus:border-emerald-500/50 dark:border-white/15 dark:bg-white/[0.04] dark:focus:border-emerald-500/60"
              />
              <div className="flex shrink-0 overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
                <button
                  type="button"
                  onClick={() => setDirection("above")}
                  aria-pressed={direction === "above"}
                  title="Alert when price rises above target"
                  className={`flex items-center gap-1 px-2 py-1.5 text-xs ${
                    direction === "above"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "text-zinc-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
                  }`}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("below")}
                  aria-pressed={direction === "below"}
                  title="Alert when price falls below target"
                  className={`flex items-center gap-1 border-l border-black/10 px-2 py-1.5 text-xs dark:border-white/15 ${
                    direction === "below"
                      ? "bg-red-500/15 text-red-600 dark:text-red-400"
                      : "text-zinc-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
                  }`}
                >
                  <TrendingDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <StatefulButton
              type="submit"
              state={buttonState}
              successText="Alert created"
              errorText="Enter a valid price"
              className="w-full justify-center text-sm"
            >
              Create alert
            </StatefulButton>

            <p className="text-[10px] leading-snug text-zinc-400 dark:text-zinc-500">
              {`Checked only while this tab is open on ${asset.symbol}. Switching assets or closing the tab pauses tracking — no background monitoring.`}
            </p>

            {(permission === "denied" || permission === "unsupported") && (
              <div className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
                <BellOff className="mt-0.5 h-3 w-3 shrink-0" />
                <span>
                  {permission === "denied"
                    ? "Browser notifications are blocked — alerts are still saved and tracked while this asset is open."
                    : "This browser doesn't support notifications — alerts are still saved and tracked while this asset is open."}
                </span>
              </div>
            )}
          </form>

          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="mt-3 flex flex-col gap-1 text-[11px] leading-snug"
          >
            {activeAlerts.length > 0 && (
              <p
                className={`flex items-start gap-1.5 ${
                  trackedCount === activeAlerts.length
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-amber-700 dark:text-amber-400"
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                    trackedCount === activeAlerts.length ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                <span>{trackingStatus(activeAlerts.length, trackedCount, asset.symbol)}</span>
              </p>
            )}
            {pausedElsewhere.length > 0 && (
              <p className="flex items-start gap-1.5 text-zinc-500 dark:text-zinc-400">
                <BellOff aria-hidden className="mt-0.5 h-3 w-3 shrink-0" />
                <span>
                  {`${pausedElsewhere.length} ${pausedElsewhere.length === 1 ? "alert" : "alerts"} paused until you reopen ${joinSymbols(pausedSymbols)}.`}
                </span>
              </p>
            )}
          </div>

          {activeAlerts.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {activeAlerts.map((alert) => {
                const scope = priceAlertScope(alert, { assetOpen: true, live });
                return (
                  <li
                    key={alert.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-black/5 px-2 py-1.5 text-xs dark:bg-white/5"
                  >
                    <span className="flex items-center gap-1.5 font-mono">
                      {alert.direction === "above" ? (
                        <TrendingUp className="h-3 w-3 text-signal-up" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-signal-down" />
                      )}
                      {formatCurrency(alert.targetPrice, decimalsForPrice(alert.targetPrice))}
                      {scope === "paused" && (
                        <span className="rounded bg-amber-500/15 px-1 text-[10px] font-semibold uppercase leading-4 tracking-wide text-amber-700 dark:text-amber-400">
                          paused
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAlert(alert.id)}
                      aria-label={`Remove alert at ${alert.targetPrice}`}
                      className="rounded px-1 text-zinc-500 hover:bg-black/10 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
