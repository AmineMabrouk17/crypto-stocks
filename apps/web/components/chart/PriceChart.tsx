"use client";

import type { ChartType, Candle } from "@crypto-stocks/lib";
import {
  ColorType,
  createChart,
  type AreaData,
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

function toAreaData(c: Candle): AreaData {
  return { time: c.time as UTCTimestamp, value: c.close };
}

export interface PriceChartHandle {
  setData: (candles: Candle[]) => void;
  update: (candle: Candle) => void;
  getData: () => Candle[];
}

export function PriceChart({
  onReady,
  timeVisible = true,
  chartType = "candlestick",
}: {
  onReady: (handle: PriceChartHandle) => void;
  timeVisible?: boolean;
  chartType?: ChartType;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Area"> | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const chartTypeRef = useRef(chartType);
  useEffect(() => { chartTypeRef.current = chartType; }, [chartType]);

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

    function addSeries(type: ChartType) {
      if (type === "candlestick") {
        return chart.addCandlestickSeries({
          upColor: "#22c55e",
          downColor: "#ef4444",
          borderVisible: false,
          wickUpColor: "#22c55e",
          wickDownColor: "#ef4444",
        });
      }
      return chart.addAreaSeries({
        lineColor: "#22c55e",
        topColor: "rgba(34,197,94,0.3)",
        bottomColor: "rgba(34,197,94,0.01)",
        lineWidth: 2,
      });
    }

    const series = addSeries(chartTypeRef.current);
    seriesRef.current = series;

    if (candlesRef.current.length > 0) {
      const type = chartTypeRef.current;
      if (type === "candlestick") {
        (series as ISeriesApi<"Candlestick">).setData(candlesRef.current.map(toCandlestickData));
      } else {
        (series as ISeriesApi<"Area">).setData(candlesRef.current.map(toAreaData));
      }
    }

    chartRef.current = chart;

    onReady({
      setData: (candles) => {
        candlesRef.current = candles;
        const s = seriesRef.current;
        if (!s) return;
        const type = chartTypeRef.current;
        if (type === "candlestick") {
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
        const type = chartTypeRef.current;
        if (type === "candlestick") {
          (s as ISeriesApi<"Candlestick">).update(toCandlestickData(candle));
        } else {
          (s as ISeriesApi<"Area">).update(toAreaData(candle));
        }
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

  useEffect(() => {
    const chart = chartRef.current;
    const prevSeries = seriesRef.current;
    if (!chart || !prevSeries) return;

    if (chartType === "candlestick") {
      const candleSeries = chart.addCandlestickSeries({
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderVisible: false,
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });
      candleSeries.setData(candlesRef.current.map(toCandlestickData));
      chart.removeSeries(prevSeries);
      seriesRef.current = candleSeries;
    } else {
      const areaSeries = chart.addAreaSeries({
        lineColor: "#22c55e",
        topColor: "rgba(34,197,94,0.3)",
        bottomColor: "rgba(34,197,94,0.01)",
        lineWidth: 2,
      });
      areaSeries.setData(candlesRef.current.map(toAreaData));
      chart.removeSeries(prevSeries);
      seriesRef.current = areaSeries;
    }

    chart.timeScale().fitContent();
  }, [chartType]);

  return <div ref={containerRef} className="w-full" />;
}
