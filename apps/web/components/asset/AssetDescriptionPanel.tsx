"use client";

import { fetchCoinDescription, type AssetDescription, type AssetRef } from "@crypto-stocks/lib";
import { BookOpenText } from "lucide-react";
import { useEffect } from "react";
import { ApiError } from "@/lib/api-error";
import { usePanelQuery } from "@/lib/usePanelQuery";
import { cn } from "@/lib/utils";
import { PanelStatus } from "../feedback/PanelStatus";

async function fetchDescription(asset: AssetRef): Promise<AssetDescription> {
  if (asset.kind === "crypto") {
    return fetchCoinDescription(asset.id);
  }
  const res = await fetch(`/api/stocks/profile?symbol=${encodeURIComponent(asset.symbol)}`);
  if (!res.ok) throw new ApiError(res.status);
  return res.json();
}

// Descriptions/profiles rarely change — cache aggressively and dedupe across remounts so
// re-selecting a recently-viewed asset doesn't refetch or flash a loading state.
const DEDUPING_INTERVAL_MS = 5 * 60_000;

export function AssetDescriptionPanel({
  asset,
  onLoaded,
}: {
  asset: AssetRef;
  onLoaded?: (summary: string | null) => void;
}) {
  const { data: description, failure, isLoading, isStale, isRetrying, lastUpdatedAt, retry } =
    usePanelQuery<AssetDescription>(
      `asset-description:${asset.kind}:${asset.kind === "crypto" ? asset.id : asset.symbol}`,
      () => fetchDescription(asset),
      { dedupingInterval: DEDUPING_INTERVAL_MS, revalidateOnFocus: false },
    );

  const summary = description?.summary.trim() ?? "";
  const hasDescription = summary.length > 0;

  useEffect(() => {
    if (description) onLoaded?.(description.summary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description]);

  return (
    <div className="glass-tile flex flex-col rounded-3xl p-4 text-sm sm:p-5 lg:p-6">
      <div className="flex items-center gap-2 border-b border-black/5 pb-3 text-sm dark:border-white/[0.06]">
        <BookOpenText className="h-4 w-4 text-amber-600 dark:text-amber-500" />
        <h3 className="font-bold tracking-tight text-zinc-900 dark:text-white">About {asset.name}</h3>
      </div>

      <div className="flex flex-col justify-start gap-2 pt-3.5">
        <PanelStatus
          subject="description"
          loading={isLoading}
          failure={failure}
          hasData={hasDescription}
          emptyMessage={`No description available for ${asset.name} yet.`}
          isRetrying={isRetrying}
          lastUpdatedAt={lastUpdatedAt}
          onRetry={retry}
          className={hasDescription ? undefined : "py-2"}
        />
        {hasDescription && (
          <p
            aria-busy={isStale || undefined}
            className={cn(
              "leading-relaxed text-zinc-600 transition-opacity duration-200 dark:text-zinc-300",
              isStale && "opacity-60",
            )}
          >
            {summary}
          </p>
        )}
      </div>
    </div>
  );
}
