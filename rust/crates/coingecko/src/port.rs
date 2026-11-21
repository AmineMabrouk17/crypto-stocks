use std::{sync::Arc, sync::LazyLock, time::Duration};

use crypto_stocks_common::{
    cache::{single_flight, ttl_cache},
    client::{Http, HttpRequest},
    error::Result,
    types::{AssetDescription, CoinListEntry},
};
use moka::future::Cache;
use regex::Regex;
use serde::Deserialize;
use serde_json::{Map, json};

static HTML_TAG: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"<[^>]*>").unwrap());

#[derive(Debug, Deserialize)]
struct DescriptionField {
    #[serde(default)]
    en: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MarketData {
    current_price: Option<UsdPrice>,
    market_cap: Option<UsdPrice>,
}

#[derive(Debug, Deserialize)]
struct UsdPrice {
    usd: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct CoinGeckoCoinResponse {
    name: String,
    #[serde(default)]
    description: Option<DescriptionField>,
    market_cap_rank: Option<i64>,
    market_data: Option<MarketData>,
}

/// Port of the TS `stripHtml`: remove every `<...>` and trim.
fn strip_html(html: &str) -> String {
    HTML_TAG.replace_all(html, "").trim().to_owned()
}

/// Pure port of the CoinGecko `/coins/{id}` response mapping, kept separate so
/// the shape can be tested against the TS output with recorded fixtures.
fn map_coin_description(data: &CoinGeckoCoinResponse) -> AssetDescription {
    let full_text = data
        .description
        .as_ref()
        .and_then(|description| description.en.as_deref())
        .map(strip_html)
        .unwrap_or_default();

    let summary = if full_text.is_empty() {
        format!("{} is a cryptocurrency.", data.name)
    } else {
        full_text
            .split("\n\n")
            .next()
            .unwrap_or_default()
            .to_owned()
    };

    let mut extra = Map::new();
    if let Some(rank) = data.market_cap_rank {
        extra.insert("marketCapRank".into(), json!(rank));
    }
    if let Some(price) = data
        .market_data
        .as_ref()
        .and_then(|market| market.current_price.as_ref())
        .and_then(|price| price.usd)
    {
        extra.insert("priceUsd".into(), json!(price));
    }
    if let Some(cap) = data
        .market_data
        .as_ref()
        .and_then(|market| market.market_cap.as_ref())
        .and_then(|cap| cap.usd)
    {
        extra.insert("marketCapUsd".into(), json!(cap));
    }

    AssetDescription {
        name: data.name.clone(),
        summary,
        extra: Some(extra),
    }
}

/// Coin list is cached for 24 h; descriptions get a short cache purely for
/// in-flight deduplication (the TS module had no persistent description cache).
#[derive(Clone)]
pub struct CoinGeckoService {
    http: Arc<Http>,
    base: String,
    coin_list: Cache<&'static str, Vec<CoinListEntry>>,
    descriptions: Cache<String, AssetDescription>,
}

impl CoinGeckoService {
    pub fn new(http: Arc<Http>, base: String) -> Self {
        Self {
            http,
            base,
            coin_list: ttl_cache(Duration::from_secs(86_400), 8),
            descriptions: ttl_cache(Duration::from_secs(60), 512),
        }
    }

    pub async fn coin_list(&self) -> Result<Vec<CoinListEntry>> {
        let http = self.http.clone();
        let base = self.base.clone();
        single_flight(&self.coin_list, "all", || async move {
            let request = HttpRequest::get(format!("{base}/coins/list"))?;
            http.json_checked(&request, "CoinGecko coin list").await
        })
        .await
        .map_err(|error| (*error).clone())
    }

    pub async fn coin_description(&self, coin_id: &str) -> Result<AssetDescription> {
        let http = self.http.clone();
        let base = self.base.clone();
        let key = coin_id.to_owned();
        single_flight(&self.descriptions, key, || async move {
            let request = HttpRequest::get(format!(
                "{base}/coins/{coin_id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false"
            ))?;
            let data: CoinGeckoCoinResponse = http
                .json_checked(&request, "CoinGecko coin")
                .await?;
            Ok(map_coin_description(&data))
        })
        .await
        .map_err(|error| (*error).clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_html_and_takes_the_first_paragraph() {
        let data: CoinGeckoCoinResponse = serde_json::from_value(json!({
            "name": "Bitcoin",
            "description": { "en": "<p>Bitcoin is <b>digital</b> cash.\n\nSecond paragraph.</p>" },
            "market_cap_rank": 1,
            "market_data": {
                "current_price": { "usd": 67000.5 },
                "market_cap": { "usd": 1320000000000i64 }
            }
        }))
        .unwrap();

        let description = map_coin_description(&data);
        assert_eq!(description.name, "Bitcoin");
        assert_eq!(description.summary, "Bitcoin is digital cash.");
        let extra = description.extra.as_ref().unwrap();
        assert_eq!(extra["marketCapRank"], json!(1));
        assert_eq!(extra["priceUsd"], json!(67000.5));
        assert_eq!(extra["marketCapUsd"].as_f64(), Some(1_320_000_000_000.0));
    }

    #[test]
    fn falls_back_when_the_description_is_empty() {
        let data: CoinGeckoCoinResponse =
            serde_json::from_value(json!({ "name": "Example Coin", "description": { "en": "" } }))
                .unwrap();
        let description = map_coin_description(&data);
        assert_eq!(description.summary, "Example Coin is a cryptocurrency.");
        assert!(description.extra.as_ref().unwrap().is_empty());
    }

    #[test]
    fn serialised_shape_omits_undefined_like_json_stringify() {
        let data: CoinGeckoCoinResponse =
            serde_json::from_value(json!({ "name": "Example Coin", "description": null })).unwrap();
        let value = serde_json::to_value(map_coin_description(&data)).unwrap();
        assert_eq!(
            value,
            json!({
                "name": "Example Coin",
                "summary": "Example Coin is a cryptocurrency.",
                "extra": {}
            })
        );
    }
}
