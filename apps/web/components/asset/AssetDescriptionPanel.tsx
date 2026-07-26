"use client";

import { fetchCoinDescription, type AssetDescription, type AssetRef } from "@crypto-stocks/lib";
import { useEffect, useState } from "react";

async function fetchDescription(asset: AssetRef): Promise<AssetDescription> {
  if (asset.kind === "crypto") {
    return fetchCoinDescription(asset.id);
  }
  const res = await fetch(`/api/stocks/profile?symbol=${encodeURIComponent(asset.symbol)}`);
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json();
}

export function AssetDescriptionPanel({
  asset,
  onLoaded,
}: {
  asset: AssetRef;
  onLoaded?: (summary: string | null) => void;
}) {
  const [description, setDescription] = useState<AssetDescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchDescription(asset)
      .then((desc) => {
        if (!cancelled) {
          setDescription(desc);
          onLoaded?.(desc.summary);
        }
      })
      .catch(() => {
        if (!cancelled) setErrored(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset]);

  return (
    <div className="rounded-xl border border-black/10 p-4 text-sm dark:border-white/15">
      <h3 className="mb-2 font-medium">About {asset.name}</h3>
      {loading && <p className="text-zinc-500 dark:text-zinc-400">Loading description…</p>}
      {errored && !loading && (
        <p className="text-zinc-500 dark:text-zinc-400">Description unavailable right now.</p>
      )}
      {!loading && !errored && description && (
        <p className="leading-relaxed text-zinc-600 dark:text-zinc-300">{description.summary}</p>
      )}
    </div>
  );
}
