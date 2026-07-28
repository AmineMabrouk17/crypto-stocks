"use client";

import type { AssetRef } from "@crypto-stocks/lib";
import { useEffect, useState } from "react";

const imageCache = new Map<string, string>();

interface CoinMarketItem {
  id: string;
  image: string;
}

export function useAssetImages(assets: AssetRef[]) {
  const [images, setImages] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const cryptoAssets = assets.filter((a) => a.kind === "crypto");
    if (cryptoAssets.length === 0) return;

    const uncached = cryptoAssets.filter((a) => !imageCache.has(a.id));
    if (uncached.length === 0) return;

    const ids = uncached.map((a) => a.id).join(",");

    fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=false`,
    )
      .then((res) => {
        if (!res.ok) throw new Error(`CoinGecko request failed: ${res.status}`);
        return res.json() as Promise<CoinMarketItem[]>;
      })
      .then((data) => {
        data.forEach((coin) => {
          if (coin.image) imageCache.set(coin.id, coin.image);
        });
        const result = new Map<string, string>();
        cryptoAssets.forEach((a) => {
          const url = imageCache.get(a.id);
          if (url) result.set(a.id, url);
        });
        setImages(result);
      })
      .catch(() => {});
  }, [assets]);

  return images;
}
