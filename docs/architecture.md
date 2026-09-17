# Architecture — Crypto & Stocks Dashboard

Real-time crypto/stocks dashboard in a pnpm + Turborepo monorepo. All third-party market data comes from free, read-only APIs proxied server-side; no database, no accounts, no API keys required.

## Monorepo layout

```
crypto-stocks/
├── package.json          # pnpm + Turborepo root; scripts dev/build/lint/tsc/test (turbo run)
├── pnpm-workspace.yaml   # workspaces: apps/*, packages/*
├── turbo.json            # task graph; build/test depend on ^build
├── tsconfig.base.json    # shared strict TS config (ES2022, bundler resolution)
├── AGENTS.md             # commit convention + pnpm/lint rules
├── .github/              # CI workflows
├── apps/web/             # Next.js 16 dashboard (the only app)
└── packages/lib/         # @crypto-stocks/lib (shared data/LLM providers + types)
```

## Data flow

```
Third-party APIs (Binance, Yahoo, CoinGecko, Polymarket, Alternative.me, Google News, LLMs)
        ▲
        │ server-side only (CORS + rate-limit absorption)
apps/web/app/api/*  ←  proxy handlers, add Cache-Control headers
        ▲
        │ fetch + SWR (client hooks in apps/web/lib)
React components (chart, signals, news, chat)
        ▲
        │ shared client state
SelectedAssetContext (live price + MarketStats)
```

- Binance (REST + WebSocket) and CoinGecko are called directly from the browser; everything else routes through the `/api/*` proxies.
- Parser/decision logic lives only in `packages/lib` and is unit-tested ([`fearGreed.test.ts`](../packages/lib/src/fearGreed.test.ts), [`polymarket.test.ts`](../packages/lib/src/polymarket.test.ts)).

---

## `packages/lib` — shared data layer

No build step: `main`/`types` point straight at `./src/index.ts`, compiled through the app via `transpilePackages`. No runtime dependencies (platform `fetch`/`Intl`/`Date` only).

| File | Contents |
|------|----------|
| `index.ts` | Barrel — re-exports all modules below. |
| `types.ts` | All domain types: `AssetRef`, `Candle`, `ChatMessage`, `LlmSettings`, `LlmProvider`, `FreeModel`, `MarketStats`, `DayStats`, `PriceAlert`, `NewsArticle`, `SearchResult`, `CoinListEntry`. |
| `constants.ts` | Central URL registry (Binance REST/WS, CoinGecko, Yahoo, Polymarket Gamma/CLOB, Gemini, Groq, Google News), `FREE_MODELS` catalog, `DEFAULT_WATCHLIST`. |
| `format.ts` | `decimalsForPrice`, `formatNumber`, `formatCurrency` (Intl-based, price-adaptive precision). |
| `chartRange.ts` | Maps UI ranges (`1D…ALL`) → Binance/Yahoo params via `binanceRangeConfig`/`yahooRangeConfig`; `stockPollingIntervalMs`; type guard `isChartRange`. |
| `binance.ts` | Binance REST (`fetchKlines`, `fetchTicker24hr`) + WS stream URL builders and parsers (`klineStreamUrl`, `parseKlineMessage`, `parseMiniTickerMessage`). |
| `coingecko.ts` | `fetchCoinList`, `fetchCoinDescription` (strips HTML → summary paragraph). |
| `yahooFinance.ts` | Cookie+crumb session manager (`getYahooSession`, 1h TTL), `fetchYahooQuote`, `searchYahoo`, `fetchYahooDescription`. |
| `gemini.ts` | `generateChatReply` — Gemini `generateContent` client. |
| `openai.ts` | `OPENAI_API_BASE`, `generateChatReplyOpenAI` — also serves Groq + custom OpenAI-compatible endpoints. |
| `anthropic.ts` | `ANTHROPIC_API_BASE`, `generateChatReplyAnthropic` (Messages API). |
| `news.ts` | `fetchNewsFeed` — Google News RSS parsing + keyword-heuristic sentiment tagging. |
| `fearGreed.ts` | `fetchFearGreedIndex` / `parseFearGreedIndex` — Alternative.me index. |
| `polymarket.ts` | Largest module: market discovery (curated slugs + generic search), `fetchCrowdOdds`, CLOB midpoint parsing — all read-only. |
| `fearGreed.test.ts`, `polymarket.test.ts` | Vitest unit tests against real API fixtures. |
| `vitest.config.ts`, `tsconfig.json`, `package.json` | Config. |

### Intra-package dependency graph

```
index.ts ──► all other src modules (re-export barrel)

constants.ts ──► types.ts (types only)
binance.ts    ──► constants.ts, types.ts
coingecko.ts  ──► constants.ts, types.ts
yahooFinance.ts ─► constants.ts, types.ts
gemini.ts     ──► constants.ts, types.ts
openai.ts     ──► types.ts
anthropic.ts  ──► types.ts
news.ts       ──► constants.ts, types.ts
fearGreed.ts  ──► constants.ts
polymarket.ts ──► constants.ts
format.ts     ──► (none)
chartRange.ts ──► (none)
types.ts      ──► (leaf / no deps)
```

Service mapping: Binance → `binance.ts`; CoinGecko → `coingecko.ts`; Yahoo (chart/search/profile + crumb bootstrap) → `yahooFinance.ts`; Gemini → `gemini.ts`; OpenAI/compatible → `openai.ts`; Anthropic → `anthropic.ts`; Google News RSS → `news.ts`; Alternative.me → `fearGreed.ts`; Polymarket (Gamma + CLOB) → `polymarket.ts`. Groq has no dedicated module — it flows through the OpenAI-compatible path in `openai.ts` (`GROQ_API_BASE` lives in `constants.ts`).

---

## `apps/web/app/` — routes

| File | Contents |
|------|----------|
| `layout.tsx` | Root layout: fonts, `ThemeProvider` → `SelectedAssetProvider` → global `PriceAlertWatcher`. |
| `page.tsx` | `/` dashboard: header (search, watchlist/settings toggles, `ThemeToggle`) + `DashboardGrid` + `LlmSettingsPanel`. |
| `globals.css` | Tailwind v4 theme tokens, shadcn design tokens, `.glass-tile`, `.noise-bg`. |
| `asset/[symbol]/page.tsx` | SSR detail page; `generateMetadata` via `resolveAsset`. |
| `api/chat/route.ts` | LLM proxy: grounds system prompt in live price/stats; 3 paths — BYOK provider dispatch, free-model, default server Gemini key. Reads `GEMINI_API_KEY`/`GROQ_API_KEY`. |
| `api/news/route.ts` | → `fetchNewsFeed` (Google News RSS). |
| `api/stocks/quote/route.ts` | → `fetchYahooQuote`; `Cache-Control: 5s` (absorbs polling bursts). |
| `api/stocks/search/route.ts` | → `searchYahoo`. |
| `api/stocks/profile/route.ts` | → `fetchYahooDescription`. |
| `api/signals/sentiment/route.ts` | → `fetchFearGreedIndex` (daily, cached 1h). |
| `api/signals/crowd-odds/route.ts` | → `fetchCrowdOdds` (validates symbol+horizon; 30s cache). |

### API route → service map

| Route | lib call | Service |
|-------|----------|---------|
| `/api/stocks/quote` | `fetchYahooQuote` | Yahoo Finance chart API |
| `/api/stocks/search` | `searchYahoo` | Yahoo search (cookie/crumb from `fc.yahoo.com`) |
| `/api/stocks/profile` | `fetchYahooDescription` | Yahoo quoteSummary |
| `/api/news` | `fetchNewsFeed` | Google News RSS |
| `/api/signals/sentiment` | `fetchFearGreedIndex` | Alternative.me |
| `/api/signals/crowd-odds` | `fetchCrowdOdds` | Polymarket Gamma + CLOB |
| `/api/chat` | `generateChatReply*` | Gemini / OpenAI / Groq / Anthropic / custom |

Client-side direct provider calls (no API route): Binance klines + 24h stats + WS stream (`useCryptoKlineStream`, `useCrypto24hStats`); CoinGecko descriptions (`AssetDescriptionPanel`, `resolveAsset`) and coin list (`coinListCache`).

---

## `apps/web/components/`

### `dashboard/` — the bento grid

| File | Contents |
|------|----------|
| `DashboardGrid.tsx` | Composition root for `/`: 3-pane layout (watchlist rail, chart grid, chat panel); lifts description → chat context. |
| `AssetChartPanel.tsx` | Main price card: range selector, chart-type toggle, price ticker, CSV export, alert bell; branches crypto-vs-stock hooks; feeds `SelectedAssetContext`. |
| `AssetSearchBar.tsx` | ⌘K search; debounced parallel search (cached CoinGecko list + `/api/stocks/search`); adds + selects result. |
| `Watchlist.tsx` | Persisted watchlist rows with per-kind theming + remove-on-hover. |
| `PriceAlertPanel.tsx` | Alert creation popover (above/below, browser notifications). |
| `PriceAlertWatcher.tsx` | Global side-effect: fires notifications when a trigger crosses on the open asset. |

### `chart/` — price data & signals

| File | Contents |
|------|----------|
| `PriceChart.tsx` | `lightweight-charts` wrapper; imperative `PriceChartHandle` (`setData`/`update`). |
| `ChartRangeSelector.tsx` | Segmented range pills. |
| `useCryptoKlineStream.ts` | Crypto: seeds via REST, streams via Binance WS, auto-reconnect w/ backoff, computes `MarketStats`. |
| `useStockPolling.ts` | Stock: SWR poll `/api/stocks/quote`, mutates last candle. |
| `useCrypto24hStats.ts` / `useStockDayStats.ts` | 24h / daily header stats (SWR). |
| `SentimentIndex.tsx` / `CrowdOdds.tsx` / `MarketSignals.tsx` | Fear & Greed gauge; Polymarket odds card (horizon tabs, countdown); crypto-only signal strip. |

### `asset/`

| File | Contents |
|------|----------|
| `AssetDetailView.tsx` | Composition root for `/asset/[symbol]`. |
| `AssetDescriptionPanel.tsx` | "About" summary (CoinGecko direct / `/api/stocks/profile`), reports up via `onLoaded`. |
| `NewsFeed.tsx` | News list w/ sentiment badge, 5-min poll. |

### `chat/`

| File | Contents |
|------|----------|
| `ChatPanel.tsx` | AI assistant side panel; posts `/api/chat`, free-model selector, provider badge, `TextReveal` replies. |

### `providers/`, `settings/`

| File | Contents |
|------|----------|
| `providers/SelectedAssetContext.tsx` | Shared state channel: selected asset + live price + `MarketStats`. |
| `settings/LlmSettingsPanel.tsx` | BYOK drawer (provider/key/model/base URL), "test connection", saves to localStorage. |

### `motion/` + `ui/` — vendored (ESLint-ignored, `components.json`)

`SharedLayoutBg`, `AnimatedBadge`, `TextReveal`, `Loader` (18 variants), `NumberTicker`, `ActionSwap`, `ThemeToggle`, `Button`/`StatefulButton`, plus a shadcn `ui/button.tsx`. Built on `motion/react` + `@/lib/ease` spring presets.

---

## `apps/web/lib/` — client hooks & utilities

| File | Contents |
|------|----------|
| `utils.ts` | `cn()` (clsx + tailwind-merge). |
| `ease.ts` | Shared easing curves / spring presets. |
| `resolveAsset.ts` | Server-side URL → `AssetRef` resolver (USDT → CoinGecko, else Yahoo search). |
| `coinListCache.ts` | CoinGecko list cache (memory + sessionStorage, 24h TTL). |
| `assetLogos.ts` | `logoUrl()` for logo.dev. |
| `useWatchlist.ts` / `useWatchlistVisible.ts` / `useChatCollapsed.ts` | `useSyncExternalStore` + localStorage-backed stores. |
| `usePriceAlerts.ts` | Alert store (create / remove / `markTriggered`). |
| `useLlmSettings.ts` / `useFreeModel.ts` | BYOK + free-model settings (localStorage, validated). |
| `useChartRange.ts` / `useChartType.ts` | Range via URL `?range=`, type via localStorage (cross-tab sync). |
| `hooks/use-hover-capable.ts` | SSR-safe `(hover:hover)` && `(pointer:fine)` detector. |

---

## Root config (`apps/web/`)

| File | Contents |
|------|----------|
| `package.json` | Deps: `@crypto-stocks/lib`, Next 16, React 19, Tailwind v4, SWR, `lightweight-charts`, `motion`, `next-themes`, `lucide-react`, `jspdf`, `@base-ui/react`. |
| `next.config.ts` | `transpilePackages: ["@crypto-stocks/lib"]`. |
| `tsconfig.json` | Strict, `@/*` → `./*` alias. |
| `postcss.config.mjs` | `@tailwindcss/postcss` only. |
| `eslint.config.mjs` | `eslint-config-next` core-web-vitals + typescript; ignores `.next`, build output, vendored `ui/`,`motion/`. |
| `components.json` | shadcn/beUI registry config. |
| `.env.example` | `GEMINI_API_KEY`, `GROQ_API_KEY`, `NEXT_PUBLIC_LOGO_DEV_KEY`. |

---

## Cross-cutting facts

- **Server-side proxies** (`/api/*`) fetch third-party APIs and attach `Cache-Control` — clients never hit the providers directly, absorbing shared rate limits (e.g. Polymarket Gamma 300 req/10s).
- **Database-free & private**: no Supabase, no accounts, no user data. AI keys stay in `localStorage` (BYOK) and go straight to the provider, never the server.
- **Two composition roots** — `page.tsx` → `DashboardGrid` and `asset/[symbol]/page.tsx` → `AssetDetailView` — reuse the same component battery: `AssetChartPanel`, `AssetDescriptionPanel`, `NewsFeed`, `ChatPanel`, all fed through `SelectedAssetContext`.
- **Parsers are unit-tested** against real API fixtures in `packages/lib/src/*.test.ts`.