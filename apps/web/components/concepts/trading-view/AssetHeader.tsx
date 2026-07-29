"use client";

import { ChevronDown, Circle } from "lucide-react";

export function AssetHeader() {
  return (
    <div className="mt-6">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-lg font-bold">
          100
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">Nasdaq 100 Index</h1>
            <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
              NDX
            </span>
            <button className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
              Nasdaq Stock Market
              <ChevronDown className="h-3 w-3" />
            </button>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Circle className="h-2 w-2 fill-green-500 text-green-500" />
              Real-time
            </span>
            <span className="inline-flex items-center rounded border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700">
              D
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-4 flex-wrap">
            <span className="text-4xl font-bold tabular-nums tracking-tight text-gray-900">
              27,192.31
            </span>
            <span className="text-lg font-semibold text-red-500">-570.83</span>
            <span className="rounded-md bg-red-50 px-2 py-0.5 text-sm font-semibold text-red-500">
              -2.06%
            </span>
          </div>

          <p className="mt-1 text-xs text-gray-400">
            As of today at 21:00 GMT+1
          </p>
        </div>
      </div>
    </div>
  );
}
