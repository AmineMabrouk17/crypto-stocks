"use client";

const timeframes = [
  { label: "1 day", change: -2.06, active: true },
  { label: "5 days", change: 0.32, active: false },
  { label: "1 month", change: 1.57, active: false },
  { label: "6 months", change: -3.21, active: false },
  { label: "Year to date", change: 4.89, active: false },
  { label: "1 year", change: 12.45, active: false },
  { label: "5 years", change: 68.32, active: false },
  { label: "10 years", change: 215.76, active: false },
  { label: "All time", change: 1420.5, active: false },
];

export function TimeframeSelector() {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
      {timeframes.map((tf) => (
        <button
          key={tf.label}
          className={`flex shrink-0 flex-col items-center rounded-lg border px-4 py-2 text-xs transition-colors ${
            tf.active
              ? "border-blue-600 bg-blue-50"
              : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
          }`}
        >
          <span
            className={`font-medium ${
              tf.active ? "text-blue-600" : "text-gray-700"
            }`}
          >
            {tf.label}
          </span>
          <span
            className={`mt-0.5 font-semibold tabular-nums ${
              tf.change >= 0 ? "text-green-600" : "text-red-500"
            }`}
          >
            {tf.change >= 0 ? "+" : ""}
            {tf.change.toFixed(2)}%
          </span>
        </button>
      ))}
    </div>
  );
}
