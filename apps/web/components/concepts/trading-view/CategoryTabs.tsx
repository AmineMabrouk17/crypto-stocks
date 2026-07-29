"use client";

const tabs = [
  { label: "Overview", active: true },
  { label: "News", active: false },
  { label: "Community", active: false },
  { label: "Technicals", active: false },
  { label: "Seasonals", active: false },
  { label: "Components", active: false },
  { label: "Options", active: false },
];

export function CategoryTabs() {
  return (
    <div className="mt-6 border-b border-gray-200">
      <div className="flex gap-1 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.label}
            className={`relative shrink-0 px-4 py-3 text-sm font-medium transition-colors ${
              tab.active
                ? "text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {tab.active && (
              <span className="absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-gray-900" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
