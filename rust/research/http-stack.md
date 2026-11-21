# HTTP stack research — Rust migration support

Primary-source research for the Rust HTTP stack. Every factual claim below is followed by a source URL. Only docs.rs, crate repositories, the crates.io API, and official docs were used. This file is research support only; it does not change workspace code.

## Resolved versions and exact `Cargo.toml` strings

| Crate | Version string to use | Why this version | Source |
|---|---|---|---|
| `axum` | `"0.8.9"` | Latest 0.8 patch; requires `tokio ^1.44`, `http ^1.0`, `hyper ^1.1`, `tower-http ^0.6.8` | https://crates.io/api/v1/crates/axum/versions |
| `reqwest` | `"0.12.28"` | Latest 0.12 patch. Overall latest is `0.13.5`, but the workspace is on 0.12 and the retry middleware line compatible with it targets 0.12 | https://crates.io/api/v1/crates/reqwest/versions |
| `reqwest-middleware` | `"0.4.2"` | Requires `reqwest ^0.12.0`. Latest `0.5.2` requires `reqwest ^0.13.1` | https://docs.rs/reqwest-middleware/0.4.2/reqwest_middleware/ · https://crates.io/api/v1/crates/reqwest-middleware/versions |
| `reqwest-retry` | `"0.8.0"` | Requires `reqwest ^0.12.0` and `reqwest-middleware >0.3.0, <0.5.0`. Latest `0.9.1` targets the 0.13 stack | https://docs.rs/reqwest-retry/0.8.0/reqwest_retry/ · https://crates.io/api/v1/crates/reqwest-retry/0.9.1/dependencies |
| `retry-policies` | `"0.5"` | `reqwest-retry 0.8.0` builds its backoff from this crate (`retry-policies ^0.5`) | https://docs.rs/reqwest-retry/0.8.0/reqwest_retry/struct.RetryTransientMiddleware.html |
| `moka` | `"0.12.16"` | Latest 0.12 patch; use `features = ["future"]` for async cache | https://crates.io/api/v1/crates/moka/versions |
| `wiremock` | `"0.6.5"` | Latest 0.6 patch; dev-dependency only | https://crates.io/api/v1/crates/wiremock/versions |
| `tower-http` | `"0.6.8"` | axum 0.8.9 depends on `tower-http ^0.6.8`; pinning the same major avoids a duplicate version (latest overall is `0.7.1`) | https://docs.rs/axum/0.8.9/axum/ · https://crates.io/api/v1/crates/tower-http/versions |

Caret strings (`"0.8.9"`) allow compatible patch updates; use `"=0.8.9"` to pin exactly. The existing workspace already uses the same major/minor families (`axum 0.8`, `reqwest 0.12`, `moka 0.12`, `tower-http 0.6`, `wiremock 0.6`), so these versions align with it. Source: `/root/crypto-stocks/rust/Cargo.toml`.

```toml
[dependencies]
axum = "0.8.9"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12.28", default-features = false, features = ["json", "rustls-tls", "gzip", "brotli", "http2"] }
reqwest-middleware = "0.4.2"
reqwest-retry = "0.8.0"
retry-policies = "0.5"
moka = { version = "0.12.16", features = ["future"] }
tower-http = { version = "0.6.8", features = ["cors", "trace"] }
tracing = "0.1"

[dev-dependencies]
wiremock = "0.6.5"
```

---

## 1. axum 0.8.9

### Router, `State`, routes, query extraction, JSON responses

Routes use `{key}` captures and `{*key}` wildcards in 0.8 — **not** the 0.7 `:key` / `*key` syntax. Source: https://docs.rs/axum/0.8.9/axum/struct.Router.html

`Router::with_state` turns a `Router<State>` into a `Router<()>` that can be served; handlers read state with the `State` extractor. Source: https://docs.rs/axum/0.8.9/axum/extract/struct.State.html · https://docs.rs/axum/0.8.9/axum/struct.Router.html

```rust
use axum::{extract::{Query, State}, routing::get, Json, Router};
use serde::Deserialize;

#[derive(Clone)]
struct AppState { /* e.g. reqwest client, moka cache */ }

#[derive(Deserialize)]
struct Params { page: Option<u32> }

async fn list(State(state): State<AppState>, Query(q): Query<Params>) -> Json<Vec<String>> {
    let _ = (state, q.page);
    Json(vec!["a".into(), "b".into()]) // Json<T> implements IntoResponse
}

let app = Router::new()
    .route("/items", get(list))
    .route("/items/{id}", get(|axum::extract::Path(id): axum::extract::Path<u32>| async move { id.to_string() }))
    .with_state(AppState {});
```

`Query<T>` deserializes the query string; `Path<T>` captures route params; `Json<T>` both extracts request bodies and implements `IntoResponse` for responses. Sources: https://docs.rs/axum/0.8.9/axum/extract/struct.Query.html · https://docs.rs/axum/0.8.9/axum/extract/struct.Path.html · https://docs.rs/axum/0.8.9/axum/struct.Json.html

Only one body-consuming extractor (e.g. `Json`, `Form`, `Bytes`, `String`) may be used per handler, and it must be the last argument. Source: https://docs.rs/axum/0.8.9/axum/extract/index.html

### `TraceLayer`

`TraceLayer::new_for_http()` logs each request/response at the `DEBUG` level through `tracing`; add it with `Router::layer`. Source: https://docs.rs/tower-http/0.6.8/tower_http/trace/struct.TraceLayer.html

```rust
use tower_http::trace::TraceLayer;
let app = Router::new().route("/", get(|| async { "ok" })).layer(TraceLayer::new_for_http());
```

### Graceful shutdown with `tokio::signal`

`axum::serve(listener, app).with_graceful_shutdown(signal)` waits for in-flight requests to finish before exiting. Source: https://docs.rs/axum/0.8.9/axum/serve/struct.WithGracefulShutdown.html

```rust
use tokio::{net::TcpListener, signal};

let listener = TcpListener::bind("0.0.0.0:3000").await.unwrap();
axum::serve(listener, app)
    .with_graceful_shutdown(shutdown_signal())
    .await
    .unwrap();

async fn shutdown_signal() {
    let ctrl_c = async { signal::ctrl_c().await.expect("failed to install Ctrl+C handler") };
    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv().await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! { _ = ctrl_c => {}, _ = terminate => {} }
}
```

The upstream example pairs graceful shutdown with `TimeoutLayer` so a hung request cannot stall shutdown forever. Source: https://github.com/tokio-rs/axum/blob/main/examples/graceful-shutdown/src/main.rs

---

## 2. tower-http 0.6.8 — CORS with origin from env

`CorsLayer::new()` sends no CORS headers by default; you must set an allowed origin for browsers to accept cross-origin requests. `allow_origin` accepts a `HeaderValue`, an array, `Any`, or a predicate. Repeated calls to `allow_origin` override earlier ones. Sources: https://docs.rs/tower-http/0.6.8/tower_http/cors/struct.CorsLayer.html · https://docs.rs/tower-http/0.6.8/tower_http/cors/struct.AllowOrigin.html

```rust
use std::env;
use axum::Router;
use tower_http::cors::{Any, CorsLayer};

fn cors_from_env() -> CorsLayer {
    let layer = CorsLayer::new().allow_methods(Any).allow_headers(Any);
    match env::var("CORS_ALLOW_ORIGIN") {
        Ok(v) if v.trim() == "*" => layer.allow_origin(Any),
        Ok(v) => layer.allow_origin(
            v.trim().parse::<http::HeaderValue>().expect("invalid CORS_ALLOW_ORIGIN"),
        ),
        Err(_) => layer, // no origin configured -> no CORS headers
    }
}
let app = Router::new().layer(cors_from_env());
```

For dynamic per-request origins, use `AllowOrigin::predicate` or `AllowOrigin::async_predicate`. Source: https://docs.rs/tower-http/0.6.8/tower_http/cors/struct.AllowOrigin.html

---

## 3. reqwest 0.12.28

### Client builder: connection pooling and timeouts

`ClientBuilder::timeout` sets a **total** request deadline from connect until the response body is fully read (default: no timeout). `connect_timeout` limits only the TCP/TLS connect phase and requires a tokio timer. `pool_idle_timeout` defaults to 90 seconds and `pool_max_idle_per_host` defaults to `usize::MAX`. Sources: https://docs.rs/reqwest/0.12.28/reqwest/struct.ClientBuilder.html

```rust
use std::time::Duration;
let client = reqwest::Client::builder()
    .timeout(Duration::from_secs(30))            // total deadline incl. body
    .connect_timeout(Duration::from_secs(5))
    .pool_idle_timeout(Duration::from_secs(90))  // default 90s
    .pool_max_idle_per_host(32)
    .build()
    .unwrap();
```

Connection pooling is automatic and per-host; connections are reused when within the idle limits above. Source: https://docs.rs/reqwest/0.12.28/reqwest/struct.ClientBuilder.html

### Per-request timeout

`RequestBuilder::timeout` overrides the client's total timeout for a single request. Source: https://docs.rs/reqwest/0.12.28/reqwest/struct.RequestBuilder.html

```rust
let resp = client.get("https://example.com/slow")
    .timeout(Duration::from_secs(3))
    .send()
    .await?;
```

### Retry with backoff — middleware (preferred)

Use `reqwest-middleware` 0.4.2 + `reqwest-retry` 0.8.0 + `retry-policies` 0.5. `RetryTransientMiddleware::new_with_policy` wraps a `RetryPolicy` such as `ExponentialBackoff`, and the middleware sleeps with `tokio::time::sleep`. Source: https://docs.rs/reqwest-retry/0.8.0/reqwest_retry/struct.RetryTransientMiddleware.html

```rust
use std::time::Duration;
use reqwest::Client;
use reqwest_middleware::ClientBuilder;
use reqwest_retry::{policies::ExponentialBackoff, RetryTransientMiddleware};
use retry_policies::Jitter;

let retry_policy = ExponentialBackoff::builder()
    .retry_bounds(Duration::from_secs(1), Duration::from_secs(60))
    .jitter(Jitter::Bounded)
    .base(2)
    .build_with_max_retries(5);

let client = ClientBuilder::new(Client::new())
    .with(RetryTransientMiddleware::new_with_policy(retry_policy))
    .build();
```

`ExponentialBackoff::builder()` defaults: `min_retry_interval` 1s, `max_retry_interval` 30 min, `base` 2. Source: https://docs.rs/reqwest-retry/0.8.0/reqwest_retry/policies/struct.ExponentialBackoff.html

### Retry with backoff — manual (no extra crates)

For full control (e.g. retry only selected status codes and add jitter), loop on `resp.status()` with `tokio::time::sleep`. Source: https://docs.rs/reqwest/0.12.28/reqwest/struct.Response.html · https://docs.rs/tokio/1/tokio/time/fn.sleep.html

```rust
async fn get_with_retry(client: &reqwest::Client, url: &str, tries: u32) -> reqwest::Result<reqwest::Response> {
    let mut last_err = None;
    for n in 0..tries {
        match client.get(url).send().await {
            Ok(r) if r.status().is_server_error() && n + 1 < tries => {
                tokio::time::sleep(Duration::from_millis(100 * 2_u64.pow(n))).await;
            }
            Ok(r) => return Ok(r),
            Err(e) if n + 1 < tries => {
                last_err = Some(e);
                tokio::time::sleep(Duration::from_millis(100 * 2_u64.pow(n))).await;
            }
            Err(e) => return Err(e),
        }
    }
    Err(last_err.unwrap_or_else(|| reqwest::Error::from(std::io::Error::other("retry exhausted"))))
}
```

### Proxy environment behavior

The `system-proxy` feature (on by default in reqwest) reads HTTP(S)_PROXY env vars; calling `ClientBuilder::proxy` disables automatic system-proxy detection, and `no_proxy` clears the configured proxies. Sources: https://docs.rs/reqwest/0.12.28/reqwest/struct.ClientBuilder.html · https://docs.rs/reqwest/0.12.28/reqwest/struct.Proxy.html

The workspace sets `default-features = false` **without** `system-proxy`, so proxy env vars are **not** auto-detected there; add the `system-proxy` feature or configure `Proxy` explicitly. Source: `/root/crypto-stocks/rust/Cargo.toml` · https://docs.rs/reqwest/0.12.28/reqwest/index.html

---

## 4. moka 0.12.16 (`future::Cache`)

### TTL and single-flight with `try_get_with`

`future::Cache::builder()` supports `max_capacity`, `time_to_live`, `time_to_idle`, and `expire_after`. `get_with` / `try_get_with` coalesce concurrent calls for the **same key** into one load (single-flight): other callers wait and receive the same value rather than each invoking the loader. `try_get_with` returns `Result<V, Arc<E>>` and does **not** cache an error from the loader. Sources: https://docs.rs/moka/0.12.16/moka/future/struct.Cache.html · https://docs.rs/moka/0.12.16/moka/future/struct.Cache.html#method.try_get_with

```rust
use std::{sync::Arc, time::Duration};
use moka::future::Cache;

let cache: Cache<String, Arc<String>> = Cache::builder()
    .max_capacity(10_000)
    .time_to_live(Duration::from_secs(300))
    .build();

let value: Arc<String> = cache
    .try_get_with("key".to_string(), async {
        let data = fetch().await?;          // Result<String, MyError>
        Ok::<_, MyError>(Arc::new(data))
    })
    .await?;
```

### Keyed caches

`Cache<K, V>` is inherently keyed by `K`: keys must be `Hash + Eq + Send + Sync + 'static` and values `Clone + Send + Sync + 'static`. For several independent namespaces (e.g. one cache per upstream), hold a map of `Cache` instances keyed by a dimension rather than embedding the dimension in every key. Do not wrap a `Cache` in `Mutex`/`RwLock` — it is already concurrent; wrap expensive values in `Arc` so clones are cheap. Sources: https://docs.rs/moka/0.12.16/moka/future/struct.Cache.html · https://docs.rs/moka/0.12.16/moka/future/struct.CacheBuilder.html

---

## 5. wiremock 0.6.5 — mocking upstreams in integration tests

`MockServer::start()` binds a random local port; `Mock::given(...)` takes matchers from `wiremock::matchers`, `.respond_with(ResponseTemplate::new(code)...)`, and `.mount(&server).await` / `server.register(mock).await` to activate it (both must be awaited). `server.uri()` gives the base URL to point the client at; unmatched requests return 404. Sources: https://docs.rs/wiremock/0.6.5/wiremock/struct.MockServer.html · https://docs.rs/wiremock/0.6.5/wiremock/struct.ResponseTemplate.html · https://docs.rs/wiremock/0.6.5/wiremock/matchers/index.html

```rust
use wiremock::{matchers::{method, path}, Mock, MockServer, ResponseTemplate};

#[tokio::test]
async fn upstream_is_mocked() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/v1/price"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({ "price": 42 })))
        .expect(1)
        .mount(&server)
        .await;

    let body = reqwest::get(format!("{}/v1/price", server.uri())).await.unwrap()
        .json::<serde_json::Value>().await.unwrap();
    assert_eq!(body["price"], 42);
    server.verify().await; // asserts all expectations were met
}
```

Use one `MockServer` per upstream and create it inside each test for isolation; use `register_as_scoped` for mocks defined in helpers so they are verified and removed when the guard drops. `received_requests()` can inspect recorded requests. Sources: https://docs.rs/wiremock/0.6.5/wiremock/struct.MockServer.html

---

## Semantic traps

- **moka `try_get_with` does not cache errors.** A failing loader returns `Err(Arc<E>)` and is retried by every subsequent caller — repeated failures cause a stampede. Cache the error value explicitly (e.g. wrap in `Result` as the `V`) if negative caching is wanted. Single-flight coalescing applies per key within one `Cache` instance only, not across instances. Sources: https://docs.rs/moka/0.12.16/moka/future/struct.Cache.html#method.try_get_with
- **Do not wrap moka `Cache` in a lock.** It is internally concurrent; a `Mutex`/`RwLock` around it serializes all access and defeats its design. Values are cloned out, so wrap large values in `Arc`. Source: https://docs.rs/moka/0.12.16/moka/future/struct.Cache.html
- **axum body limit is 2 MB by default** for `Bytes`, `String`, `Json`, and `Form`; larger bodies are rejected unless you add `DefaultBodyLimit::max(...)` / `disable()`. Source: https://docs.rs/axum/0.8.9/axum/extract/struct.DefaultBodyLimit.html
- **axum body extractors must be last and unique.** Two body-consuming extractors in one handler fail at runtime; a trailing body extractor cannot be followed by another extractor. Source: https://docs.rs/axum/0.8.9/axum/extract/index.html
- **Route syntax changed in 0.8.** Use `{id}` and `{*rest}`, not `:id` / `*rest`. Source: https://docs.rs/axum/0.8.9/axum/struct.Router.html
- **reqwest `timeout` is a total deadline**, not a per-read timeout; it includes reading the body. `RequestBuilder::timeout` overrides this total, while `connect_timeout` is separate. Source: https://docs.rs/reqwest/0.12.28/reqwest/struct.ClientBuilder.html · https://docs.rs/reqwest/0.12.28/reqwest/struct.RequestBuilder.html
- **Proxy env is off in this workspace.** `default-features = false` removes `system-proxy`; env proxies are not honored unless that feature is enabled or `Proxy` is set explicitly. Calling `ClientBuilder::proxy` also disables auto-detection. Source: `/root/crypto-stocks/rust/Cargo.toml` · https://docs.rs/reqwest/0.12.28/reqwest/struct.ClientBuilder.html
- **Built-in `ClientBuilder::retry()` is not a general HTTP retry.** In 0.12 it retries protocol-level negative acknowledgements by default, not arbitrary 5xx responses — use the retry middleware or the manual loop above for status-based retries. Source: https://docs.rs/reqwest/0.12.28/reqwest/struct.ClientBuilder.html
- **Retry middleware rejects streaming bodies.** `RetryTransientMiddleware` errors with "Request object is not cloneable. Are you passing a streaming body?" — buffer the body (`From<String>`/`From<Bytes>`) or skip retries for streams. Source: https://docs.rs/reqwest-retry/0.8.0/reqwest_retry/struct.RetryTransientMiddleware.html
- **Retry only idempotent methods** in the manual approach; retrying `POST` can duplicate side effects. Source: https://docs.rs/reqwest/0.12.28/reqwest/struct.RequestBuilder.html
- **tower-http `CorsLayer::new()` allows nothing by default** and repeated `allow_origin` calls overwrite prior ones. `Any` combined with credentials is invalid for browsers; validate env values as `HeaderValue` and trim whitespace. Sources: https://docs.rs/tower-http/0.6.8/tower_http/cors/struct.CorsLayer.html · https://docs.rs/tower-http/0.6.8/tower_http/cors/struct.AllowOrigin.html
- **wiremock mocks must be awaited when mounted/registered**, and a request that matches nothing returns 404 (a common source of false "success" assertions). Sharing one `MockServer` across tests causes cross-test interference. Source: https://docs.rs/wiremock/0.6.5/wiremock/struct.MockServer.html
- **Version-family mismatch.** `reqwest-middleware 0.5.x` / `reqwest-retry 0.9.x` require reqwest 0.13; mixing them with `reqwest 0.12` fails resolution. Keep the 0.4.2 / 0.8.0 pair. Sources: https://crates.io/api/v1/crates/reqwest-middleware/versions · https://crates.io/api/v1/crates/reqwest-retry/0.9.1/dependencies
