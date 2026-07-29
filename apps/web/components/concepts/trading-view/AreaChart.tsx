"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, type IChartApi, type ISeriesApi, type UTCTimestamp, type LineStyle } from "lightweight-charts";
import { Camera, Code, Maximize2 } from "lucide-react";

function generateIntradayData() {
  const now = new Date();
  now.setHours(22, 0, 0, 0);
  const endTs = Math.floor(now.getTime() / 1000);
  const startTs = endTs - 8 * 3600;
  const prevClose = 27763.13;
  let price = 27400;
  const data: { time: UTCTimestamp; value: number }[] = [];
  for (let t = startTs; t <= endTs; t += 1800) {
    const drift = -0.00015;
    const noise = (Math.random() - 0.5) * 12;
    price = price + price * drift + noise;
    data.push({ time: t as UTCTimestamp, value: Math.round(price * 100) / 100 });
  }
  return { data, prevClose };
}

export function AreaChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { data, prevClose } = generateIntradayData();
    const lastVal = data[data.length - 1].value;
    const isNegative = lastVal < prevClose;
    const lineColor = isNegative ? "#ef4444" : "#10b981";
    const topColor = isNegative ? "rgba(239, 68, 68, 0.35)" : "rgba(16, 185, 129, 0.35)";
    const bottomColor = isNegative ? "rgba(239, 68, 68, 0.01)" : "rgba(16, 185, 129, 0.01)";

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 480,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#6b7280",
        fontFamily:
          'ui-monospace, "SF Mono", Menlo, Monaco, "Cascadia Code", monospace',
      },
      grid: {
        vertLines: { color: "rgba(0,0,0,0.05)" },
        horzLines: { color: "rgba(0,0,0,0.05)" },
      },
      rightPriceScale: {
        borderColor: "rgba(0,0,0,0.08)",
        scaleMargins: { top: 0.1, bottom: 0.15 },
      },
      timeScale: {
        borderColor: "rgba(0,0,0,0.08)",
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: number) => {
          const d = new Date(time * 1000);
          const h = d.getHours().toString().padStart(2, "0");
          const m = d.getMinutes().toString().padStart(2, "0");
          return `${h}:${m}`;
        },
      },
      crosshair: {
        vertLine: { color: "rgba(0,0,0,0.12)", width: 1, style: 2 as LineStyle, visible: true, labelVisible: true },
        horzLine: { color: "rgba(0,0,0,0.12)", width: 1, style: 2 as LineStyle, visible: true, labelVisible: true },
      },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addAreaSeries({
      lineColor,
      topColor,
      bottomColor,
      lineWidth: 2,
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
      lastValueVisible: true,
      priceLineVisible: false,
      crosshairMarkerBackgroundColor: lineColor,
      crosshairMarkerBorderColor: "transparent",
    });

    series.setData(data);

    chart.createPriceLine({
      price: prevClose,
      color: "#6b7280",
      lineStyle: 2 as LineStyle,
      axisLabelVisible: true,
      title: "Prev close",
    });

    chartRef.current = chart;
    areaSeriesRef.current = series;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) chart.applyOptions({ width: entry.contentRect.width });
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      areaSeriesRef.current = null;
    };
  }, []);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
        <div className="text-sm font-medium text-gray-700">Nasdaq 100 Index · 1D</div>
        <div className="flex items-center gap-1">
          <button className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Snapshot">
            <Camera className="h-3.5 w-3.5" />
          </button>
          <button className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Embed">
            <Code className="h-3.5 w-3.5" />
          </button>
          <button className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Full chart">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
