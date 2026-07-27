"use client";

import { fetchCoinDescription, type AssetDescription, type AssetRef } from "@crypto-stocks/lib";
import { useEffect } from "react";
import useSWR from "swr";
import { Loader } from "../motion/loader";

async function fetchDescription(asset: AssetRef): Promise<AssetDescription> {
  if (asset.kind === "crypto") {
    return fetchCoinDescription(asset.id);
  }
  const res = await fetch(`/api/stocks/profile?symbol=${encodeURIComponent(asset.symbol)}`);
  if (!res.ok) throw new Error("Failed to load profile");
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
  const {
    data: description,
    error,
    isLoading: loading,
  } = useSWR<AssetDescription>(
    ["asset-description", asset.kind, asset.kind === "crypto" ? asset.id : asset.symbol],
    () => fetchDescription(asset),
    { dedupingInterval: DEDUPING_INTERVAL_MS, revalidateOnFocus: false },
  );
  const errored = Boolean(error);

  useEffect(() => {
    if (description) onLoaded?.(description.summary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description]);

  return (
    <div className="rounded-xl border border-black/10 p-4 text-sm dark:border-white/15">
      <h3 className="mb-2 font-medium">About {asset.name}</h3>
      {loading && (
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
          <Loader variant="dots" size={16} />
          Loading description…
        </div>
      )}
      {errored && !loading && (
        <p className="text-zinc-500 dark:text-zinc-400">Description unavailable right now.</p>
      )}
      {!loading && !errored && description && (
        <p className="leading-relaxed text-zinc-600 dark:text-zinc-300">{description.summary}</p>
      )}
    </div>
  );
}
