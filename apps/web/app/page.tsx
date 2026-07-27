"use client";

import { Settings } from "lucide-react";
import { Suspense, useState } from "react";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { ThemeToggle } from "@/components/motion/theme-toggle";
import { LlmSettingsPanel } from "@/components/settings/LlmSettingsPanel";

export default function Home() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/15">
        <div>
          <h1 className="text-lg font-semibold">Crypto & Stocks Dashboard</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Real-time crypto via Binance, near-real-time stocks/ETFs via Yahoo Finance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="AI assistant settings"
            title="AI assistant settings"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-zinc-600 hover:bg-black/5 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10"
          >
            <Settings className="h-4 w-4" />
          </button>
          <ThemeToggle
            variant="circle"
            start="top-right"
            className="rounded-full border border-black/10 bg-white p-2 dark:border-white/15 dark:bg-zinc-900"
          />
        </div>
      </header>
      <Suspense fallback={null}>
        <DashboardGrid />
      </Suspense>
      <LlmSettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
