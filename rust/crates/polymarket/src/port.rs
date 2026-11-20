use std::{
    future::Future,
    pin::Pin,
    sync::{Arc, LazyLock},
    time::Duration,
};

use chrono::{DateTime, Datelike, Offset, Utc};
use chrono_tz::America::New_York;
use crypto_stocks_common::{
    cache::{single_flight, ttl_cache},
    client::{Http, HttpRequest},
    error::Result,
    types::{CrowdOddsHorizon, CrowdOddsSnapshot, PolymarketMarket},
    url::encode_uri_component,
};
use futures::stream::{FuturesUnordered, StreamExt};
use moka::future::Cache;
use regex::Regex;
use serde_json::Value;

pub const CROWD_ODDS_HORIZONS: [CrowdOddsHorizon; 3] = [
    CrowdOddsHorizon::FourHours,
    CrowdOddsHorizon::OneDay,
    CrowdOddsHorizon::OneWeek,
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PolymarketAssetSpec {
    pub symbol: String,
    pub short: String,
    pub name: String,
    pub search: String,
}

fn spec(symbol: &str, short: &str, name: &str, search: &str) -> PolymarketAssetSpec {
    PolymarketAssetSpec {
        symbol: symbol.into(),
        short: short.into(),
        name: name.into(),
        search: search.into(),
    }
}

/// Curated discovery specs for the majors that carry up/down markets.
pub fn curated_spec(symbol: &str) -> Option<PolymarketAssetSpec> {
    Some(match symbol {
        "BTCUSDT" => spec("BTCUSDT", "btc", "bitcoin", "bitcoin up or down"),
        "ETHUSDT" => spec("ETHUSDT", "eth", "ethereum", "ethereum up or down"),
        "SOLUSDT" => spec("SOLUSDT", "sol", "solana", "solana up or down"),
        "XRPUSDT" => spec("XRPUSDT", "xrp", "xrp", "xrp up or down"),
        "DOGEUSDT" => spec("DOGEUSDT", "doge", "dogecoin", "dogecoin up or down"),
        "BNBUSDT" => spec("BNBUSDT", "bnb", "bnb", "bnb up or down"),
        _ => return None,
    })
}

#[derive(Debug, Clone, Default)]
pub struct PerHorizonMarkets {
    pub four_hours: Option<PolymarketMarket>,
    pub one_day: Option<PolymarketMarket>,
    pub one_week: Option<PolymarketMarket>,
}

impl PerHorizonMarkets {
    pub fn get(&self, horizon: CrowdOddsHorizon) -> Option<&PolymarketMarket> {
        match horizon {
            CrowdOddsHorizon::FourHours => self.four_hours.as_ref(),
            CrowdOddsHorizon::OneDay => self.one_day.as_ref(),
            CrowdOddsHorizon::OneWeek => self.one_week.as_ref(),
        }
    }

    fn set(&mut self, horizon: CrowdOddsHorizon, market: Option<PolymarketMarket>) {
        match horizon {
            CrowdOddsHorizon::FourHours => self.four_hours = market,
            CrowdOddsHorizon::OneDay => self.one_day = market,
            CrowdOddsHorizon::OneWeek => self.one_week = market,
        }
    }
}

fn decode_array(value: Option<&Value>) -> Vec<Value> {
    match value {
        Some(Value::String(text)) => match serde_json::from_str::<Value>(text) {
            Ok(parsed) if parsed.is_array() => parsed.as_array().cloned().unwrap_or_default(),
            _ => vec![],
        },
        Some(Value::Array(items)) => items.clone(),
        _ => vec![],
    }
}

fn js_string(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        Value::Number(number) => number.to_string(),
        Value::Bool(boolean) => boolean.to_string(),
        Value::Null => "null".into(),
        other => other.to_string(),
    }
}

/// Mirrors the TS `toNumber`: finite numbers and numeric strings only.
fn to_number(value: Option<&Value>) -> Option<f64> {
    match value {
        Some(Value::Number(number)) => number.as_f64().filter(|n| n.is_finite()),
        Some(Value::String(text)) => text.trim().parse::<f64>().ok().filter(|n| n.is_finite()),
        _ => None,
    }
}

/// Port of `parsePolymarketMarket`, with the exact TS error text.
pub fn parse_polymarket_market(json: &Value) -> Result<PolymarketMarket> {
    if !json.is_object() {
        return Err(crypto_stocks_common::error::Error::Parse(
            "Polymarket market record missing".into(),
        ));
    }

    let slug = json
        .get("slug")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_owned();
    if slug.is_empty() {
        return Err(crypto_stocks_common::error::Error::Parse(
            "Polymarket market record missing slug".into(),
        ));
    }

    let outcomes = decode_array(json.get("outcomes"))
        .iter()
        .map(js_string)
        .collect::<Vec<_>>();
    if outcomes.is_empty() {
        return Err(crypto_stocks_common::error::Error::Parse(
            "Polymarket market record missing outcomes".into(),
        ));
    }

    let outcome_prices = decode_array(json.get("outcomePrices"))
        .iter()
        .filter_map(|value| to_number(Some(value)))
        .collect::<Vec<_>>();
    if outcome_prices.len() < outcomes.len() {
        return Err(crypto_stocks_common::error::Error::Parse(
            "Polymarket market record missing outcome prices".into(),
        ));
    }

    let clob_token_ids = decode_array(json.get("clobTokenIds"))
        .iter()
        .map(js_string)
        .collect::<Vec<_>>();
    if clob_token_ids.len() < 2 {
        return Err(crypto_stocks_common::error::Error::Parse(
            "Polymarket market record missing clob token ids".into(),
        ));
    }

    Ok(PolymarketMarket {
        id: json
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_owned(),
        slug,
        question: json
            .get("question")
            .and_then(Value::as_str)
            .map(str::to_owned)
            .unwrap_or_else(|| {
                json.get("slug")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_owned()
            }),
        outcomes,
        outcome_prices,
        clob_token_ids,
        start_date: json
            .get("startDate")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_owned(),
        end_date: json
            .get("endDate")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_owned(),
        active: json.get("active") == Some(&Value::Bool(true)),
        closed: json.get("closed") == Some(&Value::Bool(true)),
    })
}

static HORIZON_PATTERNS: LazyLock<[(CrowdOddsHorizon, Regex); 3]> = LazyLock::new(|| {
    [
        (
            CrowdOddsHorizon::FourHours,
            Regex::new("(?i)updown-4h-").unwrap(),
        ),
        (
            CrowdOddsHorizon::OneDay,
            Regex::new("(?i)-up-or-down-on-").unwrap(),
        ),
        (
            CrowdOddsHorizon::OneWeek,
            Regex::new("(?i)up-or-down-(this-)?week").unwrap(),
        ),
    ]
});

pub fn horizon_for_slug(slug: &str) -> Option<CrowdOddsHorizon> {
    HORIZON_PATTERNS
        .iter()
        .find_map(|(horizon, pattern)| pattern.is_match(slug).then_some(*horizon))
}

fn is_open(market: &PolymarketMarket) -> bool {
    market.active && !market.closed
}

fn end_time_ms(market: &PolymarketMarket) -> i64 {
    DateTime::parse_from_rfc3339(&market.end_date)
        .map(|date| date.timestamp_millis())
        .unwrap_or(i64::MAX)
}

pub fn select_nearest_market(markets: &[PolymarketMarket]) -> Option<PolymarketMarket> {
    let mut open = markets
        .iter()
        .filter(|market| is_open(market))
        .collect::<Vec<_>>();
    open.sort_by_key(|market| end_time_ms(market));
    open.first().map(|market| (*market).clone())
}

pub fn up_outcome_index(outcomes: &[String]) -> usize {
    outcomes
        .iter()
        .position(|outcome| {
            let lower = outcome.trim().to_lowercase();
            lower == "up" || lower == "yes"
        })
        .unwrap_or(0)
}

pub fn parse_midpoint(json: &Value) -> Option<f64> {
    if !json.is_object() {
        return None;
    }
    let value = to_number(json.get("mid"))?;
    (0.0..=1.0).contains(&value).then_some(value)
}

fn et_offset_hours(seconds: i64) -> f64 {
    let instant = DateTime::<Utc>::from_timestamp(seconds, 0)
        .unwrap_or_default()
        .with_timezone(&New_York);
    instant.offset().fix().local_minus_utc() as f64 / 3600.0
}

fn et_date_parts(seconds: i64) -> (String, String, String) {
    let instant = DateTime::<Utc>::from_timestamp(seconds, 0)
        .unwrap_or_default()
        .with_timezone(&New_York);
    (
        instant.format("%B").to_string().to_lowercase(),
        instant.day().to_string(),
        instant.year().to_string(),
    )
}

const HOUR_4_SECONDS: f64 = 4.0 * 3600.0;
const DAY_SECONDS: i64 = 86_400;

pub fn four_hour_slugs(asset: &PolymarketAssetSpec, now: i64) -> Vec<String> {
    let offset = et_offset_hours(now);
    let now_et = now as f64 + offset * 3600.0;
    let current_start_et = (now_et / HOUR_4_SECONDS).floor() * HOUR_4_SECONDS;
    (0..3)
        .map(|step| {
            let start_utc = current_start_et + step as f64 * HOUR_4_SECONDS - offset * 3600.0;
            format!("{}-updown-4h-{}", asset.short, start_utc.round() as i64)
        })
        .collect()
}

pub fn daily_slugs(asset: &PolymarketAssetSpec, now: i64) -> Vec<String> {
    (0..3)
        .map(|day| {
            let (month, day_number, year) = et_date_parts(now + day * DAY_SECONDS);
            format!(
                "{}-up-or-down-on-{}-{}-{}",
                asset.name, month, day_number, year
            )
        })
        .collect()
}

pub fn weekly_slugs(asset: &PolymarketAssetSpec) -> Vec<String> {
    vec![format!("{}-up-or-down-this-week", asset.name)]
}

pub fn candidate_slugs(
    asset: &PolymarketAssetSpec,
    horizon: CrowdOddsHorizon,
    now: i64,
) -> Vec<String> {
    match horizon {
        CrowdOddsHorizon::FourHours => four_hour_slugs(asset, now),
        CrowdOddsHorizon::OneDay => daily_slugs(asset, now),
        CrowdOddsHorizon::OneWeek => weekly_slugs(asset),
    }
}

fn make_fallback_spec(symbol: &str) -> PolymarketAssetSpec {
    let upper = symbol.to_uppercase();
    let base = ["USDT", "USDC", "BUSD"]
        .iter()
        .find_map(|suffix| {
            upper
                .strip_suffix(suffix)
                .map(|_| &symbol[..symbol.len() - suffix.len()])
        })
        .filter(|base| !base.is_empty())
        .unwrap_or(symbol)
        .to_lowercase();
    spec(symbol, &base, &base, &format!("{base} up or down"))
}

enum Discovery {
    Curated(Vec<PolymarketMarket>),
    Generic(Vec<PolymarketMarket>),
}

/// Fetcher with a short discovery cache and single-flight deduplication. All
/// slug lookups and the generic search are fired concurrently via
/// `FuturesUnordered`, replacing the TS sequential sweep.
#[derive(Clone)]
pub struct PolymarketService {
    http: Arc<Http>,
    gamma: String,
    clob: String,
    discovery: Cache<String, PerHorizonMarkets>,
    midpoints: Cache<String, f64>,
}

impl PolymarketService {
    pub fn new(http: Arc<Http>, gamma: String, clob: String) -> Self {
        Self {
            http,
            gamma,
            clob,
            discovery: ttl_cache(Duration::from_secs(20), 256),
            midpoints: ttl_cache(Duration::from_secs(5), 1024),
        }
    }

    async fn fetch_json(&self, url: String) -> Result<Value> {
        let request = HttpRequest::get(url)?.header("User-Agent", "crypto-stocks/1.0")?;
        self.http.json_checked(&request, "Polymarket").await
    }

    async fn fetch_markets_by_slug(&self, slug: String) -> Vec<PolymarketMarket> {
        let url = format!(
            "{}/markets?slug={}",
            self.gamma,
            encode_uri_component(&slug)
        );
        match self.fetch_json(url).await {
            Ok(Value::Array(items)) => items
                .iter()
                .filter_map(|raw| parse_polymarket_market(raw).ok())
                .collect(),
            _ => vec![],
        }
    }

    async fn search_up_down_markets(&self, query: String) -> Vec<PolymarketMarket> {
        let url = format!(
            "{}/public-search?q={}&limit_per_type=10",
            self.gamma,
            encode_uri_component(&query)
        );
        let Ok(json) = self.fetch_json(url).await else {
            return vec![];
        };
        let Some(events) = json.get("events").and_then(Value::as_array) else {
            return vec![];
        };
        events
            .iter()
            .filter_map(|event| event.get("markets").and_then(Value::as_array))
            .flatten()
            .filter_map(|raw| parse_polymarket_market(raw).ok())
            .filter(is_open)
            .collect()
    }

    async fn discover(&self, symbol: &str, now: i64) -> Result<PerHorizonMarkets> {
        let curated = curated_spec(symbol);
        let asset = curated
            .clone()
            .unwrap_or_else(|| make_fallback_spec(symbol));

        let mut tasks: FuturesUnordered<Pin<Box<dyn Future<Output = Discovery> + Send + '_>>> =
            FuturesUnordered::new();
        if curated.is_some() {
            for horizon in CROWD_ODDS_HORIZONS {
                for slug in candidate_slugs(&asset, horizon, now) {
                    tasks.push(Box::pin(async move {
                        Discovery::Curated(self.fetch_markets_by_slug(slug).await)
                    }));
                }
            }
        }
        let search = asset.search.clone();
        tasks.push(Box::pin(async move {
            Discovery::Generic(self.search_up_down_markets(search).await)
        }));

        let mut discovered = Vec::new();
        let mut generic = Vec::new();
        while let Some(result) = tasks.next().await {
            match result {
                Discovery::Curated(markets) => discovered.extend(markets),
                Discovery::Generic(markets) => generic.extend(markets),
            }
        }

        let mut result = PerHorizonMarkets::default();
        for horizon in CROWD_ODDS_HORIZONS {
            let candidates = discovered
                .iter()
                .filter(|market| horizon_for_slug(&market.slug) == Some(horizon))
                .cloned()
                .collect::<Vec<_>>();
            result.set(horizon, select_nearest_market(&candidates));
        }
        for horizon in CROWD_ODDS_HORIZONS {
            if result.get(horizon).is_none() {
                let candidates = generic
                    .iter()
                    .filter(|market| horizon_for_slug(&market.slug) == Some(horizon))
                    .cloned()
                    .collect::<Vec<_>>();
                result.set(horizon, select_nearest_market(&candidates));
            }
        }
        Ok(result)
    }

    pub async fn discover_up_down_markets(
        &self,
        symbol: &str,
        now: i64,
    ) -> Result<PerHorizonMarkets> {
        let http_key = symbol.to_owned();
        let this = self.clone();
        single_flight(&self.discovery, http_key, || async move {
            this.discover(symbol, now).await
        })
        .await
        .map_err(|error| (*error).clone())
    }

    async fn fetch_up_midpoint(&self, market: &PolymarketMarket) -> Option<f64> {
        let index = up_outcome_index(&market.outcomes);
        let token = market.clob_token_ids.get(index)?;
        if token.is_empty() {
            return None;
        }
        let key = token.clone();
        let http = self.http.clone();
        let clob = self.clob.clone();
        let cached = single_flight(&self.midpoints, key, || async move {
            let url = format!("{clob}/midpoint?token_id={}", encode_uri_component(token));
            let request = HttpRequest::get(url)?.header("User-Agent", "crypto-stocks/1.0")?;
            let json = http.json_checked(&request, "Polymarket").await?;
            Ok(parse_midpoint(&json).unwrap_or(0.0))
        })
        .await;
        cached.ok()
    }

    pub async fn fetch_crowd_odds(
        &self,
        symbol: &str,
        horizon: CrowdOddsHorizon,
        now: i64,
    ) -> Result<CrowdOddsSnapshot> {
        let per_horizon = self.discover_up_down_markets(symbol, now).await?;
        let available_horizons = CROWD_ODDS_HORIZONS
            .iter()
            .copied()
            .filter(|candidate| per_horizon.get(*candidate).is_some())
            .collect::<Vec<_>>();

        let Some(market) = per_horizon.get(horizon).cloned() else {
            return Ok(CrowdOddsSnapshot {
                market: None,
                up_probability: 0.0,
                down_probability: 0.0,
                end_time: String::new(),
                available_horizons,
            });
        };

        let up_index = up_outcome_index(&market.outcomes);
        let midpoint = self.fetch_up_midpoint(&market).await;
        let up = midpoint
            .or_else(|| market.outcome_prices.get(up_index).copied())
            .unwrap_or(0.0)
            .clamp(0.0, 1.0);

        Ok(CrowdOddsSnapshot {
            market: Some(market.clone()),
            up_probability: up,
            down_probability: (1.0 - up).clamp(0.0, 1.0),
            end_time: market.end_date,
            available_horizons,
        })
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn btc_4h() -> Value {
        json!({
            "id": "3346519",
            "question": "Bitcoin Up or Down - August 5, 4:00PM-8:00PM ET",
            "slug": "btc-updown-4h-1785960000",
            "endDate": "2026-08-06T00:00:00Z",
            "startDate": "2026-08-04T20:07:34.802349Z",
            "active": true,
            "closed": false,
            "outcomes": "[\"Up\", \"Down\"]",
            "outcomePrices": "[\"0.505\", \"0.495\"]",
            "clobTokenIds": "[\"10360615685715835102052505712716928482293991285244385425471576343469847481741\", \"40181910861246356970463709176007519371839958130956661754177947848998648061933\"]"
        })
    }

    fn btc_daily() -> Value {
        json!({
            "id": "3340215",
            "question": "Bitcoin Up or Down on August 6?",
            "slug": "bitcoin-up-or-down-on-august-6-2026",
            "endDate": "2026-08-06T16:00:00Z",
            "startDate": "2026-08-04T16:07:09Z",
            "active": true,
            "closed": false,
            "outcomes": "[\"Up\", \"Down\"]",
            "outcomePrices": "[\"0.705\", \"0.295\"]",
            "clobTokenIds": [
                "16465209773910222414384252480583419176142777026690356950677518532294059732363",
                "15358153318025157781697490478466994453906327951735452002768391726210557110820"
            ]
        })
    }

    const FIXED_NOW: i64 = 1_785_959_100; // 2026-08-05T19:45:00Z

    #[test]
    fn decodes_the_double_encoded_4h_fixture() {
        let market = parse_polymarket_market(&btc_4h()).unwrap();
        assert_eq!(market.slug, "btc-updown-4h-1785960000");
        assert_eq!(market.outcomes, ["Up", "Down"]);
        assert_eq!(market.outcome_prices, [0.505, 0.495]);
        assert_eq!(market.clob_token_ids.len(), 2);
        assert!(market.clob_token_ids[0].len() >= 70);
        assert_eq!(market.end_date, "2026-08-06T00:00:00Z");
        assert!(market.active);
        assert!(!market.closed);
    }

    #[test]
    fn decodes_native_arrays_in_a_daily_fixture() {
        let market = parse_polymarket_market(&btc_daily()).unwrap();
        assert_eq!(market.outcomes, ["Up", "Down"]);
        assert_eq!(market.outcome_prices, [0.705, 0.295]);
        assert_eq!(market.clob_token_ids.len(), 2);
        assert_eq!(market.end_date, "2026-08-06T16:00:00Z");
    }

    #[test]
    fn rejects_records_without_outcomes_or_slug() {
        let error = parse_polymarket_market(&json!({
            "slug": "btc-updown-4h-1785960000",
            "outcomePrices": "[\"0.5\", \"0.5\"]"
        }))
        .unwrap_err();
        assert!(error.to_string().contains("missing outcomes"));

        let error =
            parse_polymarket_market(&json!({ "outcomes": "[\"Up\", \"Down\"]" })).unwrap_err();
        assert!(error.to_string().contains("missing slug"));
    }

    #[test]
    fn classifies_the_three_horizon_families() {
        assert_eq!(
            horizon_for_slug("btc-updown-4h-1785960000"),
            Some(CrowdOddsHorizon::FourHours)
        );
        assert_eq!(
            horizon_for_slug("bitcoin-up-or-down-on-august-6-2026"),
            Some(CrowdOddsHorizon::OneDay)
        );
        assert_eq!(
            horizon_for_slug("bitcoin-up-or-down-this-week"),
            Some(CrowdOddsHorizon::OneWeek)
        );
    }

    #[test]
    fn ignores_cadences_outside_the_widget() {
        assert_eq!(horizon_for_slug("btc-updown-5m-1775181000"), None);
        assert_eq!(horizon_for_slug("eth-updown-15m-1786044600"), None);
        assert_eq!(
            horizon_for_slug("bitcoin-up-or-down-february-23-12pm-et"),
            None
        );
    }

    #[test]
    fn maps_every_curated_major() {
        assert_eq!(curated_spec("BTCUSDT").unwrap().short, "btc");
        assert_eq!(curated_spec("BTCUSDT").unwrap().name, "bitcoin");
        assert_eq!(curated_spec("ETHUSDT").unwrap().name, "ethereum");
        assert_eq!(curated_spec("SOLUSDT").unwrap().short, "sol");
        assert_eq!(curated_spec("XRPUSDT").unwrap().name, "xrp");
        assert_eq!(curated_spec("DOGEUSDT").unwrap().short, "doge");
        assert_eq!(curated_spec("BNBUSDT").unwrap().name, "bnb");
    }

    #[test]
    fn selects_the_nearest_open_market_and_ignores_closed() {
        let market = parse_polymarket_market(&btc_4h()).unwrap();
        let daily = parse_polymarket_market(&btc_daily()).unwrap();
        assert_eq!(
            select_nearest_market(&[daily.clone(), market.clone()])
                .unwrap()
                .slug,
            "btc-updown-4h-1785960000"
        );

        let closed_json = json!({
            "slug": "btc-updown-4h-1785974400",
            "outcomes": "[\"Up\", \"Down\"]",
            "outcomePrices": "[\"0.5\", \"0.5\"]",
            "clobTokenIds": "[\"1\", \"2\"]",
            "active": true,
            "closed": true,
            "endDate": "2026-08-05T23:00:00Z"
        });
        let closed = parse_polymarket_market(&closed_json).unwrap();
        assert!(select_nearest_market(std::slice::from_ref(&closed)).is_none());
        assert_eq!(
            select_nearest_market(&[market, closed]).unwrap().slug,
            "btc-updown-4h-1785960000"
        );
        assert!(select_nearest_market(&[]).is_none());
    }

    #[test]
    fn finds_the_up_outcome_index() {
        assert_eq!(up_outcome_index(&["Up".into(), "Down".into()]), 0);
        assert_eq!(up_outcome_index(&["Down".into(), "Up".into()]), 1);
        assert_eq!(up_outcome_index(&["Yes".into(), "No".into()]), 0);
        assert_eq!(up_outcome_index(&["Heads".into(), "Tails".into()]), 0);
    }

    #[test]
    fn parses_and_validates_midpoints() {
        assert_eq!(parse_midpoint(&json!({ "mid": "0.705" })), Some(0.705));
        assert_eq!(parse_midpoint(&json!({})), None);
        assert_eq!(parse_midpoint(&json!({ "mid": "oops" })), None);
        assert_eq!(parse_midpoint(&json!({ "mid": "1.4" })), None);
        assert_eq!(parse_midpoint(&Value::Null), None);
    }

    #[test]
    fn builds_four_hour_slugs_for_the_et_window() {
        let slugs = four_hour_slugs(&curated_spec("BTCUSDT").unwrap(), FIXED_NOW);
        assert_eq!(
            slugs,
            [
                "btc-updown-4h-1785945600",
                "btc-updown-4h-1785960000",
                "btc-updown-4h-1785974400"
            ]
        );
    }

    #[test]
    fn builds_daily_slugs_for_the_next_three_et_dates() {
        let slugs = daily_slugs(&curated_spec("BTCUSDT").unwrap(), FIXED_NOW);
        assert_eq!(
            slugs,
            [
                "bitcoin-up-or-down-on-august-5-2026",
                "bitcoin-up-or-down-on-august-6-2026",
                "bitcoin-up-or-down-on-august-7-2026"
            ]
        );
    }
}
