"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ChartType } from "@crypto-stocks/lib";

const STORAGE_KEY = "chart_type";

function getSnapshot(): ChartType {
  if (typeof window === "undefined") return "candlestick";
  return (localStorage.getItem(STORAGE_KEY) as ChartType) ?? "candlestick";
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function useChartType(): [ChartType, (type: ChartType) => void] {
  const chartType = useSyncExternalStore(subscribe, getSnapshot);

  const setChartType = useCallback((type: ChartType) => {
    localStorage.setItem(STORAGE_KEY, type);
    window.dispatchEvent(new Event("storage"));
  }, []);

  return [chartType, setChartType];
}
