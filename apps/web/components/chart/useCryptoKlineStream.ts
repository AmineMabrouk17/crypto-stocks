"use client";

import { fetchKlines, klineStreamUrl, parseKlineMessage } from "@crypto-stocks/lib";
import { useEffect, useRef, useState } from "react";
import type { PriceChartHandle } from "./PriceChart";

const MAX_BACKOFF_MS = 30_000;

export function useCryptoKlineStream(symbol: string, chart: PriceChartHandle | null) {
  const [price, setPrice] = useState<number | null>(null);
  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(1000);
  const closedByEffectRef = useRef(false);

  useEffect(() => {
    if (!chart) return;
    closedByEffectRef.current = false;
    backoffRef.current = 1000;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    async function seedAndConnect() {
      try {
        const candles = await fetchKlines(symbol, "1m", 500);
        if (cancelled) return;
        chart!.setData(candles);
        const last = candles[candles.length - 1];
        if (last) setPrice(last.close);
      } catch {
        // seeding failure is non-fatal; the WS stream will still populate the chart going forward
      }
      connect();
    }

    function connect() {
      if (cancelled) return;
      const ws = new WebSocket(klineStreamUrl(symbol, "1m"));
      wsRef.current = ws;

      ws.onopen = () => {
        backoffRef.current = 1000;
        setStatus("open");
      };

      ws.onmessage = (event) => {
        const msg = parseKlineMessage(event.data);
        if (!msg) return;
        const { k } = msg;
        const candle = {
          time: Math.floor(k.t / 1000),
          open: Number(k.o),
          high: Number(k.h),
          low: Number(k.l),
          close: Number(k.c),
        };
        chart!.update(candle);
        setPrice(candle.close);
      };

      ws.onclose = () => {
        setStatus("closed");
        if (cancelled || closedByEffectRef.current) return;
        const delay = backoffRef.current;
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    seedAndConnect();

    return () => {
      cancelled = true;
      closedByEffectRef.current = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [symbol, chart]);

  return { price, status };
}
