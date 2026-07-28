import type { AssetRef } from "@crypto-stocks/lib";

const TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_KEY ?? "";

function logoId(asset: AssetRef): string {
  if (asset.kind === "crypto") {
    return asset.symbol.endsWith("USDT") ? asset.symbol.slice(0, -4).toLowerCase() : asset.symbol.toLowerCase();
  }
  return asset.symbol.toLowerCase();
}

export function logoUrl(asset: AssetRef): string {
  const id = logoId(asset);
  return `https://img.logo.dev/${id}?token=${TOKEN}&format=png&size=32`;
}
