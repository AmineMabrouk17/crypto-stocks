use crypto_stocks_coingecko::port::CoinGeckoService;
use crypto_stocks_common::types::{AssetKind, AssetRef, ResolvedAsset};
use crypto_stocks_yahoo::port::YahooService;

/// Static CoinGecko ids for majors, identical to `KNOWN_COIN_IDS` in the TS
/// `resolveAsset` module. CoinGecko's list contains many scam tokens reusing
/// well-known symbols, so majors are pinned here.
const KNOWN_COIN_IDS: [(&str, &str); 20] = [
    ("BTC", "bitcoin"),
    ("ETH", "ethereum"),
    ("SOL", "solana"),
    ("BNB", "binancecoin"),
    ("XRP", "ripple"),
    ("ADA", "cardano"),
    ("DOGE", "dogecoin"),
    ("TRX", "tron"),
    ("TON", "the-open-network"),
    ("DOT", "polkadot"),
    ("MATIC", "matic-network"),
    ("LTC", "litecoin"),
    ("AVAX", "avalanche-2"),
    ("LINK", "chainlink"),
    ("SHIB", "shiba-inu"),
    ("UNI", "uniswap"),
    ("ATOM", "cosmos"),
    ("XLM", "stellar"),
    ("BCH", "bitcoin-cash"),
    ("NEAR", "near"),
];

/// Port of `resolveAsset` in `apps/web/lib/resolveAsset.ts`.
#[derive(Clone)]
pub struct AssetResolver {
    coingecko: CoinGeckoService,
    yahoo: YahooService,
}

impl AssetResolver {
    pub fn new(coingecko: CoinGeckoService, yahoo: YahooService) -> Self {
        Self { coingecko, yahoo }
    }

    pub async fn resolve(&self, raw_symbol: &str, id_hint: Option<&str>) -> ResolvedAsset {
        let symbol = raw_symbol.to_uppercase();

        if let Some(base) = symbol.strip_suffix("USDT") {
            let known = KNOWN_COIN_IDS
                .iter()
                .find(|(ticker, _)| *ticker == base)
                .map(|(_, id)| *id);
            let mut id = id_hint
                .map(str::to_owned)
                .or_else(|| known.map(str::to_owned))
                .unwrap_or_else(|| base.to_lowercase());
            let mut name = base.to_owned();

            // Only fall back to the CoinGecko list when there is no reliable id.
            if id_hint.is_none()
                && known.is_none()
                && let Ok(list) = self.coingecko.coin_list().await
                && let Some(match_) = list
                    .iter()
                    .find(|coin| coin.symbol.to_lowercase() == base.to_lowercase())
            {
                id = match_.id.clone();
                name = match_.name.clone();
            }

            let mut summary = format!("{name} is a cryptocurrency.");
            // Description is best-effort, matching the TS empty `catch`.
            if let Ok(description) = self.coingecko.coin_description(&id).await {
                summary = description.summary;
                name = description.name;
            }

            return ResolvedAsset {
                asset: AssetRef {
                    kind: AssetKind::Crypto,
                    symbol,
                    id,
                    name,
                },
                summary,
            };
        }

        let mut name = symbol.clone();
        if let Ok(results) = self.yahoo.search(&symbol).await
            && let Some(match_) = results
                .iter()
                .find(|result| result.symbol.to_uppercase() == symbol)
        {
            name = match_.name.clone();
        }

        let mut summary = format!("{name} is a publicly traded stock or ETF.");
        if let Ok(description) = self.yahoo.fetch_description(&symbol).await {
            summary = description.summary;
        }

        ResolvedAsset {
            asset: AssetRef {
                kind: AssetKind::Stock,
                symbol: symbol.clone(),
                id: symbol,
                name,
            },
            summary,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_coin_ids_match_the_ts_pin_list() {
        assert_eq!(KNOWN_COIN_IDS.len(), 20);
        assert_eq!(
            KNOWN_COIN_IDS
                .iter()
                .find(|(t, _)| *t == "BTC")
                .map(|(_, id)| *id),
            Some("bitcoin")
        );
        assert_eq!(
            KNOWN_COIN_IDS
                .iter()
                .find(|(t, _)| *t == "NEAR")
                .map(|(_, id)| *id),
            Some("near")
        );
    }
}
