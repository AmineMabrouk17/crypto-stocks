import type { Metadata } from "next";
import Link from "next/link";
import { AssetDetailView } from "@/components/asset/AssetDetailView";
import { ThemeToggle } from "@/components/motion/theme-toggle";
import { resolveAsset } from "@/lib/resolveAsset";

interface AssetPageProps {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ id?: string }>;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export async function generateMetadata({ params, searchParams }: AssetPageProps): Promise<Metadata> {
  const { symbol } = await params;
  const { id } = await searchParams;
  const { asset, summary } = await resolveAsset(symbol, id);
  const title = `${asset.name} (${asset.symbol}) — Crypto & Stocks Dashboard`;
  const description = truncate(summary, 200);

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function AssetPage({ params, searchParams }: AssetPageProps) {
  const { symbol } = await params;
  const { id } = await searchParams;
  const { asset } = await resolveAsset(symbol, id);

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-50 border-b border-black/[0.06] bg-white/70 backdrop-blur-xl transition-all dark:border-white/[0.06] dark:bg-bento-bg/75">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-4 py-3 lg:px-8">
          <div>
            <Link href="/" className="font-mono text-sm text-zinc-500 hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200">
              ← Back to dashboard
            </Link>
            <h1 className="text-lg font-semibold">Crypto & Stocks Dashboard</h1>
          </div>
          <ThemeToggle
            variant="circle"
            start="top-right"
            iconClassName="h-4 w-4"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white/50 text-zinc-600 shadow-sm transition hover:bg-black/5 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-zinc-300 dark:hover:bg-white/[0.06]"
          />
        </div>
      </header>
      <AssetDetailView asset={asset} />
    </div>
  );
}

