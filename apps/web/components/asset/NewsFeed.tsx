"use client";

import type { AssetRef, NewsArticle } from "@crypto-stocks/lib";
import { Newspaper } from "lucide-react";
import useSWR from "swr";
import { AnimatedBadge, type AnimatedBadgeStatus } from "../motion/animated-badge";
import { Loader } from "../motion/loader";

interface NewsResponse {
  articles: NewsArticle[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

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
  const { data, isLoading, error } = useSWR<NewsResponse>(
    `/api/news?q=${encodeURIComponent(asset.name)}`,
    fetcher,
    { refreshInterval: 5 * 60_000, revalidateOnFocus: true },
  );

  const articles = data?.articles ?? [];

  return (
    <div className="glass-tile rounded-3xl p-4 text-sm sm:p-5 lg:p-6">
      <div className="flex items-center justify-between border-b border-black/5 pb-3 dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-indigo-500" />
          <h3 className="font-bold tracking-tight text-zinc-900 dark:text-white">News for {asset.name}</h3>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-4 text-zinc-500 dark:text-zinc-400">
          <Loader variant="dots" size={16} />
          Loading news…
        </div>
      )}

      {!isLoading && (error || !data) && (
        <p className="py-4 text-zinc-500 dark:text-zinc-400">News unavailable right now.</p>
      )}

      {!isLoading && !error && data && articles.length === 0 && (
        <p className="py-4 text-zinc-500 dark:text-zinc-400">No recent articles found.</p>
      )}

      {!isLoading && !error && articles.length > 0 && (
        <ul className="divide-y divide-black/5 dark:divide-white/[0.06]">
          {articles.slice(0, 10).map((article) => {
            const sentiment = article.sentiment ?? "neutral";
            const relativeTime = formatRelativeTime(article.publishedAt);
            return (
              <li
                key={article.link}
                className="-mx-2 rounded-xl px-2 py-3.5 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              >
                <div className="mb-1 flex flex-col justify-between gap-1.5 sm:flex-row sm:items-baseline">
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold leading-snug text-zinc-800 transition-colors hover:text-emerald-600 dark:text-zinc-100 dark:hover:text-emerald-400"
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
      )}
    </div>
  );
}
