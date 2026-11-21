use std::{sync::Arc, time::Duration};

use crypto_stocks_common::{
    cache::{single_flight, ttl_cache},
    client::{Http, HttpRequest},
    error::{Error, Result},
    types::{AssetDescription, Candle, DayStats, SearchResult, YahooQuote},
    url::encode_uri_component,
};
use moka::future::Cache;
use serde_json::Value;

const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const SESSION_TTL: Duration = Duration::from_secs(60 * 60);

#[derive(Debug, Clone)]
struct YahooSession {
    cookie: String,
    crumb: String,
}

/// Yahoo Finance client. Chart quotes need no session; search and description
/// need a cookie + crumb pair that is cached for one hour with single-flight
/// dedup, mirroring the TS module-level session cache.
#[derive(Clone)]
pub struct YahooService {
    http: Arc<Http>,
    query_base: String,
    fc_base: String,
    session: Cache<String, YahooSession>,
}

impl YahooService {
    pub fn new(http: Arc<Http>, query_base: String, fc_base: String) -> Self {
        Self {
            http,
            query_base,
            fc_base,
            session: ttl_cache(SESSION_TTL, 1),
        }
    }

    async fn get_session(&self) -> Result<YahooSession> {
        let this = self.clone();
        single_flight(&self.session, "session".to_owned(), || async move {
            let fc_request =
                HttpRequest::get(this.fc_base.clone())?.header("User-Agent", USER_AGENT)?;
            let fc_response = this.http.send(&fc_request).await?;
            let cookie = fc_response
                .headers()
                .get("set-cookie")
                .and_then(|value| value.to_str().ok())
                .unwrap_or("")
                .split(';')
                .next()
                .unwrap_or("")
                .to_owned();

            let crumb_url = format!("{}/v1/test/getcrumb", this.query_base);
            let crumb_request = HttpRequest::get(crumb_url)?
                .header("User-Agent", USER_AGENT)?
                .header("Cookie", &cookie)?;
            let crumb = this
                .http
                .text_checked(&crumb_request, "Yahoo crumb")
                .await?
                .trim()
                .to_owned();

            Ok(YahooSession { cookie, crumb })
        })
        .await
        .map_err(|error| (*error).clone())
    }

    pub async fn fetch_quote(
        &self,
        symbol: &str,
        range: &str,
        interval: &str,
    ) -> Result<YahooQuote> {
        let url = format!(
            "{}/v8/finance/chart/{}?interval={}&range={}",
            self.query_base,
            encode_uri_component(symbol),
            encode_uri_component(interval),
            encode_uri_component(range)
        );
        let request = HttpRequest::get(url)?.header("User-Agent", USER_AGENT)?;
        let data: Value = self.http.json_checked(&request, "Yahoo chart").await?;
        parse_quote(&data)
    }

    pub async fn search(&self, query: &str) -> Result<Vec<SearchResult>> {
        let session = self.get_session().await?;
        let url = format!(
            "{}/v1/finance/search?q={}&crumb={}",
            self.query_base,
            encode_uri_component(query),
            encode_uri_component(&session.crumb)
        );
        let request = HttpRequest::get(url)?
            .header("User-Agent", USER_AGENT)?
            .header("Cookie", &session.cookie)?;
        let data: Value = self.http.json_checked(&request, "Yahoo search").await?;
        Ok(parse_search(&data))
    }

    pub async fn fetch_description(&self, symbol: &str) -> Result<AssetDescription> {
        let session = self.get_session().await?;
        let url = format!(
            "{}/v10/finance/quoteSummary/{}?modules=assetProfile,summaryProfile,fundProfile&crumb={}",
            self.query_base,
            encode_uri_component(symbol),
            encode_uri_component(&session.crumb)
        );
        let request = HttpRequest::get(url)?
            .header("User-Agent", USER_AGENT)?
            .header("Cookie", &session.cookie)?;
        let data: Value = self
            .http
            .json_checked(&request, "Yahoo quoteSummary")
            .await?;
        Ok(parse_description(symbol, &data))
    }
}

fn number(value: Option<&Value>) -> Option<f64> {
    value.and_then(Value::as_f64).filter(|n| n.is_finite())
}

fn string(value: Option<&Value>) -> Option<String> {
    value.and_then(Value::as_str).map(str::to_owned)
}

/// JS `||` treats `""` as falsy; `Option::or_else` does not.
fn non_empty_string(value: Option<&Value>) -> Option<String> {
    string(value).filter(|text| !text.is_empty())
}

/// Port of `fetchYahooQuote`'s response mapping.
pub fn parse_quote(data: &Value) -> Result<YahooQuote> {
    let result = data
        .get("chart")
        .and_then(|c| c.get("result"))
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .ok_or_else(|| Error::parse("Yahoo chart response missing result"))?;

    let timestamps = result
        .get("timestamp")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let quote = result
        .get("indicators")
        .and_then(|i| i.get("quote"))
        .and_then(Value::as_array)
        .and_then(|items| items.first());

    let array = |key: &str| -> Vec<Option<f64>> {
        quote
            .and_then(|q| q.get(key))
            .and_then(Value::as_array)
            .map(|items| items.iter().map(|v| number(Some(v))).collect())
            .unwrap_or_default()
    };
    let opens = array("open");
    let highs = array("high");
    let lows = array("low");
    let closes = array("close");

    let candles = timestamps
        .iter()
        .enumerate()
        .filter_map(|(i, t)| {
            let time = t.as_i64()?;
            let open = opens.get(i).copied().flatten()?;
            let high = highs.get(i).copied().flatten()?;
            let low = lows.get(i).copied().flatten()?;
            let close = closes.get(i).copied().flatten()?;
            Some(Candle {
                time,
                open,
                high,
                low,
                close,
            })
        })
        .collect();

    let meta = result.get("meta");
    let price = number(meta.and_then(|m| m.get("regularMarketPrice")));
    let previous_close = number(meta.and_then(|m| m.get("previousClose")))
        .or_else(|| number(meta.and_then(|m| m.get("chartPreviousClose"))));
    let change_percent = match (price, previous_close) {
        (Some(price), Some(previous)) if previous != 0.0 => {
            Some(((price - previous) / previous) * 100.0)
        }
        _ => None,
    };

    Ok(YahooQuote {
        price,
        currency: string(meta.and_then(|m| m.get("currency"))),
        candles,
        day_stats: DayStats {
            change_percent,
            high: number(meta.and_then(|m| m.get("regularMarketDayHigh"))),
            low: number(meta.and_then(|m| m.get("regularMarketDayLow"))),
            volume: number(meta.and_then(|m| m.get("regularMarketVolume"))),
        },
    })
}

/// Port of `searchYahoo`'s response mapping.
pub fn parse_search(data: &Value) -> Vec<SearchResult> {
    data.get("quotes")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .iter()
        .filter(|quote| {
            matches!(
                string(quote.get("quoteType")).as_deref(),
                Some("EQUITY") | Some("ETF")
            )
        })
        .filter_map(|quote| {
            let symbol = string(quote.get("symbol"))?;
            let name = non_empty_string(quote.get("shortname"))
                .or_else(|| non_empty_string(quote.get("longname")))
                .unwrap_or_else(|| symbol.clone());
            Some(SearchResult {
                kind: crypto_stocks_common::types::AssetKind::Stock,
                id: symbol.clone(),
                symbol,
                name,
            })
        })
        .collect()
}

/// Port of `fetchYahooDescription`'s response mapping.
pub fn parse_description(symbol: &str, data: &Value) -> AssetDescription {
    let result = data
        .get("quoteSummary")
        .and_then(|q| q.get("result"))
        .and_then(Value::as_array)
        .and_then(|items| items.first());

    let long_summary = result
        .and_then(|r| r.get("assetProfile"))
        .and_then(|p| string(p.get("longBusinessSummary")))
        .or_else(|| {
            result
                .and_then(|r| r.get("summaryProfile"))
                .and_then(|p| string(p.get("longBusinessSummary")))
        });
    let fund_category = result
        .and_then(|r| r.get("fundProfile"))
        .and_then(|p| string(p.get("categoryName")));

    let summary = long_summary.unwrap_or_else(|| match fund_category {
        Some(category) => format!(
            "{symbol} is an exchange-traded fund tracking the {category} category."
        ),
        None => format!(
            "{symbol} is a publicly traded equity or fund. No detailed profile is available from this data source."
        ),
    });

    AssetDescription {
        name: symbol.to_owned(),
        summary,
        extra: None,
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn parses_a_chart_with_candles_and_day_stats() {
        let data = json!({
            "chart": { "result": [{
                "timestamp": [1_700_000_000i64, 1_700_000_060, 1_700_000_120],
                "indicators": { "quote": [{
                    "open": [100.0, 101.0, null],
                    "high": [102.0, 103.0, null],
                    "low": [99.0, 100.0, null],
                    "close": [101.0, 102.0, null]
                }]},
                "meta": {
                    "regularMarketPrice": 110.0,
                    "previousClose": 100.0,
                    "currency": "USD",
                    "regularMarketDayHigh": 112.0,
                    "regularMarketDayLow": 99.0,
                    "regularMarketVolume": 1_000_000
                }
            }]}
        });
        let quote = parse_quote(&data).unwrap();
        assert_eq!(quote.price, Some(110.0));
        assert_eq!(quote.currency.as_deref(), Some("USD"));
        assert_eq!(quote.candles.len(), 2);
        assert_eq!(quote.candles[0].time, 1_700_000_000);
        assert_eq!(quote.candles[0].open, 100.0);
        assert_eq!(quote.day_stats.change_percent, Some(10.0));
        assert_eq!(quote.day_stats.high, Some(112.0));
        assert_eq!(quote.day_stats.volume, Some(1_000_000.0));
    }

    #[test]
    fn errors_on_a_missing_chart_result() {
        let error = parse_quote(&json!({ "chart": { "result": [] } })).unwrap_err();
        assert_eq!(error.to_string(), "Yahoo chart response missing result");
    }

    #[test]
    fn falls_back_to_chart_previous_close() {
        let data = json!({
            "chart": { "result": [{
                "meta": { "regularMarketPrice": 90.0, "chartPreviousClose": 100.0 }
            }]}
        });
        let quote = parse_quote(&data).unwrap();
        assert_eq!(quote.day_stats.change_percent, Some(-10.0));
    }

    #[test]
    fn filters_search_results_to_equities_and_etfs() {
        let data = json!({
            "quotes": [
                { "quoteType": "EQUITY", "symbol": "AAPL", "shortname": "Apple" },
                { "quoteType": "ETF", "symbol": "QQQ", "longname": "Invesco QQQ" },
                { "quoteType": "CRYPTOCURRENCY", "symbol": "BTC-USD", "shortname": "Bitcoin" },
                { "quoteType": "EQUITY", "symbol": "NOS", "shortname": "", "longname": "" }
            ]
        });
        let results = parse_search(&data);
        assert_eq!(results.len(), 3);
        assert_eq!(results[0].name, "Apple");
        assert_eq!(results[1].name, "Invesco QQQ");
        assert_eq!(results[2].name, "NOS");
        assert!(
            results
                .iter()
                .all(|r| r.kind == crypto_stocks_common::types::AssetKind::Stock)
        );
    }

    #[test]
    fn builds_description_fallbacks() {
        let long = parse_description(
            "AAPL",
            &json!({ "quoteSummary": { "result": [{
                "assetProfile": { "longBusinessSummary": "Apple makes phones." }
            }]}}),
        );
        assert_eq!(long.summary, "Apple makes phones.");

        let fund = parse_description(
            "QQQ",
            &json!({ "quoteSummary": { "result": [{
                "fundProfile": { "categoryName": "Large Growth" }
            }]}}),
        );
        assert_eq!(
            fund.summary,
            "QQQ is an exchange-traded fund tracking the Large Growth category."
        );

        let generic = parse_description("XYZ", &json!({ "quoteSummary": { "result": [] } }));
        assert_eq!(
            generic.summary,
            "XYZ is a publicly traded equity or fund. No detailed profile is available from this data source."
        );
    }
}
