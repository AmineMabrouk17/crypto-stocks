"use client";

import type { AssetRef, SearchResult } from "@crypto-stocks/lib";
import { useEffect, useRef, useState } from "react";
import { filterCoinList, getCoinList } from "@/lib/coinListCache";
import { useSelectedAsset } from "../providers/SelectedAssetContext";
import { useWatchlist } from "@/lib/useWatchlist";

function toAssetRef(result: SearchResult): AssetRef {
  if (result.kind === "crypto") {
    return { kind: "crypto", symbol: `${result.symbol.toUpperCase()}USDT`, id: result.id, name: result.name };
  }
  return { kind: "stock", symbol: result.symbol, id: result.symbol, name: result.name };
}

export function AssetSearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { setSelected } = useSelectedAsset();
  const { addAsset } = useWatchlist();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      return;
    }

    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      try {
        const [coinList, stockRes] = await Promise.all([
          getCoinList().catch(() => []),
          fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`, {
            signal: controller.signal,
          })
            .then((r) => (r.ok ? r.json() : { results: [] }))
            .catch(() => ({ results: [] })),
        ]);

        if (controller.signal.aborted) return;

        const cryptoMatches: SearchResult[] = filterCoinList(coinList, q, 6).map((c) => ({
          kind: "crypto",
          id: c.id,
          symbol: c.symbol,
          name: c.name,
        }));
        const stockMatches: SearchResult[] = (stockRes.results ?? []) as SearchResult[];

        setResults([...cryptoMatches, ...stockMatches]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    const asset = toAssetRef(result);
    addAsset(asset);
    setSelected(asset);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search coin or ticker (e.g. doge, aapl)"
        className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:bg-zinc-900 dark:focus:border-white/30"
      />
      {open && (query.trim().length >= 2) && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-black/10 bg-white shadow-lg dark:border-white/15 dark:bg-zinc-900">
          {loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-zinc-500">Searching…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-zinc-500">No matches</div>
          )}
          {results.map((r) => (
            <button
              key={`${r.kind}:${r.id}`}
              type="button"
              onMouseDown={() => handleSelect(r)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              <span className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-white/10 dark:text-zinc-400">
                {r.kind}
              </span>
              <span className="font-medium uppercase">{r.symbol}</span>
              <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{r.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
