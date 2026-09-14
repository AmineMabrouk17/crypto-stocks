"use client";

import type { AssetRef, SearchResult } from "@crypto-stocks/lib";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { filterCoinList, getCoinList } from "@/lib/coinListCache";
import { useSelectedAsset } from "../providers/SelectedAssetContext";
import { useWatchlist } from "@/lib/useWatchlist";
import { SharedLayoutBg } from "../motion/shared-layout-bg";

function toAssetRef(result: SearchResult): AssetRef {
  if (result.kind === "crypto") {
    return { kind: "crypto", symbol: `${result.symbol.toUpperCase()}USDT`, id: result.id, name: result.name };
  }
  return { kind: "stock", symbol: result.symbol, id: result.symbol, name: result.name };
}

type CategoryFilter = "all" | "crypto" | "stock";

const CATEGORIES: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "crypto", label: "Crypto" },
  { value: "stock", label: "Stocks" },
];

export function AssetSearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { setSelected } = useSelectedAsset();
  const { addAsset } = useWatchlist();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        const input = inputRef.current;
        if (!input || input.offsetParent === null) return;
        event.preventDefault();
        input.focus();
        input.select();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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

  const filteredResults = useMemo(
    () => (category === "all" ? results : results.filter((r) => r.kind === category)),
    [results, category],
  );

  return (
    <div className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400 transition-colors focus-within:text-emerald-500">
          <Search className="h-4 w-4" />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search coin or ticker (e.g. doge, aapl)"
          className="w-full rounded-xl border border-black/10 bg-black/[0.03] py-2 pl-9 pr-12 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/40 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-100"
        />
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
          <kbd className="rounded border border-black/10 bg-white/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-zinc-500">
            ⌘K
          </kbd>
        </span>
      </div>
      {open && query.trim().length >= 2 && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-black/10 bg-white/95 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-bento-surface/95">
          <SharedLayoutBg
            className="flex-row gap-0 border-b border-black/5 p-1 dark:border-white/[0.08]"
            pillClassName="bg-primary/[0.1] dark:bg-primary/[0.16]"
            inset={2}
          >
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setCategory(c.value);
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  category === c.value
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-white/20 dark:text-white dark:shadow-none"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {c.label}
              </button>
            ))}
          </SharedLayoutBg>
          {loading && filteredResults.length === 0 && (
            <div className="px-3 py-2 font-mono text-xs text-zinc-500">Searching…</div>
          )}
          {!loading && filteredResults.length === 0 && (
            <div className="px-3 py-2 font-mono text-xs text-zinc-500">No matches</div>
          )}
          {filteredResults.map((r) => (
            <button
              key={`${r.kind}:${r.id}`}
              type="button"
              onMouseDown={() => handleSelect(r)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-emerald-500/[0.06] dark:hover:bg-emerald-500/[0.08]"
            >
              <span className="rounded-full border border-black/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                {r.kind}
              </span>
              <span className="font-mono font-semibold uppercase text-zinc-900 dark:text-zinc-100">
                {r.symbol}
              </span>
              <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{r.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
