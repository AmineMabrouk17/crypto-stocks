use axum::{
    Json, Router,
    extract::State,
    http::{HeaderValue, StatusCode},
    response::IntoResponse,
    routing::{get, post},
};
use crypto_stocks_common::config::Config;
use serde_json::json;
use tower_http::{
    cors::{AllowOrigin, Any, CorsLayer},
    trace::TraceLayer,
};

pub fn build(config: Config) -> Router {
    let cors = cors_layer(&config);
    let routes = Router::new()
        .route("/health", get(health))
        .route("/api/signals/crowd-odds", get(not_implemented))
        .route("/api/signals/sentiment", get(not_implemented))
        .route("/api/stocks/profile", get(not_implemented))
        .route("/api/stocks/quote", get(not_implemented))
        .route("/api/stocks/search", get(not_implemented))
        .route("/api/news", get(not_implemented))
        .route("/api/chat", post(not_implemented))
        .route("/api/assets/resolve", get(not_implemented));

    routes
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(config)
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

async fn not_implemented(State(_config): State<Config>) -> impl IntoResponse {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({ "error": "not implemented" })),
    )
}
