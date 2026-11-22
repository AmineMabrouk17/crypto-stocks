"use client";

import { Download } from "lucide-react";
import { ToolbarMenu } from "./ToolbarMenu";

/** Single entry point for chart downloads, so the header keeps one export control. */
export function ChartExportMenu({
  assetSymbol,
  disabled,
  onExportCsv,
}: {
  assetSymbol: string;
  disabled: boolean;
  onExportCsv: () => void;
}) {
  return (
    <ToolbarMenu
      trigger={
        <>
          <Download className="h-3.5 w-3.5" aria-hidden />
          <span className="font-mono text-xs font-medium">Export</span>
        </>
      }
      triggerLabel={`Export ${assetSymbol} chart data`}
      triggerTitle="Export chart data"
      triggerClassName="gap-1.5"
      menuLabel="Export chart data"
      items={[{ value: "csv", label: "CSV", description: "Candle data", disabled }]}
      onSelect={(value) => {
        if (value === "csv") onExportCsv();
      }}
    />
  );
}
