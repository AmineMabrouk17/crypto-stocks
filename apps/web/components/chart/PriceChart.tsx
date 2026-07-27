"use client";

import type { Candle } from "@crypto-stocks/lib";
import {
  ColorType,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

function toCandlestickData(c: Candle): CandlestickData {
  return {
    time: c.time as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  };
}

export interface PriceChartHandle {
  setData: (candles: Candle[]) => void;
  update: (candle: Candle) => void;
  getData: () => Candle[];
}

export function PriceChart({
  onReady,
  timeVisible = true,
}: {
  onReady: (handle: PriceChartHandle) => void;
  /** Show time-of-day on the axis (intraday ranges) vs. date-only (daily+ candles). */
  timeVisible?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const candlesRef = useRef<Candle[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 380,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: isDark ? "#d4d4d8" : "#3f3f46",
        fontFamily: "var(--font-mono), ui-monospace, monospace",
      },
      grid: {
        vertLines: { color: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" },
        horzLines: { color: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" },
      },
      timeScale: { timeVisible, secondsVisible: false },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    onReady({
      setData: (candles) => {
        candlesRef.current = candles;
        series.setData(candles.map(toCandlestickData));
      },
      update: (candle) => {
        const current = candlesRef.current;
        const last = current[current.length - 1];
        candlesRef.current =
          last && last.time === candle.time ? [...current.slice(0, -1), candle] : [...current, candle];
        series.update(toCandlestickData(candle));
      },
      getData: () => candlesRef.current,
    });

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) chart.applyOptions({ width: entry.contentRect.width });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chartRef.current?.applyOptions({ timeScale: { timeVisible } });
  }, [timeVisible]);

  return <div ref={containerRef} className="w-full" />;
}
