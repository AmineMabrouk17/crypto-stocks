"use client";

import { decimalsForPrice, formatCurrency, type AssetRef } from "@crypto-stocks/lib";
import { Bell, BellOff, TrendingDown, TrendingUp, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { usePriceAlerts } from "@/lib/usePriceAlerts";
import { StatefulButton, type ButtonState } from "../motion/button/stateful";

type PermissionState = NotificationPermission | "unsupported";

function readPermission(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function isSameAsset(alert: { assetKind: string; assetSymbol: string }, asset: AssetRef) {
  return alert.assetKind === asset.kind && alert.assetSymbol === asset.symbol;
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
        aria-label={open ? "Close price alerts" : "Set a price alert"}
        title="Price alerts"
        className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <Bell className="h-3.5 w-3.5" />
        {activeAlerts.length > 0 && (
          <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
            {activeAlerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 w-full max-w-xs rounded-lg border border-black/10 bg-white p-3 dark:border-white/15 dark:bg-zinc-900">
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
                className="w-full min-w-0 rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary/50 dark:border-white/15"
              />
              <div className="flex shrink-0 overflow-hidden rounded-md border border-black/10 dark:border-white/15">
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

          {activeAlerts.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {activeAlerts.map((alert) => (
                <li
                  key={alert.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-black/5 px-2 py-1.5 text-xs dark:bg-white/5"
                >
                  <span className="flex items-center gap-1.5 font-mono">
                    {alert.direction === "above" ? (
                      <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                    )}
                    {formatCurrency(alert.targetPrice, decimalsForPrice(alert.targetPrice))}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAlert(alert.id)}
                    aria-label={`Remove alert at ${alert.targetPrice}`}
                    className="rounded px-1 text-zinc-400 hover:bg-black/10 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-2 text-[10px] leading-snug text-zinc-400 dark:text-zinc-500">
            {`Alerts only trigger while ${asset.symbol} is the asset currently open — this app doesn't monitor prices in the background.`}
          </p>
        </div>
      )}
    </div>
  );
}
