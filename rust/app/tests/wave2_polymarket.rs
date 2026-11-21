use std::time::Duration;

use axum::{
    body::Body,
    http::{HeaderMap, Request, StatusCode, header::CACHE_CONTROL},
};
use crypto_stocks_backend::{router, state::AppState};
use crypto_stocks_common::config::{BaseUrls, Config};
use serde_json::Value;
use tower::ServiceExt;
use wiremock::{
    Mock, MockServer, ResponseTemplate,
    matchers::{method, path, query_param},
};

fn test_config(origin: &str) -> Config {
    let urls = BaseUrls {
        polymarket_gamma: format!("{origin}/gamma"),
        polymarket_clob: format!("{origin}/clob"),
        fear_greed: origin.to_owned(),
        google_news: format!("{origin}/rss/search"),
        ..Default::default()
    };

    Config {
        bind_addr: "127.0.0.1:0".parse().unwrap(),
        cors_origins: vec!["http://localhost:3000".into()],
        request_timeout: Duration::from_secs(5),
        upstream_timeout: Duration::from_secs(2),
        retry_max_attempts: 1,
        gemini_api_key: None,
        groq_api_key: None,
        urls,
    }
}

async fn call(uri: &str, config: Config) -> (StatusCode, HeaderMap, Value) {
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

const TOKEN: &str = "16465209773910222414384252480583419176142777026690356950677518532294059732363";

async fn mount_market(upstream: &MockServer) {
    Mock::given(method("GET"))
        .and(path("/gamma/public-search"))
        .and(query_param("limit_per_type", "10"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "events": [{
                "markets": [{
                    "id": "3340215",
                    "question": "Bitcoin Up or Down on August 6?",
                    "slug": "bitcoin-up-or-down-on-august-6-2026",
                    "endDate": "2026-08-06T16:00:00Z",
                    "startDate": "2026-08-04T16:07:09Z",
                    "active": true,
                    "closed": false,
                    "outcomes": "[\"Up\", \"Down\"]",
                    "outcomePrices": "[\"0.705\", \"0.295\"]",
                    "clobTokenIds": [TOKEN, "15358153318025157781697490478466994453906327951735452002768391726210557110820"]
                }]
            }]
        })))
        .mount(upstream)
        .await;

    Mock::given(method("GET"))
        .and(path("/clob/midpoint"))
        .and(query_param("token_id", TOKEN))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(serde_json::json!({ "mid": "0.705" })),
        )
        .mount(upstream)
        .await;
}

#[tokio::test]
async fn crowd_odds_validates_symbol_and_horizon() {
    let upstream = MockServer::start().await;
    let config = test_config(&upstream.uri());

    for uri in [
        "/api/signals/crowd-odds",
        "/api/signals/crowd-odds?symbol=%20%20&horizon=1D",
    ] {
        let (status, _, body) = call(uri, config.clone()).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(body, serde_json::json!({ "error": "Missing symbol" }));
    }

    for uri in [
        "/api/signals/crowd-odds?symbol=btcusdt",
        "/api/signals/crowd-odds?symbol=btcusdt&horizon=5m",
    ] {
        let (status, _, body) = call(uri, config.clone()).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(body, serde_json::json!({ "error": "Invalid horizon" }));
    }
}

#[tokio::test]
async fn crowd_odds_matches_ts_shape_headers_and_probabilities() {
    let upstream = MockServer::start().await;
    mount_market(&upstream).await;

    let (status, headers, body) = call(
        "/api/signals/crowd-odds?symbol=btcusdt&horizon=1D",
        test_config(&upstream.uri()),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        headers[CACHE_CONTROL],
        "public, s-maxage=30, stale-while-revalidate=300"
    );
    assert_eq!(
        body,
        serde_json::json!({
            "market": {
                "id": "3340215",
                "slug": "bitcoin-up-or-down-on-august-6-2026",
                "question": "Bitcoin Up or Down on August 6?",
                "outcomes": ["Up", "Down"],
                "outcomePrices": [0.705, 0.295],
                "clobTokenIds": [TOKEN, "15358153318025157781697490478466994453906327951735452002768391726210557110820"],
                "startDate": "2026-08-04T16:07:09Z",
                "endDate": "2026-08-06T16:00:00Z",
                "active": true,
                "closed": false
            },
            "upProbability": 0.705,
            "downProbability": 0.29500000000000004,
            "endTime": "2026-08-06T16:00:00Z",
            "availableHorizons": ["1D"]
        })
    );
}

#[tokio::test]
async fn crowd_odds_empty_state_matches_ts_when_no_market_is_found() {
    let upstream = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/gamma/public-search"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({ "events": [] })))
        .mount(&upstream)
        .await;

    let (status, _, body) = call(
        "/api/signals/crowd-odds?symbol=DOGEUSDT&horizon=4h",
        test_config(&upstream.uri()),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        body,
        serde_json::json!({
            "market": null,
            "upProbability": 0,
            "downProbability": 0,
            "endTime": "",
            "availableHorizons": []
        })
    );
}
