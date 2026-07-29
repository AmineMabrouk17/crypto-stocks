"use client";

import { TradingViewHeader } from "@/components/concepts/trading-view/TradingViewHeader";
import { AssetHeader } from "@/components/concepts/trading-view/AssetHeader";
import { CategoryTabs } from "@/components/concepts/trading-view/CategoryTabs";
import { AreaChart } from "@/components/concepts/trading-view/AreaChart";
import { TimeframeSelector } from "@/components/concepts/trading-view/TimeframeSelector";

export default function TradingViewConceptPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <TradingViewHeader />
      <main className="mx-auto max-w-[1440px] px-4 pt-6 pb-10">
        <AssetHeader />
        <CategoryTabs />
        <div className="mt-4">
          <AreaChart />
        </div>
        <div className="mt-3">
          <TimeframeSelector />
        </div>
      </main>
    </div>
  );
}
