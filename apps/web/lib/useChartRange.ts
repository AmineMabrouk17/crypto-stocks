"use client";

import { isChartRange, type ChartRange } from "@crypto-stocks/lib";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

const DEFAULT_RANGE: ChartRange = "1D";

export function useChartRange() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const range = useMemo<ChartRange>(() => {
    const raw = searchParams.get("range");
    return isChartRange(raw) ? raw : DEFAULT_RANGE;
  }, [searchParams]);

  const setRange = useCallback(
    (next: ChartRange) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("range", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  return { range, setRange };
}
