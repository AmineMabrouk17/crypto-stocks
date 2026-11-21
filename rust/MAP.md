# Rust backend migration map

Goal: replace the Next.js backend (`apps/web/app/api/*` plus server-side
`packages/lib` logic) with a standalone axum service while keeping the Next.js
frontend and all existing endpoint contracts unchanged.

## Decisions

See [DECISIONS.md](DECISIONS.md). Domain vocabulary is in [GLOSSARY.md](GLOSSARY.md).

## Units

| Unit | Crate | Wave | State |
| --- | --- | ---: | --- |
| foundation / front door | `app`, `common` | 0 | done |
| fear and greed | `feargreed` | 1 | done |
| coin gecko | `coingecko` | 1 | done |
| news | `news` | 1 | done |
| polymarket crowd odds | `polymarket` | 2 | done |
| yahoo finance | `yahoo` | 3 | done |
| LLM chat | `llm` | 3 | done |
| asset resolver | `resolver` | 3 | done |
| endpoint integration tests | `app/tests` | 4 | done |
| dev/build/docs wiring | root, `apps/web` | 5 | done |
| dead TypeScript removal | old backend | 6 | done |

## Checkpoints

Report after every wave: changed files, test status and benchmark numbers for
touched routes. Stop only for an irreversible decision or an unmet
equivalence bar.

## Out of scope

- Browser-direct Binance REST/WebSocket calls.
- Browser-direct CoinGecko coin-list and description calls used by the search
  bar and description panel.
- All Next.js UI components except the `/api` rewrite and the one-time asset
  resolver call.
