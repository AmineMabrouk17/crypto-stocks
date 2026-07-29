"use client";

import { useState } from "react";
import {
  Search,
  ChevronDown,
  User,
  TrendingUp,
  Globe,
} from "lucide-react";

const navLinks = [
  { label: "Products", active: false },
  { label: "Community", active: false },
  { label: "Markets", active: true },
  { label: "Brokers", active: false },
  { label: "More", active: false },
];

export function TradingViewHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-4">
        <div className="flex items-center gap-2 shrink-0">
          <TrendingUp className="h-6 w-6 text-blue-600" />
          <span className="text-lg font-bold tracking-tight">TradingView</span>
        </div>

        <div className="relative hidden sm:block flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search (⌘K)"
            className="w-full rounded-md border border-gray-300 bg-gray-50 py-1.5 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href="#"
              className={`relative px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                link.active
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              {link.label}
              {link.active && (
                <span className="absolute -bottom-[13px] left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-blue-600" />
              )}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <button className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900">
            <Globe className="h-4 w-4" />
            <span>EN</span>
            <ChevronDown className="h-3 w-3" />
          </button>

          <button className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700">
            <User className="h-5 w-5" />
          </button>

          <button className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
            Get started
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
            aria-label="Menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-gray-200 bg-white px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href="#"
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  link.active
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
