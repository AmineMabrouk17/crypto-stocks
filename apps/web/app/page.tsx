import { DashboardGrid } from "@/components/dashboard/DashboardGrid";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-black/10 px-4 py-3 dark:border-white/15">
        <h1 className="text-lg font-semibold">Crypto & Stocks Dashboard</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Real-time crypto via Binance, near-real-time stocks/ETFs via Yahoo Finance.
        </p>
      </header>
      <DashboardGrid />
    </div>
  );
}
