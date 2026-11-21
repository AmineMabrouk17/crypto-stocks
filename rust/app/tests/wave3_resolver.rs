use std::time::Duration;

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use crypto_stocks_backend::{router, state::AppState};
use crypto_stocks_common::config::{BaseUrls, Config};
use serde_json::{Value, json};
use tower::ServiceExt;
use wiremock::{
    Mock, MockServer, ResponseTemplate,
    matchers::{method, path, query_param},
};

fn test_config(origin: &str) -> Config {
    let urls = BaseUrls {
        coingecko: format!("{origin}/coingecko"),
        yahoo_query: format!("{origin}/yahoo"),
        yahoo_fc: format!("{origin}/fc"),
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

async fn resolve(uri: &str, config: Config) -> (StatusCode, Value) {
    let app = router::build(AppState::new(config).unwrap());
    let response = app
        .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

async fn mount_coin_description(upstream: &MockServer, id: &str, name: &str, summary: &str) {
    Mock::given(method("GET"))
        .and(path(format!("/coingecko/coins/{id}")))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "name": name,
            "description": { "en": summary }
        })))
        .mount(upstream)
        .await;
}

#[tokio::test]
async fn resolves_a_known_crypto_without_list_lookup() {
    let upstream = MockServer::start().await;
    mount_coin_description(&upstream, "bitcoin", "Bitcoin", "Digital cash.").await;

    let (status, body) = resolve(
        "/api/assets/resolve?symbol=btcusdt",
        test_config(&upstream.uri()),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        body,
        json!({
            "asset": { "kind": "crypto", "symbol": "BTCUSDT", "id": "bitcoin", "name": "Bitcoin" },
            "summary": "Digital cash."
        })
    );
    // A pinned major must not trigger the 24 h coin-list request.
    assert_eq!(upstream.received_requests().await.unwrap().len(), 1);
}

#[tokio::test]
async fn resolves_an_unknown_crypto_via_the_coin_list() {
    let upstream = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/coingecko/coins/list"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!([
            { "id": "foo-token", "symbol": "foo", "name": "Foo Token" }
        ])))
        .mount(&upstream)
        .await;
    mount_coin_description(&upstream, "foo-token", "Foo Token", "The foo network.").await;

    let (status, body) = resolve(
        "/api/assets/resolve?symbol=FOOUSDT",
        test_config(&upstream.uri()),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        body,
        json!({
            "asset": { "kind": "crypto", "symbol": "FOOUSDT", "id": "foo-token", "name": "Foo Token" },
            "summary": "The foo network."
        })
    );
}

#[tokio::test]
async fn resolves_a_stock_and_omits_extra() {
    let upstream = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/fc"))
        .respond_with(
            ResponseTemplate::new(200).insert_header("set-cookie", "A1=abc; Path=/; Secure"),
        )
        .mount(&upstream)
        .await;
    Mock::given(method("GET"))
        .and(path("/yahoo/v1/test/getcrumb"))
        .respond_with(ResponseTemplate::new(200).set_body_string("crumb123\n"))
        .mount(&upstream)
        .await;
    Mock::given(method("GET"))
        .and(path("/yahoo/v1/finance/search"))
        .and(query_param("q", "AAPL"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "quotes": [{ "quoteType": "EQUITY", "symbol": "AAPL", "shortname": "Apple Inc." }]
        })))
        .mount(&upstream)
        .await;
    Mock::given(method("GET"))
        .and(path("/yahoo/v10/finance/quoteSummary/AAPL"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "quoteSummary": { "result": [{ "assetProfile": { "longBusinessSummary": "Apple makes phones." } }] }
        })))
        .mount(&upstream)
        .await;

    let (status, body) = resolve(
        "/api/assets/resolve?symbol=aapl",
        test_config(&upstream.uri()),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        body,
        json!({
            "asset": { "kind": "stock", "symbol": "AAPL", "id": "AAPL", "name": "Apple Inc." },
            "summary": "Apple makes phones."
        })
    );
}

#[tokio::test]
async fn resolver_requires_a_symbol() {
    let upstream = MockServer::start().await;
    let (status, body) = resolve("/api/assets/resolve", test_config(&upstream.uri())).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body, json!({ "error": "Missing symbol" }));
}
