use std::{sync::Arc, time::Duration};

use crypto_stocks_common::{
    cache::{single_flight, ttl_cache},
    client::{Http, HttpRequest},
    error::{Error, Result},
    types::FearGreedIndex,
};
use moka::future::Cache;
use serde_json::Value;

/// Mirrors the TS `toNumber`: null/undefined -> null, non-finite -> null,
/// strings are trimmed (JS `Number(" 27 ")` is 27, `Number("")` is 0).
fn to_number(value: Option<&Value>) -> Option<f64> {
    match value? {
        Value::Null => None,
        Value::Number(number) => number.as_f64().filter(|n| n.is_finite()),
        Value::String(text) => {
            let text = text.trim();
            if text.is_empty() {
                Some(0.0)
            } else {
                text.parse::<f64>().ok().filter(|n| n.is_finite())
            }
        }
        _ => None,
    }
}

/// Port of `parseFearGreedIndex`, including the exact error text.
pub fn parse_fear_greed_index(json: &Value) -> Result<FearGreedIndex> {
    let record = json
        .get("data")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .ok_or_else(|| Error::Parse("Fear & Greed response missing data".into()))?;

    let value = to_number(record.get("value"))
        .ok_or_else(|| Error::Parse("Fear & Greed response missing value".into()))?;

    Ok(FearGreedIndex {
        value,
        classification: record
            .get("value_classification")
            .and_then(Value::as_str)
            .unwrap_or("Unknown")
            .to_owned(),
        timestamp: to_number(record.get("timestamp")).unwrap_or(0.0),
        time_until_update: to_number(record.get("time_until_update")).unwrap_or(0.0),
    })
}

/// Fetcher with a 1 h TTL and single-flight deduplication. The TS module was
/// stateless; the TTL is added per the migration requirements and matches the
/// route's existing `s-maxage=3600` cache header.
pub struct FearGreedService {
    http: Arc<Http>,
    base: String,
    cache: Cache<&'static str, FearGreedIndex>,
}

impl FearGreedService {
    pub fn new(http: Arc<Http>, base: String) -> Self {
        Self {
            http,
            base,
            cache: ttl_cache(Duration::from_secs(3600), 16),
        }
    }

    pub async fn fetch(&self) -> Result<FearGreedIndex> {
        let http = self.http.clone();
        let base = self.base.clone();
        single_flight(&self.cache, "latest", || async move {
            let request = HttpRequest::get(format!("{base}/?limit=1"))?;
            let json: Value = http.json_checked(&request, "Fear & Greed").await?;
            parse_fear_greed_index(&json)
        })
        .await
        .map_err(|error| (*error).clone())
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    // Captured from api.alternative.me/fng/?limit=1 (Aug 2026).
    fn fixture() -> Value {
        json!({
            "name": "Fear and Greed Index",
            "data": [{
                "value": "27",
                "value_classification": "Fear",
                "timestamp": "1785888000",
                "time_until_update": "15580"
            }],
            "metadata": { "error": null }
        })
    }

    #[test]
    fn parses_the_real_fixture() {
        let index = parse_fear_greed_index(&fixture()).unwrap();
        assert_eq!(index.value, 27.0);
        assert_eq!(index.classification, "Fear");
        assert_eq!(index.timestamp, 1_785_888_000.0);
        assert_eq!(index.time_until_update, 15_580.0);
    }

    #[test]
    fn serialised_shape_matches_the_ts_route() {
        let value = serde_json::to_value(parse_fear_greed_index(&fixture()).unwrap()).unwrap();
        let object = value.as_object().unwrap();
        assert_eq!(object.len(), 4);
        assert_eq!(object["value"].as_f64(), Some(27.0));
        assert_eq!(object["classification"], "Fear");
        assert_eq!(object["timestamp"].as_f64(), Some(1_785_888_000.0));
        assert_eq!(object["timeUntilUpdate"].as_f64(), Some(15_580.0));
    }

    #[test]
    fn throws_when_the_response_has_no_data() {
        let error = parse_fear_greed_index(&json!({ "name": "Fear and Greed Index", "data": [] }))
            .unwrap_err();
        assert_eq!(error.to_string(), "Fear & Greed response missing data");
    }

    #[test]
    fn throws_when_the_value_is_missing() {
        let error = parse_fear_greed_index(&json!({
            "data": [{ "value_classification": "Fear" }]
        }))
        .unwrap_err();
        assert_eq!(error.to_string(), "Fear & Greed response missing value");
    }

    #[test]
    fn coerces_numeric_and_missing_fields_like_js_number() {
        let index = parse_fear_greed_index(&json!({
            "data": [{ "value": 42, "value_classification": 7, "timestamp": "nope" }]
        }))
        .unwrap();
        assert_eq!(index.value, 42.0);
        assert_eq!(index.classification, "Unknown");
        assert_eq!(index.timestamp, 0.0);
        assert_eq!(index.time_until_update, 0.0);
    }
}
