import type { AssetRef } from "@crypto-stocks/lib";
import { cache } from "react";

export interface ResolvedAsset {
  asset: AssetRef;
  summary: string;
}

/**
 * One resolution per navigation. React `cache()` memoises by argument for the
 * lifetime of a server render, so `generateMetadata` and the page component
 * share a single upstream fan-out instead of resolving twice.
 */
export const resolveAsset = cache(
  async (rawSymbol: string, idHint?: string): Promise<ResolvedAsset> => {
    const origin = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8080";
    const params = new URLSearchParams({ symbol: rawSymbol });
    if (idHint) params.set("idHint", idHint);

    const response = await fetch(`${origin}/api/assets/resolve?${params}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Asset resolve failed: ${response.status}`);
    }
    return (await response.json()) as ResolvedAsset;
  },
);
