use axum::{
    Json, Router,
    extract::{Query, State},
    http::{HeaderMap, HeaderValue, StatusCode, header::CACHE_CONTROL},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use crypto_stocks_common::{
    config::Config,
    json::js_json,
    types::{ChatRequestBody, CrowdOddsHorizon},
};
use crypto_stocks_llm::port::{ChatError, build_system_instruction, reply};
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
        .route("/api/signals/crowd-odds", get(crowd_odds))
        .route("/api/signals/sentiment", get(sentiment))
        .route("/api/stocks/profile", get(stock_profile))
        .route("/api/stocks/quote", get(stock_quote))
        .route("/api/stocks/search", get(stock_search))
        .route("/api/news", get(news))
        .route("/api/chat", post(chat))
        .route("/api/assets/resolve", get(resolve_asset));

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

#[derive(Debug, Deserialize)]
struct ResolveQuery {
    symbol: Option<String>,
    #[serde(rename = "idHint")]
    id_hint: Option<String>,
}

async fn resolve_asset(
    State(state): State<AppState>,
    Query(query): Query<ResolveQuery>,
) -> Response {
    let Some(symbol) = query.symbol.as_deref() else {
        return error_response(
            StatusCode::BAD_REQUEST,
            json!({ "error": "Missing symbol" }),
        );
    };
    let resolved = state
        .resolver
        .resolve(symbol, query.id_hint.as_deref())
        .await;
    Json(js_json(&resolved)).into_response()
}

fn error_response(status: StatusCode, body: Value) -> Response {
    (status, Json(body)).into_response()
}

fn cached_json<T: Serialize>(cache_control: &'static str, body: &T) -> Response {
    let mut headers = HeaderMap::new();
    headers.insert(CACHE_CONTROL, HeaderValue::from_static(cache_control));
    (StatusCode::OK, headers, Json(js_json(body))).into_response()
}

#[derive(Debug, Deserialize)]
struct CrowdOddsQuery {
    symbol: Option<String>,
    horizon: Option<String>,
}

async fn crowd_odds(
    State(state): State<AppState>,
    Query(query): Query<CrowdOddsQuery>,
) -> Response {
    let symbol = query.symbol.as_deref().unwrap_or("").trim().to_uppercase();
    if symbol.is_empty() {
        return error_response(
            StatusCode::BAD_REQUEST,
            json!({ "error": "Missing symbol" }),
        );
    }
    let Some(horizon) = query.horizon.as_deref().and_then(CrowdOddsHorizon::parse) else {
        return error_response(
            StatusCode::BAD_REQUEST,
            json!({ "error": "Invalid horizon" }),
        );
    };

    let now = chrono::Utc::now().timestamp();
    match state
        .polymarket
        .fetch_crowd_odds(&symbol, horizon, now)
        .await
    {
        Ok(snapshot) => cached_json("public, s-maxage=30, stale-while-revalidate=300", &snapshot),
        Err(error) => error_response(
            StatusCode::BAD_GATEWAY,
            json!({ "error": error.to_string() }),
        ),
    }
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

#[derive(Debug, Deserialize)]
struct QuoteQuery {
    symbol: Option<String>,
    range: Option<String>,
    interval: Option<String>,
}

async fn stock_quote(State(state): State<AppState>, Query(query): Query<QuoteQuery>) -> Response {
    // TS treats an empty `symbol=` as missing (`if (!symbol)`), so reject it here too.
    let Some(symbol) = query.symbol.as_deref().filter(|s| !s.is_empty()) else {
        return error_response(
            StatusCode::BAD_REQUEST,
            json!({ "error": "Missing symbol" }),
        );
    };
    let range = query.range.as_deref().unwrap_or("1d");
    let interval = query.interval.as_deref().unwrap_or("1m");

    match state.yahoo.fetch_quote(symbol, range, interval).await {
        Ok(quote) => cached_json("public, s-maxage=5, stale-while-revalidate=30", &quote),
        Err(error) => error_response(
            StatusCode::BAD_GATEWAY,
            json!({ "error": error.to_string() }),
        ),
    }
}

#[derive(Debug, Deserialize)]
struct SearchQuery {
    q: Option<String>,
}

async fn stock_search(State(state): State<AppState>, Query(query): Query<SearchQuery>) -> Response {
    let Some(raw_query) = query.q.as_deref() else {
        return Json(js_json(&json!({ "results": [] }))).into_response();
    };
    if raw_query.trim().len() < 2 {
        return Json(js_json(&json!({ "results": [] }))).into_response();
    }

    match state.yahoo.search(raw_query).await {
        Ok(results) => cached_json(
            "public, s-maxage=300, stale-while-revalidate=3600",
            &json!({ "results": results }),
        ),
        Err(error) => error_response(
            StatusCode::BAD_GATEWAY,
            json!({ "error": error.to_string(), "results": [] }),
        ),
    }
}

#[derive(Debug, Deserialize)]
struct ProfileQuery {
    symbol: Option<String>,
}

async fn stock_profile(
    State(state): State<AppState>,
    Query(query): Query<ProfileQuery>,
) -> Response {
    // TS treats an empty `symbol=` as missing (`if (!symbol)`), so reject it here too.
    let Some(symbol) = query.symbol.as_deref().filter(|s| !s.is_empty()) else {
        return error_response(
            StatusCode::BAD_REQUEST,
            json!({ "error": "Missing symbol" }),
        );
    };

    match state.yahoo.fetch_description(symbol).await {
        Ok(description) => cached_json(
            "public, s-maxage=3600, stale-while-revalidate=86400",
            &description,
        ),
        Err(error) => error_response(
            StatusCode::BAD_GATEWAY,
            json!({ "error": error.to_string() }),
        ),
    }
}

async fn chat(State(state): State<AppState>, Json(body): Json<ChatRequestBody>) -> Response {
    if body.messages.is_empty() {
        return error_response(
            StatusCode::BAD_REQUEST,
            json!({ "error": "messages is required" }),
        );
    }

    let system_instruction = build_system_instruction(
        &body.asset,
        body.live_price,
        body.market_stats.as_ref(),
        body.description.as_deref(),
    );

    match reply(
        &state.http,
        &state.config,
        body.llm_settings.as_ref(),
        body.free_model_id.as_deref(),
        &system_instruction,
        &body.messages,
    )
    .await
    {
        Ok(text) => Json(js_json(&json!({ "reply": text }))).into_response(),
        Err(ChatError::BadRequest(message)) => {
            error_response(StatusCode::BAD_REQUEST, json!({ "error": message }))
        }
        Err(ChatError::NotConfigured(message)) => error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            json!({ "error": message }),
        ),
        Err(ChatError::Upstream(message)) => {
            tracing::error!("[/api/chat] Error: {message}");
            error_response(
                StatusCode::BAD_GATEWAY,
                json!({ "error": "Failed to connect to the AI model. Please try another model or try again later." }),
            )
        }
    }
}
