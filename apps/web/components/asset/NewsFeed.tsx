"use client";

import type { AssetRef, NewsArticle } from "@crypto-stocks/lib";
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
    <div className="rounded-xl border border-black/10 p-4 text-sm dark:border-white/15">
      <h3 className="mb-2 font-medium">News for {asset.name}</h3>

      {isLoading && (
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
          <Loader variant="dots" size={16} />
          Loading news…
        </div>
      )}

      {!isLoading && (error || !data) && (
        <p className="text-zinc-500 dark:text-zinc-400">News unavailable right now.</p>
      )}

      {!isLoading && !error && data && articles.length === 0 && (
        <p className="text-zinc-500 dark:text-zinc-400">No recent articles found.</p>
      )}

      {!isLoading && !error && articles.length > 0 && (
        <ul className="flex flex-col gap-3">
          {articles.slice(0, 10).map((article) => {
            const sentiment = article.sentiment ?? "neutral";
            const relativeTime = formatRelativeTime(article.publishedAt);
            return (
              <li key={article.link} className="border-b border-black/5 pb-3 last:border-b-0 last:pb-0 dark:border-white/10">
                <a
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium leading-snug text-zinc-800 hover:underline dark:text-zinc-100"
                >
                  {article.title}
                </a>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {article.source && <span>{article.source}</span>}
                  {article.source && relativeTime && <span aria-hidden>·</span>}
                  {relativeTime && <span>{relativeTime}</span>}
                  <AnimatedBadge status={SENTIMENT_STATUS[sentiment]} size="sm" showIcon={false}>
                    {SENTIMENT_LABEL[sentiment]}
                  </AnimatedBadge>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
