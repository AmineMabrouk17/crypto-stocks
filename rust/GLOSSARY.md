# Glossary

| Original term | Meaning | Rust name |
| --- | --- | --- |
| Crowd Odds | Polymarket up/down probability snapshot | `CrowdOddsSnapshot` |
| Horizon | 4h / 1D / 1W cadence | `CrowdOddsHorizon` |
| Gamma market | Polymarket market record with double-encoded arrays | `PolymarketMarket` |
| CLOB midpoint | live Up token mid price | `fetch_up_midpoint` |
| Yahoo session | cookie + crumb pair, 1 h TTL | `YahooSession` |
| AssetRef | resolved instrument reference | `AssetRef` |
| ResolvedAsset | asset plus description summary | `ResolvedAsset` |
| Fear & Greed | Alternative.me daily sentiment index | `FearGreedIndex` |
| DayStats | 24 h / daily stats badge payload | `DayStats` |
| NewsArticle | Google News RSS item with heuristic sentiment | `NewsArticle` |
| BYOK | user-supplied LLM key proxied for one request | `LlmSettings` |
