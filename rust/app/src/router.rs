use axum::{
    Json, Router,
    extract::{Query, State},
    http::{HeaderMap, HeaderValue, StatusCode, header::CACHE_CONTROL},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use crypto_stocks_common::{config::Config, json::js_json};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tower_http::{
    cors::{AllowOrigin, Any, CorsLayer},
    trace::TraceLayer,
};

use crate::state::AppState;

pub fn build(state: AppState) -> Router {
    let cors = cors_layer(&state.config);
    let routes = Router::new()
        .route("/health", get(health))
        .route("/api/signals/crowd-odds", get(not_implemented))
        .route("/api/signals/sentiment", get(sentiment))
        .route("/api/stocks/profile", get(not_implemented))
        .route("/api/stocks/quote", get(not_implemented))
        .route("/api/stocks/search", get(not_implemented))
        .route("/api/news", get(news))
        .route("/api/chat", post(not_implemented))
        .route("/api/assets/resolve", get(not_implemented));

    routes
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}

fn cors_layer(config: &Config) -> CorsLayer {
    let layer = CorsLayer::new()
        .allow_methods(Any)
        .allow_headers(Any)
        .expose_headers(Any);

    if config.cors_origins.iter().any(|origin| origin == "*") {
        layer.allow_origin(Any)
    } else {
        let origins = config
            .cors_origins
            .iter()
            .filter_map(|origin| HeaderValue::from_str(origin).ok())
            .collect::<Vec<_>>();
        layer.allow_origin(AllowOrigin::list(origins))
    }
}

async fn health() -> impl IntoResponse {
    Json(json!({ "status": "ok" }))
}

async fn not_implemented(State(_state): State<AppState>) -> impl IntoResponse {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({ "error": "not implemented" })),
    )
}

fn error_response(status: StatusCode, body: Value) -> Response {
    (status, Json(body)).into_response()
}

fn cached_json<T: Serialize>(cache_control: &'static str, body: &T) -> Response {
    let mut headers = HeaderMap::new();
    headers.insert(CACHE_CONTROL, HeaderValue::from_static(cache_control));
    (StatusCode::OK, headers, Json(js_json(body))).into_response()
}

async fn sentiment(State(state): State<AppState>) -> Response {
    match state.feargreed.fetch().await {
        Ok(index) => cached_json(
            "public, s-maxage=3600, stale-while-revalidate=86400",
            &index,
        ),
        Err(error) => error_response(
            StatusCode::BAD_GATEWAY,
            json!({ "error": error.to_string() }),
        ),
    }
}

#[derive(Debug, Deserialize)]
struct NewsQuery {
    q: Option<String>,
}

async fn news(State(state): State<AppState>, Query(query): Query<NewsQuery>) -> Response {
    // TS validates the trimmed value but forwards the original query.
    let Some(raw_query) = query.q.as_deref() else {
        return error_response(
            StatusCode::BAD_REQUEST,
            json!({ "error": "Missing required query param: q" }),
        );
    };
    if raw_query.trim().is_empty() {
        return error_response(
            StatusCode::BAD_REQUEST,
            json!({ "error": "Missing required query param: q" }),
        );
    }

    match state.news.fetch(raw_query).await {
        Ok(articles) => Json(js_json(&json!({ "articles": articles }))).into_response(),
        Err(error) => error_response(
            StatusCode::BAD_GATEWAY,
            json!({ "error": error.to_string(), "articles": [] }),
        ),
    }
}
