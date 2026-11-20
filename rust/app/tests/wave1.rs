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
    matchers::{method, path, query_param},
};

fn test_config(origin: &str) -> Config {
    let urls = BaseUrls {
        fear_greed: origin.to_owned(),
        google_news: format!("{origin}/rss/search"),
        coingecko: format!("{origin}/api/v3"),
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

#[tokio::test]
async fn sentiment_matches_ts_status_headers_and_shape() {
    let upstream = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/"))
        .and(query_param("limit", "1"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "name": "Fear and Greed Index",
            "data": [{
                "value": "27",
                "value_classification": "Fear",
                "timestamp": "1785888000",
                "time_until_update": "15580"
            }],
            "metadata": { "error": null }
        })))
        .mount(&upstream)
        .await;

    let (status, headers, body) =
        call("/api/signals/sentiment", test_config(&upstream.uri())).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        headers[CACHE_CONTROL],
        "public, s-maxage=3600, stale-while-revalidate=86400"
    );
    assert_eq!(body["value"].as_f64(), Some(27.0));
    assert_eq!(body["classification"], "Fear");
    assert_eq!(body["timestamp"].as_f64(), Some(1_785_888_000.0));
    assert_eq!(body["timeUntilUpdate"].as_f64(), Some(15_580.0));
    assert_eq!(body.as_object().unwrap().len(), 4);
}

#[tokio::test]
async fn sentiment_upstream_failure_matches_ts_error_text() {
    let upstream = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/"))
        .respond_with(ResponseTemplate::new(503))
        .mount(&upstream)
        .await;

    let (status, _, body) = call("/api/signals/sentiment", test_config(&upstream.uri())).await;

    assert_eq!(status, StatusCode::BAD_GATEWAY);
    assert_eq!(body, json!({ "error": "Fear & Greed request failed: 503" }));
}

#[tokio::test]
async fn news_requires_the_q_param() {
    let upstream = MockServer::start().await;
    for uri in ["/api/news", "/api/news?q=", "/api/news?q=%20%20"] {
        let (status, _, body) = call(uri, test_config(&upstream.uri())).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(body, json!({ "error": "Missing required query param: q" }));
    }
}

#[tokio::test]
async fn news_matches_ts_shape_and_sentiment() {
    let upstream = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/rss/search"))
        .and(query_param("q", "Bitcoin & ETH"))
        .and(query_param("hl", "en-US"))
        .and(query_param("gl", "US"))
        .and(query_param("ceid", "US:en"))
        .respond_with(ResponseTemplate::new(200).set_body_string(
            r#"<rss><channel>
              <item>
                <title><![CDATA[Bitcoin surges to record high - Coin Desk]]></title>
                <link><![CDATA[https://news.example/btc]]></link>
                <source url="https://news.example">Coin Desk</source>
                <pubDate>Tue, 04 Aug 2026 12:00:00 GMT</pubDate>
              </item>
              <item>
                <title>Stocks plunge on warning</title>
                <link>https://news.example/stocks</link>
              </item>
            </channel></rss>"#,
        ))
        .mount(&upstream)
        .await;

    let (status, _, body) = call(
        "/api/news?q=Bitcoin%20%26%20ETH",
        test_config(&upstream.uri()),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        body,
        json!({ "articles": [
            {
                "title": "Bitcoin surges to record high",
                "link": "https://news.example/btc",
                "source": "Coin Desk",
                "publishedAt": "Tue, 04 Aug 2026 12:00:00 GMT",
                "sentiment": "positive"
            },
            {
                "title": "Stocks plunge on warning",
                "link": "https://news.example/stocks",
                "source": null,
                "publishedAt": null,
                "sentiment": "negative"
            }
        ]})
    );
}

#[tokio::test]
async fn news_upstream_failure_includes_empty_articles() {
    let upstream = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/rss/search"))
        .respond_with(ResponseTemplate::new(502))
        .mount(&upstream)
        .await;

    let (status, _, body) = call("/api/news?q=bitcoin", test_config(&upstream.uri())).await;

    assert_eq!(status, StatusCode::BAD_GATEWAY);
    assert_eq!(
        body,
        json!({
            "error": "Google News RSS request failed: 502",
            "articles": []
        })
    );
}
