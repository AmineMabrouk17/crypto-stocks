"use client";

import type { ChartType, Candle } from "@crypto-stocks/lib";
import {
  ColorType,
  createChart,
  type AreaData,
  type AreaStyleOptions,
  type CandlestickData,
  type CandlestickStyleOptions,
  type DeepPartial,
  type IChartApi,
  type ISeriesApi,
  type SeriesOptionsCommon,
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

function toAreaData(c: Candle): AreaData {
  return { time: c.time as UTCTimestamp, value: c.close };
}

export interface PriceChartHandle {
  setData: (candles: Candle[]) => void;
  update: (candle: Candle) => void;
  getData: () => Candle[];
}

const CANDLESTICK_OPTIONS: DeepPartial<CandlestickStyleOptions & SeriesOptionsCommon> = {
  upColor: "#22c55e",
  downColor: "#ef4444",
  borderVisible: false,
  wickUpColor: "#22c55e",
  wickDownColor: "#ef4444",
};

const AREA_OPTIONS: DeepPartial<AreaStyleOptions & SeriesOptionsCommon> = {
  lineColor: "#22c55e",
  topColor: "rgba(34,197,94,0.3)",
  bottomColor: "rgba(34,197,94,0.01)",
  lineWidth: 2,
};

function createSeries(chart: IChartApi, type: ChartType) {
  if (type === "candlestick") {
    return chart.addCandlestickSeries(CANDLESTICK_OPTIONS);
  }
  return chart.addAreaSeries(AREA_OPTIONS);
}

export function PriceChart({
  onReady,
  timeVisible = true,
  chartType = "candlestick",
  height = 380,
}: {
  onReady: (handle: PriceChartHandle) => void;
  timeVisible?: boolean;
  chartType?: ChartType;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Area"> | null>(null);
  const chartTypeRef = useRef<ChartType>(chartType);
  const candlesRef = useRef<Candle[]>([]);
  const onReadyRef = useRef(onReady);

  // Helper to switch series without recreating the chart instance
  const switchSeries = (type: ChartType) => {
    const chart = chartRef.current;
    if (!chart) return;

    if (seriesRef.current) {
      try {
        chart.removeSeries(seriesRef.current);
      } catch {
        // Safe catch if already removed
      }
      seriesRef.current = null;
    }

    const newSeries = createSeries(chart, type);
    seriesRef.current = newSeries;

    if (candlesRef.current.length > 0) {
      if (type === "candlestick") {
        (newSeries as ISeriesApi<"Candlestick">).setData(candlesRef.current.map(toCandlestickData));
      } else {
        (newSeries as ISeriesApi<"Area">).setData(candlesRef.current.map(toAreaData));
      }
    }
  };

  // Mount chart once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const chart = createChart(container, {
      width: container.clientWidth,
      height,
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
    chartRef.current = chart;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) chart.applyOptions({ width: entry.contentRect.width });
    });
    resizeObserver.observe(container);

    // Create initial series
    switchSeries(chartTypeRef.current);

    // Provide stable handle
    onReadyRef.current({
      setData: (candles) => {
        candlesRef.current = candles;
        const s = seriesRef.current;
        if (!s) return;
        if (chartTypeRef.current === "candlestick") {
          (s as ISeriesApi<"Candlestick">).setData(candles.map(toCandlestickData));
        } else {
          (s as ISeriesApi<"Area">).setData(candles.map(toAreaData));
        }
      },
      update: (candle) => {
        const current = candlesRef.current;
        const last = current[current.length - 1];
        candlesRef.current =
          last && last.time === candle.time ? [...current.slice(0, -1), candle] : [...current, candle];
        const s = seriesRef.current;
        if (!s) return;
        if (chartTypeRef.current === "candlestick") {
          (s as ISeriesApi<"Candlestick">).update(toCandlestickData(candle));
        } else {
          (s as ISeriesApi<"Area">).update(toAreaData(candle));
        }
      },
      getData: () => candlesRef.current,
    });

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  // Dynamically swap series type without tearing down chart or WebSocket
  const isInitialMount = useRef(true);
  useEffect(() => {
    chartTypeRef.current = chartType;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    switchSeries(chartType);
  }, [chartType]);

  // Keep latest callback in a ref so the chart handle stays stable
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // Update timeScale options
  useEffect(() => {
    chartRef.current?.applyOptions({ timeScale: { timeVisible } });
  }, [timeVisible]);

  return <div ref={containerRef} className="w-full" />;
}
