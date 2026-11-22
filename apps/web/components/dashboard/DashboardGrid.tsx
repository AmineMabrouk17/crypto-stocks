"use client";

import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ListOrdered,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useChatCollapsed } from "@/lib/useChatCollapsed";
import { useWatchlist } from "@/lib/useWatchlist";
import { useWatchlistVisible } from "@/lib/useWatchlistVisible";
import { cn } from "@/lib/utils";
import { AssetDescriptionPanel } from "../asset/AssetDescriptionPanel";
import { NewsFeed } from "../asset/NewsFeed";
import { ChatPanel } from "../chat/ChatPanel";
import { CrowdOdds } from "../chart/CrowdOdds";
import { SentimentIndex } from "../chart/SentimentIndex";
import { useSelectedAsset } from "../providers/SelectedAssetContext";
import { AssetChartPanel } from "./AssetChartPanel";
import { AssetSearchBar } from "./AssetSearchBar";
import { Watchlist } from "./Watchlist";

export function DashboardGrid() {
  const { selected, livePrice, marketStats } = useSelectedAsset();
  const { watchlist } = useWatchlist();
  const [description, setDescription] = useState<string | null>(null);
  const { collapsed, toggle } = useChatCollapsed();
  const { visible: watchlistVisible, setVisible: setWatchlistVisible } = useWatchlistVisible();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // Below lg the watchlist and the assistant are overlays, not columns.
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const watchlistTriggerRef = useRef<HTMLButtonElement>(null);
  const watchlistDrawerRef = useRef<HTMLDivElement>(null);
  const assistantTriggerRef = useRef<HTMLButtonElement>(null);
  const assistantPanelRef = useRef<HTMLElement>(null);

  const assetKey = `${selected.kind}:${selected.symbol}`;
  const overlayOpen = watchlistOpen || assistantOpen;

  const closeWatchlist = useCallback(() => {
    setWatchlistOpen(false);
    watchlistTriggerRef.current?.focus();
  }, []);

  const closeAssistant = useCallback(() => {
    setAssistantOpen(false);
    assistantTriggerRef.current?.focus();
  }, []);

  // Escape closes, and the page behind an overlay does not scroll.
  useEffect(() => {
    if (!overlayOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (assistantOpen) closeAssistant();
      if (watchlistOpen) closeWatchlist();
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [overlayOpen, assistantOpen, watchlistOpen, closeAssistant, closeWatchlist]);

  useEffect(() => {
    if (watchlistOpen) watchlistDrawerRef.current?.focus();
  }, [watchlistOpen]);

  useEffect(() => {
    if (assistantOpen) assistantPanelRef.current?.focus();
  }, [assistantOpen]);

  // The overlays only exist below lg — drop them if the viewport grows past it.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = (event: MediaQueryListEvent) => {
      if (!event.matches) return;
      setWatchlistOpen(false);
      setAssistantOpen(false);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // The assistant header button collapses the desktop column but closes the
  // mobile sheet, so the stored desktop preference never flips on a phone.
  const handleAssistantCollapse = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      toggle();
    } else {
      closeAssistant();
    }
  }, [closeAssistant, toggle]);

  return (
    <div className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:flex-row lg:p-8">
      {/* Mobile only: the header search takes over from md upwards. */}
      <div className="glass-tile rounded-3xl p-3 md:hidden">
        <AssetSearchBar />
      </div>

      {/*
        Watchlist: a left column at lg, a collapsible left drawer below it.
        `contents` keeps the mobile trigger in normal flow without an extra box,
        so the chart that follows leads the page.
      */}
      <aside
        className={cn(
          "contents lg:order-none lg:flex lg:min-h-0 lg:shrink-0 lg:flex-col lg:gap-6 lg:self-start lg:sticky lg:top-24 lg:h-[calc(100vh-7.5rem)] lg:transition-[width] lg:duration-300 lg:ease-in-out",
          watchlistVisible ? "lg:w-60" : "lg:w-16"
        )}
      >
        <button
          ref={watchlistTriggerRef}
          type="button"
          onClick={() => setWatchlistOpen(true)}
          aria-expanded={watchlistOpen}
          aria-controls="watchlist-drawer"
          className="glass-tile flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-2.5 text-left lg:hidden"
        >
          <span className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <ListOrdered className="h-3.5 w-3.5" aria-hidden />
            Watchlist
            <span className="rounded-full border border-black/10 px-1.5 py-0.5 tabular-nums dark:border-white/10">
              {watchlist.length}
            </span>
          </span>
          <span className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
            Manage
            <ChevronDown className="h-4 w-4" aria-hidden />
          </span>
        </button>

        {watchlistOpen && (
          <div
            aria-hidden
            onClick={closeWatchlist}
            className="fixed inset-0 z-40 bg-zinc-950/50 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 lg:hidden"
          />
        )}

        <div
          ref={watchlistDrawerRef}
          id="watchlist-drawer"
          role={watchlistOpen ? "dialog" : undefined}
          aria-modal={watchlistOpen ? true : undefined}
          aria-label={watchlistOpen ? "Watchlist" : undefined}
          tabIndex={-1}
          className={cn(
            "glass-tile min-h-0 flex-1 flex-col rounded-3xl p-3 outline-none",
            watchlistOpen
              ? "fixed inset-y-2 left-2 z-50 flex w-[min(20rem,85vw)] motion-safe:animate-in motion-safe:slide-in-from-left-4 motion-safe:fade-in motion-safe:duration-200"
              : "hidden",
            "lg:static lg:z-auto lg:flex lg:h-auto lg:w-auto"
          )}
        >
          {/* Mobile drawer header */}
          <div className="flex items-center justify-between px-1 pb-2 lg:hidden">
            <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              <ListOrdered className="h-3 w-3" aria-hidden />
              Watchlist
              <span className="rounded-full border border-black/10 px-1.5 py-0.5 tabular-nums dark:border-white/10">
                {watchlist.length}
              </span>
            </span>
            <button
              type="button"
              onClick={closeWatchlist}
              aria-label="Close watchlist"
              title="Close watchlist"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-black/5 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Desktop header */}
          <div
            className={cn(
              "hidden items-center pb-2 lg:flex",
              watchlistVisible ? "justify-between gap-2 px-1" : "justify-center"
            )}
          >
            {watchlistVisible ? (
              <>
                <span className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  <ListOrdered className="h-3 w-3" />
                  Watchlist
                </span>
                <span className="flex items-center gap-1">
                  <span className="rounded-full border border-black/10 px-1.5 py-0.5 font-mono text-xs tabular-nums text-zinc-600 dark:border-white/10 dark:text-zinc-400">
                    {watchlist.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setWatchlistVisible(false)}
                    aria-label="Collapse watchlist sidebar"
                    title="Collapse sidebar"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition hover:bg-black/5 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200"
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </button>
                </span>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setWatchlistVisible(true)}
                aria-label="Expand watchlist sidebar"
                title="Expand watchlist"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-black/5 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Scrollable list */}
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
            <Watchlist collapsed={isDesktop && !watchlistVisible} />
          </div>
        </div>
      </aside>

      <main className="grid min-w-0 flex-1 content-start grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-12">
          <AssetChartPanel asset={selected} showSignals={false} />
        </div>

        {selected.kind === "crypto" && (
          <>
            <div className="lg:col-span-6">
              <SentimentIndex />
            </div>
            <div className="lg:col-span-6">
              <CrowdOdds symbol={selected.symbol} />
            </div>
          </>
        )}

        <div className="lg:col-span-4 lg:self-start">
          <AssetDescriptionPanel key={`desc-${assetKey}`} asset={selected} onLoaded={setDescription} />
        </div>

        <div className="lg:col-span-8">
          <NewsFeed key={`news-${assetKey}`} asset={selected} />
        </div>
      </main>

      {/* Mobile only: sticky trigger for the assistant bottom sheet. */}
      <button
        ref={assistantTriggerRef}
        type="button"
        onClick={() => setAssistantOpen(true)}
        aria-expanded={assistantOpen}
        aria-controls="assistant-sheet"
        className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full border border-indigo-500/40 bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/30 transition hover:bg-indigo-500 motion-reduce:transition-none lg:hidden"
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        Ask AI
      </button>

      {assistantOpen && (
        <div
          aria-hidden
          onClick={closeAssistant}
          className="fixed inset-0 z-40 bg-zinc-950/50 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 lg:hidden"
        />
      )}

      <aside
        ref={assistantPanelRef}
        id="assistant-sheet"
        role={assistantOpen ? "dialog" : undefined}
        aria-modal={assistantOpen ? true : undefined}
        aria-label="AI assistant"
        tabIndex={-1}
        className={cn(
          "shrink-0 flex-col gap-6 outline-none",
          assistantOpen
            ? "fixed inset-x-0 bottom-0 z-50 flex h-[min(520px,calc(100dvh-1rem))] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:fade-in motion-safe:duration-200"
            : "hidden",
          "lg:static lg:z-auto lg:flex lg:min-h-0 lg:sticky lg:top-24 lg:self-start lg:h-[calc(100vh-7.5rem)] lg:p-0 lg:transition-[width] lg:duration-300 lg:ease-in-out",
          collapsed ? "lg:w-12" : "lg:w-80"
        )}
      >
        {collapsed && (
          <button
            type="button"
            onClick={toggle}
            aria-label="Show AI assistant"
            title="Show AI assistant"
            className="glass-tile hidden w-full items-center justify-center gap-2 rounded-3xl px-3 py-3 transition hover:text-zinc-800 dark:hover:text-zinc-200 lg:flex lg:h-full lg:flex-1 lg:flex-col lg:gap-3 lg:px-1"
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 lg:[writing-mode:vertical-rl] lg:rotate-180">
              Assistant
            </span>
          </button>
        )}

        <div className={cn("flex min-h-0 flex-1 flex-col", collapsed && "lg:hidden")}>
          <ChatPanel
            key={assetKey}
            asset={selected}
            livePrice={livePrice}
            marketStats={marketStats}
            description={description}
            onCollapse={handleAssistantCollapse}
          />
        </div>
      </aside>
    </div>
  );
}
