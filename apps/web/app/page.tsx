import { Suspense } from "react";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { ThemeToggle } from "@/components/motion/theme-toggle";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/15">
        <div>
          <h1 className="text-lg font-semibold">Crypto & Stocks Dashboard</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Real-time crypto via Binance, near-real-time stocks/ETFs via Yahoo Finance.
          </p>
        </div>
        <ThemeToggle
          variant="circle"
          start="top-right"
          className="rounded-full border border-black/10 bg-white p-2 dark:border-white/15 dark:bg-zinc-900"
        />
      </header>
      <Suspense fallback={null}>
        <DashboardGrid />
      </Suspense>
    </div>
  );
}
