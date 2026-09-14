"use client";

import { Settings } from "lucide-react";
import { Suspense, useState } from "react";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { AssetSearchBar } from "@/components/dashboard/AssetSearchBar";
import { ThemeToggle } from "@/components/motion/theme-toggle";
import { LlmSettingsPanel } from "@/components/settings/LlmSettingsPanel";

export default function Home() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="sticky top-0 z-50 border-b border-black/[0.06] bg-white/70 backdrop-blur-xl transition-all dark:border-white/[0.06] dark:bg-bento-bg/75">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-3 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/logo.svg"
              alt="Crypto & Stocks Dashboard logo"
              className="h-9 w-9 shrink-0"
            />
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 truncate text-sm font-bold tracking-tight text-zinc-900 dark:text-white">
                Crypto & Stocks Dashboard
                <span className="shrink-0 rounded border border-indigo-500/25 bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-indigo-500 dark:text-indigo-400">
                  PRO
                </span>
              </h1>
              <p className="hidden truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400 sm:block">
                Real-time crypto via Binance, near-real-time stocks/ETFs via Yahoo Finance.
              </p>
            </div>
          </div>

          <div className="hidden w-full max-w-md flex-1 md:block">
            <AssetSearchBar />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="AI assistant settings"
              title="AI assistant settings"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white/50 text-zinc-600 shadow-sm transition hover:bg-black/5 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-zinc-300 dark:hover:bg-white/[0.06]"
            >
              <Settings className="h-4 w-4" />
            </button>
            <ThemeToggle
              variant="circle"
              start="top-right"
              iconClassName="h-4 w-4"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white/50 text-zinc-600 shadow-sm transition hover:bg-black/5 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-zinc-300 dark:hover:bg-white/[0.06]"
            />
          </div>
        </div>
      </header>

      <Suspense fallback={null}>
        <DashboardGrid />
      </Suspense>

      <footer className="border-t border-black/[0.06] px-4 py-6 text-xs font-mono text-zinc-500 lg:px-8 dark:border-white/[0.06] dark:text-zinc-400">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-glow-emerald" aria-hidden />
            <span>Real-time crypto via Binance · near-real-time stocks/ETFs via Yahoo Finance</span>
          </div>
          <span className="text-[11px]">Crypto & Stocks Dashboard · Bento glass</span>
        </div>
      </footer>

      <LlmSettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
