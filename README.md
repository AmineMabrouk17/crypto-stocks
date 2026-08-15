<p align="center">
  <a href="https://crypto-stocks-web-taupe.vercel.app">
    <img src="https://raw.githubusercontent.com/AmineMabrouk17/crypto-stocks/main/apps/web/public/globe.svg" alt="Crypto & Stocks Dashboard" width="96" height="96" />
  </a>
</p>

<h1 align="center">Crypto & Stocks Dashboard</h1>

<p align="center">
  <b>Real-time crypto, stocks & ETFs — live charts, an AI trading assistant, and read-only market signals in one dashboard.</b>
</p>

<p align="center">
  <a href="https://crypto-stocks-web-taupe.vercel.app">
    <img src="https://img.shields.io/badge/Live%20Demo-Click%20Here-4f46e5?style=for-the-badge&logo=vercel&logoColor=white" alt="Live demo" />
  </a>
  <a href="https://github.com/AmineMabrouk17/crypto-stocks">
    <img src="https://img.shields.io/badge/View%20Source-GitHub-181717?style=for-the-badge&logo=github&logoColor=white" alt="Source code" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js%2016-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind%20CSS%20v4-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white" alt="pnpm" />
  <img src="https://img.shields.io/badge/Turborepo-EF4444?style=for-the-badge&logo=turborepo&logoColor=white" alt="Turborepo" />
  <img src="https://img.shields.io/badge/SWR-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="SWR" />
  <img src="https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest" />
</p>

---

## 📈 Overview

**Crypto & Stocks Dashboard** is a real-time market terminal that tracks **cryptocurrencies, stocks, and ETFs** side by side — no account, no API keys, and no database required.

- **Crypto** prices stream live from **Binance** over WebSockets.
- **Stocks & ETFs** (AAPL, QQQ, SPY, …) are served near-real-time by **Yahoo Finance**.
- **Live charts** render on the open-source `lightweight-charts` engine.
- A **context-aware AI assistant** answers questions about the asset you're looking at — price action, fundamentals, and recent news — powered by a **free default Gemini model**, or your own key.
- **Market signals** show real market opinion: real-money **crowd odds** from Polymarket and the daily **Fear & Greed sentiment index** (crypto only).

It's designed to be **fast, private, and zero-setup**: all market data comes from free, read-only third-party APIs via thin server-side proxies, so you can clone it, run `pnpm dev`, and start trading a demo in under a minute.

## ✨ Features

### Core functionality
- **Real-time crypto prices** — WebSocket K-line streaming from Binance (`wss://stream.binance.com`).
- **Near-real-time stocks & ETFs** — quotes, intraday ranges, and search via Yahoo Finance.
- **Live interactive charts** — `lightweight-charts` with candlestick / line / area modes, multiple time ranges, and a **directional forecast** overlay.
- **Watchlist & asset search** — persistent across sessions, with one-click switching between assets.
- **Asset detail pages** — dedicated `/asset/[symbol]` route per instrument.
- **Price alerts** — set above/below targets with **browser notifications** (stored locally; fires while the asset is open).
- **Data export** — export chart candles to **CSV** and a portfolio summary to **PDF** (`jspdf`).

### AI assistant
- Ask anything about the selected asset — replies are grounded in the **live price, market stats, and asset description**.
- **No-key default**: ships with free Gemini models out of the box.
- **Bring your own key (BYOK)**: Gemini, OpenAI, Anthropic, Groq, or any OpenAI-compatible endpoint — your key lives in `localStorage` and goes **directly to your provider, never to the server**.
- Collapsible side panel, streaming-ready chat UI with animated text reveal.

### Market signals (crypto only)
- **Crowd Odds** — Polymarket's real-money probability that an asset closes up or down over a chosen **horizon (4h / 1D / 1W)**.
- **Sentiment Index** — the Alternative.me **Fear & Greed** gauge (0–100, Extreme Fear → Extreme Greed, updated daily).
- Read-only by design: **no user input is stored, nothing is ever written to a prediction market**.

### News & context
- **News feed** per asset from **Google News RSS**, with a lightweight positive/negative **keyword sentiment heuristic**.
- **Asset description panel** — what the asset is, fed into the AI assistant's context.

### UI / UX
- Responsive 3-column layout with a **collapsible chat sidebar**.
- **Light / dark theme** toggle (respects system preference).
- Motion-driven polish: text reveal, number tickers, animated badges, and stateful (idle → loading → success/error) buttons.
- Performance-friendly animations via the `motion` library.

## 🧱 Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, React 19, TypeScript) |
| Styling | Tailwind CSS v4, `cva`, `tailwind-merge` |
| Charts | `lightweight-charts` |
| Data fetching | SWR + server-side proxy routes with `Cache-Control` |
| Monorepo | pnpm workspaces + Turborepo |
| Testing | Vitest (unit tests with real API fixtures) |
| LLMs | Gemini, Groq, OpenAI, Anthropic, custom OpenAI-compatible endpoints |

## 🔌 Data Sources

All market data comes from free, read-only APIs — **no credentials needed**:

| Source | What it feeds |
|--------|---------------|
| Binance | Real-time crypto prices, K-line/WebSocket streams |
| Yahoo Finance | Stock & ETF quotes, search, company profiles |
| CoinGecko | Crypto market data & stats |
| Alternative.me | Fear & Greed sentiment index |
| Polymarket | Real-money crowd odds (up/down by horizon) |
| Google News RSS | Per-asset news feed with keyword sentiment |

## 🗺️ Roadmap & Suggested Issues

| Priority | Suggestion |
|----------|------------|
| 🔴 High | **Background price-alert monitoring** — alerts currently only trigger while their asset is open; a worker/PWA would let them fire anywhere |
| 🔴 High | **Portfolio & position tracking** — track buys/sells locally and compute P&L per asset |
| 🔴 High | **Shareable watchlists & layout sync** — export/import watchlists via a share URL |
| 🟠 Medium | **Real sentiment analysis** — replace the keyword heuristic with an LLM or proper NLP model |
| 🟠 Medium | **Technical indicators** — RSI, moving averages, and volume overlays on the chart |
| 🟠 Medium | **Localization (i18n)** — English, French, and Arabic UI strings |
| 🟠 Medium | **More horizon options & multi-asset signals** — extend crowd odds beyond 4h/1D/1W, and surface stock sentiment |
| 🟢 Low | **PWA / offline support** — installable app with cached watchlists and alerts |
| 🟢 Low | **E2E test coverage** — Playwright flows for search, chart, and chat |
| 🟢 Low | **WebSocket resilience** — backoff/reconnect strategies with exponential jitter |
| 🟢 Low | **Accessibility pass** — full keyboard navigation and ARIA audit |

## 🚀 Getting Started

### Prerequisites
- **Node.js 22+**
- **pnpm 10+**

### Run locally

```bash
# install dependencies
pnpm install

# start the dev server (apps/web on http://localhost:3000)
pnpm dev

# lint, typecheck, test, build
pnpm lint
pnpm tsc
pnpm test
pnpm build
```

> **Note for US deployments**: Binance geo-blocks US IPs. Swap the base URLs in `packages/lib/src/constants.ts` to `api.binance.us` / `stream.binance.us` if deploying from the US.

## 📁 Project Structure

```
crypto-stocks/
├── apps/
│   └── web/                  # Next.js dashboard (main app)
│       ├── app/              # routes: /, /asset/[symbol], /api/*
│       ├── components/       # dashboard, chart, chat, motion, settings
│       └── lib/              # client hooks (SWR, alerts, LLM settings)
├── packages/
│   └── lib/                  # @crypto-stocks/lib — providers, parsing, tests
├── docs/
│   └── adr/                  # architectural decision records
├── package.json              # Turborepo root
└── turbo.json
```

## 🏗️ Architecture Notes

- **Server-side proxies** (`/api/*`) fetch from third-party APIs and attach `Cache-Control` headers — clients never hit the providers directly, absorbing rate limits (e.g., Polymarket Gamma is 300 req/10s per IP, shared across visitors).
- **Database-free & private**: no Supabase, no accounts, no user data. AI keys stay in the browser.
- **Decision-rich parsing lives in the shared lib** and is unit-tested against real API fixtures (`packages/lib/src/*.test.ts`).
- Architecture decisions are recorded in `docs/adr/`.

## 🤝 Contributing

1. Fork the repo and create a branch from `main`.
2. Follow the [Conventional Commits](https://www.conventionalcommits.org/) convention (e.g., `feat:`, `fix:`, `style:`, `docs:`).
3. Run `pnpm lint && pnpm tsc` before pushing.

## 📄 License

All data is provided by third-party services under their own terms. This project is a private demo/learning build.
