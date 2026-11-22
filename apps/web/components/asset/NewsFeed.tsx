"use client";

import type { AssetRef, NewsArticle } from "@crypto-stocks/lib";
import { Newspaper } from "lucide-react";
import { fetchJson } from "@/lib/api-error";
import { usePanelQuery } from "@/lib/usePanelQuery";
import { cn } from "@/lib/utils";
import { PanelStatus } from "../feedback/PanelStatus";
import { AnimatedBadge, type AnimatedBadgeStatus } from "../motion/animated-badge";

interface NewsResponse {
  articles: NewsArticle[];
}

async function fetchNews(query: string): Promise<NewsResponse> {
  const payload = await fetchJson<Partial<NewsResponse>>(
    `/api/news?q=${encodeURIComponent(query)}`,
  );
  // A 200 with the wrong shape is a failure, not "no articles".
  if (!Array.isArray(payload.articles)) throw new Error("Unexpected news response");
  return { articles: payload.articles };
}

const SENTIMENT_STATUS: Record<NonNullable<NewsArticle["sentiment"]>, AnimatedBadgeStatus> = {
  positive: "success",
  negative: "danger",
  neutral: "neutral",
};

const SENTIMENT_LABEL: Record<NonNullable<NewsArticle["sentiment"]>, string> = {
  positive: "Positive tone",
  negative: "Negative tone",
  neutral: "Neutral tone",
};

/** Coarse relative-time label; news doesn't need second-level precision. */
function formatRelativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(diffMs)) return null;

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NewsFeed({ asset }: { asset: AssetRef }) {
  const {
    data,
    failure,
    isLoading,
    isStale,
    isRetrying,
    lastUpdatedAt,
    retry,
  } = usePanelQuery<NewsResponse>(
    `/api/news?q=${encodeURIComponent(asset.name)}`,
    () => fetchNews(asset.name),
    {
      refreshInterval: 5 * 60_000,
      revalidateOnFocus: true,
    },
  );

  const articles = data?.articles ?? [];
  const hasArticles = articles.length > 0;

  return (
    <div className="glass-tile flex flex-col rounded-3xl p-4 text-sm sm:p-5 lg:p-6">
      <div className="flex items-center justify-between border-b border-black/5 pb-3 dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-indigo-500" />
          <h3 className="font-bold tracking-tight text-zinc-900 dark:text-white">News for {asset.name}</h3>
        </div>
        {articles.length > 0 && (
          <span className="rounded-full border border-black/10 px-2 py-0.5 font-mono text-xs tabular-nums text-zinc-600 dark:border-white/10 dark:text-zinc-400">
            {articles.length} stories
          </span>
        )}
      </div>

      <PanelStatus
        subject="news"
        loading={isLoading}
        failure={failure}
        hasData={hasArticles}
        emptyMessage={`No recent news for ${asset.name}.`}
        isRetrying={isRetrying}
        lastUpdatedAt={lastUpdatedAt}
        onRetry={retry}
        className={hasArticles ? undefined : "py-4"}
      />

      {hasArticles && (
        <div
          aria-busy={isStale || undefined}
          className={cn(
            "max-h-[420px] overflow-y-auto pr-1 transition-opacity duration-200",
            isStale && "opacity-60",
          )}
        >
          <ul className="divide-y divide-black/5 dark:divide-white/[0.06]">
            {articles.slice(0, 15).map((article) => {
              const sentiment = article.sentiment ?? "neutral";
              const relativeTime = formatRelativeTime(article.publishedAt);
              return (
                <li
                  key={article.link}
                  className="-mx-2 rounded-xl px-2 py-3 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                >
                  <div className="mb-1 flex flex-col justify-between gap-1.5 sm:flex-row sm:items-baseline">
                    <a
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold leading-snug text-zinc-800 transition-colors hover:text-signal-up dark:text-zinc-100"
                    >
                      {article.title}
                    </a>
                    <AnimatedBadge
                      status={SENTIMENT_STATUS[sentiment]}
                      size="sm"
                      showIcon={false}
                      className="self-start font-mono uppercase tracking-wide sm:self-auto"
                    >
                      {SENTIMENT_LABEL[sentiment]}
                    </AnimatedBadge>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                    {article.source && <span className="font-medium text-zinc-600 dark:text-zinc-300">{article.source}</span>}
                    {article.source && relativeTime && <span aria-hidden>·</span>}
                    {relativeTime && <span>{relativeTime}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
