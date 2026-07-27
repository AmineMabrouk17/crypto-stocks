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
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/15">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
            ← Back to dashboard
          </Link>
          <h1 className="text-lg font-semibold">Crypto & Stocks Dashboard</h1>
        </div>
        <ThemeToggle
          variant="circle"
          start="top-right"
          className="rounded-full border border-black/10 bg-white p-2 dark:border-white/15 dark:bg-zinc-900"
        />
      </header>
      <AssetDetailView asset={asset} />
    </div>
  );
}
