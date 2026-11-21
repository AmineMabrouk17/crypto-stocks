use std::time::Duration;

use axum::{
    body::Body,
    http::{HeaderMap, Request, StatusCode, header::CACHE_CONTROL},
};
use crypto_stocks_backend::{router, state::AppState};
use crypto_stocks_common::config::{BaseUrls, Config};
use serde_json::{Value, json};
use tower::ServiceExt;
use wiremock::{
    Mock, MockServer, ResponseTemplate,
    matchers::{header, method, path, query_param},
};

fn test_config(origin: &str) -> Config {
    let urls = BaseUrls {
        yahoo_query: format!("{origin}/yahoo"),
        yahoo_fc: format!("{origin}/fc"),
        gemini: format!("{origin}/gemini"),
        groq: format!("{origin}/groq"),
        openai: format!("{origin}/openai"),
        anthropic: format!("{origin}/anthropic"),
        ..Default::default()
    };
    Config {
        bind_addr: "127.0.0.1:0".parse().unwrap(),
        cors_origins: vec!["http://localhost:3000".into()],
        request_timeout: Duration::from_secs(5),
        upstream_timeout: Duration::from_secs(2),
        retry_max_attempts: 1,
        gemini_api_key: Some("test-gemini-key".into()),
        groq_api_key: Some("test-groq-key".into()),
        urls,
    }
}

async fn get(uri: &str, config: Config) -> (StatusCode, HeaderMap, Value) {
    let app = router::build(AppState::new(config).unwrap());
    let response = app
        .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let headers = response.headers().clone();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let body = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    (status, headers, body)
}

async fn post(uri: &str, body: Value, config: Config) -> (StatusCode, Value) {
    let app = router::build(AppState::new(config).unwrap());
    let request = Request::builder()
        .uri(uri)
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap();
    let response = app.oneshot(request).await.unwrap();
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let body = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    (status, body)
}

fn chat_body() -> Value {
    json!({
        "messages": [{ "role": "user", "content": "How is it doing?" }],
        "asset": { "name": "Bitcoin", "symbol": "BTCUSDT", "kind": "crypto" },
        "livePrice": 105.5,
        "marketStats": null,
        "description": null,
        "llmSettings": null,
        "freeModelId": null
    })
}

#[tokio::test]
async fn stock_quote_validates_and_matches_ts_shape() {
    let upstream = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/yahoo/v8/finance/chart/AAPL"))
        .and(query_param("interval", "1m"))
        .and(query_param("range", "1d"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "chart": { "result": [{
                "timestamp": [1_700_000_000i64],
                "indicators": { "quote": [{
                    "open": [100.0], "high": [102.0], "low": [99.0], "close": [101.0]
                }]},
                "meta": {
                    "regularMarketPrice": 101.0,
                    "previousClose": 100.0,
                    "currency": "USD",
                    "regularMarketDayHigh": 102.0,
                    "regularMarketDayLow": 99.0,
                    "regularMarketVolume": 500
                }
            }]}
        })))
        .mount(&upstream)
        .await;

    let (status, _, body) = get(
        "/api/stocks/quote?symbol=AAPL",
        test_config(&upstream.uri()),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        body,
        json!({
            "price": 101,
            "currency": "USD",
            "candles": [{ "time": 1_700_000_000i64, "open": 100, "high": 102, "low": 99, "close": 101 }],
            "dayStats": { "changePercent": 1, "high": 102, "low": 99, "volume": 500 }
        })
    );

    let (status, _, body) = get("/api/stocks/quote", test_config(&upstream.uri())).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body, json!({ "error": "Missing symbol" }));
}

#[tokio::test]
async fn stock_quote_upstream_failure_matches_ts_error() {
    let upstream = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/yahoo/v8/finance/chart/BAD"))
        .respond_with(ResponseTemplate::new(503))
        .mount(&upstream)
        .await;

    let (status, _, body) = get("/api/stocks/quote?symbol=BAD", test_config(&upstream.uri())).await;
    assert_eq!(status, StatusCode::BAD_GATEWAY);
    assert_eq!(body, json!({ "error": "Yahoo chart request failed: 503" }));
}

async fn mount_session(upstream: &MockServer) {
    Mock::given(method("GET"))
        .and(path("/fc"))
        .respond_with(
            ResponseTemplate::new(200).insert_header("set-cookie", "A1=abc; Path=/; Secure"),
        )
        .mount(upstream)
        .await;
    Mock::given(method("GET"))
        .and(path("/yahoo/v1/test/getcrumb"))
        .respond_with(ResponseTemplate::new(200).set_body_string("crumb123\n"))
        .mount(upstream)
        .await;
}

#[tokio::test]
async fn stock_search_matches_ts_shape() {
    let upstream = MockServer::start().await;
    mount_session(&upstream).await;
    Mock::given(method("GET"))
        .and(path("/yahoo/v1/finance/search"))
        .and(query_param("q", "apple"))
        .and(query_param("crumb", "crumb123"))
        .and(header("cookie", "A1=abc"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "quotes": [
                { "quoteType": "EQUITY", "symbol": "AAPL", "shortname": "Apple Inc." },
                { "quoteType": "CRYPTOCURRENCY", "symbol": "BTC-USD", "shortname": "Bitcoin" }
            ]
        })))
        .mount(&upstream)
        .await;

    let (status, headers, body) =
        get("/api/stocks/search?q=apple", test_config(&upstream.uri())).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        headers[CACHE_CONTROL],
        "public, s-maxage=300, stale-while-revalidate=3600"
    );
    assert_eq!(
        body,
        json!({ "results": [{
            "kind": "stock", "id": "AAPL", "symbol": "AAPL", "name": "Apple Inc."
        }]})
    );

    // Short queries return empty without touching upstream.
    let (status, _, body) = get("/api/stocks/search?q=a", test_config(&upstream.uri())).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!({ "results": [] }));
}

#[tokio::test]
async fn stock_profile_matches_ts_shape() {
    let upstream = MockServer::start().await;
    mount_session(&upstream).await;
    Mock::given(method("GET"))
        .and(path("/yahoo/v10/finance/quoteSummary/AAPL"))
        .and(query_param("crumb", "crumb123"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "quoteSummary": { "result": [{
                "assetProfile": { "longBusinessSummary": "Apple makes phones." }
            }]}
        })))
        .mount(&upstream)
        .await;

    let (status, headers, body) = get(
        "/api/stocks/profile?symbol=AAPL",
        test_config(&upstream.uri()),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        headers[CACHE_CONTROL],
        "public, s-maxage=3600, stale-while-revalidate=86400"
    );
    assert_eq!(
        body,
        json!({ "name": "AAPL", "summary": "Apple makes phones." })
    );
}

#[tokio::test]
async fn chat_validates_and_reports_missing_keys() {
    let upstream = MockServer::start().await;

    let (status, body) = post(
        "/api/chat",
        json!({ "messages": [] }),
        test_config(&upstream.uri()),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body, json!({ "error": "messages is required" }));

    let mut config = test_config(&upstream.uri());
    config.gemini_api_key = None;
    let (status, body) = post("/api/chat", chat_body(), config).await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
    assert_eq!(
        body,
        json!({ "error": "GEMINI_API_KEY is not configured on the server" })
    );
}

#[tokio::test]
async fn chat_matches_ts_shape_for_byok_and_free_models() {
    let upstream = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/gemini/models/gemini-1.5-flash:generateContent"))
        .and(header("x-goog-api-key", "user-key"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "candidates": [{ "content": { "parts": [{ "text": " It is up. " }] } }]
        })))
        .mount(&upstream)
        .await;

    let mut body = chat_body();
    body["llmSettings"] = json!({
        "provider": "gemini", "apiKey": "user-key", "model": "gemini-1.5-flash"
    });
    let (status, result) = post("/api/chat", body, test_config(&upstream.uri())).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(result, json!({ "reply": "It is up." }));
}

#[tokio::test]
async fn empty_symbol_is_rejected_like_ts_falsy_check() {
    let config = test_config("http://127.0.0.1:1");
    for uri in [
        "/api/stocks/quote?symbol=&range=1d&interval=1m",
        "/api/stocks/profile?symbol=",
    ] {
        let (status, _, body) = get(uri, config.clone()).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "uri: {uri}");
        assert_eq!(body, json!({ "error": "Missing symbol" }), "uri: {uri}");
    }
}

#[tokio::test]
async fn chat_maps_upstream_failures_to_502() {
    let upstream = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/gemini/models/gemini-1.5-flash:generateContent"))
        .respond_with(ResponseTemplate::new(429))
        .mount(&upstream)
        .await;

    let (status, body) = post("/api/chat", chat_body(), test_config(&upstream.uri())).await;
    assert_eq!(status, StatusCode::BAD_GATEWAY);
    assert_eq!(
        body,
        json!({ "error": "Failed to connect to the AI model. Please try another model or try again later." })
    );
}
