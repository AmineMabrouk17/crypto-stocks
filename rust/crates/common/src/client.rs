use std::{collections::HashMap, time::Duration};

use reqwest::{
    Method, StatusCode, Url,
    header::{HeaderMap, HeaderValue},
};
use serde::de::DeserializeOwned;
use tracing::debug;

use crate::{
    config::Config,
    error::{Error, Result},
};

#[derive(Debug, Clone)]
pub struct HttpRequest {
    pub method: Method,
    pub url: Url,
    pub headers: HeaderMap,
    pub body: Option<Vec<u8>>,
}

impl HttpRequest {
    pub fn get(url: impl IntoUrl) -> Result<Self> {
        Ok(Self {
            method: Method::GET,
            url: url.into_url()?,
            headers: HeaderMap::new(),
            body: None,
        })
    }

    pub fn post(url: impl IntoUrl, body: Vec<u8>) -> Result<Self> {
        Ok(Self {
            method: Method::POST,
            url: url.into_url()?,
            headers: HeaderMap::new(),
            body: Some(body),
        })
    }

    pub fn header(mut self, name: &'static str, value: &str) -> Result<Self> {
        self.headers.insert(
            name,
            HeaderValue::from_str(value)
                .map_err(|e| Error::Config(format!("invalid header {name}: {e}")))?,
        );
        Ok(self)
    }
}

pub trait IntoUrl {
    fn into_url(self) -> Result<Url>;
}

impl IntoUrl for Url {
    fn into_url(self) -> Result<Url> {
        Ok(self)
    }
}

impl IntoUrl for String {
    fn into_url(self) -> Result<Url> {
        Url::parse(&self).map_err(|e| Error::Config(format!("invalid URL: {e}")))
    }
}

impl IntoUrl for &str {
    fn into_url(self) -> Result<Url> {
        Url::parse(self).map_err(|e| Error::Config(format!("invalid URL: {e}")))
    }
}

#[derive(Debug, Clone)]
pub struct Http {
    client: reqwest::Client,
    upstream_timeout: Duration,
    retry_max_attempts: u32,
}

impl Http {
    pub fn new(config: &Config) -> Result<Self> {
        let client = reqwest::Client::builder()
            .pool_max_idle_per_host(32)
            .pool_idle_timeout(Duration::from_secs(90))
            .connect_timeout(Duration::from_secs(5))
            .timeout(config.request_timeout)
            .gzip(true)
            .brotli(true)
            .http2_keep_alive_interval(Duration::from_secs(30))
            .build()
            .map_err(|e| Error::Config(format!("failed to build HTTP client: {e}")))?;

        Ok(Self {
            client,
            upstream_timeout: config.upstream_timeout,
            retry_max_attempts: config.retry_max_attempts.max(1),
        })
    }

    pub async fn send(&self, req: &HttpRequest) -> Result<reqwest::Response> {
        let mut last_error: Option<Error> = None;

        for attempt in 1..=self.retry_max_attempts {
            let mut builder = self
                .client
                .request(req.method.clone(), req.url.clone())
                .headers(req.headers.clone());
            if let Some(body) = &req.body {
                builder = builder.body(body.clone());
            }

            let outcome = tokio::time::timeout(self.upstream_timeout, builder.send()).await;
            match outcome {
                Ok(Ok(response)) => {
                    let status = response.status();
                    if should_retry(status) && attempt < self.retry_max_attempts {
                        debug!(url = %req.url, status = %status, attempt, "retrying upstream");
                        backoff(attempt).await;
                        last_error = Some(Error::Upstream(format!("upstream status {status}")));
                        continue;
                    }
                    return Ok(response);
                }
                Ok(Err(error)) => {
                    last_error = Some(Error::Transport(error.to_string()));
                    if attempt < self.retry_max_attempts {
                        backoff(attempt).await;
                        continue;
                    }
                }
                Err(_) => {
                    last_error = Some(Error::Timeout);
                    if attempt < self.retry_max_attempts {
                        backoff(attempt).await;
                    }
                }
            }
        }

        Err(last_error.unwrap_or(Error::Timeout))
    }

    pub async fn text(&self, req: &HttpRequest) -> Result<String> {
        let response = self.send(req).await?;
        response
            .text()
            .await
            .map_err(|e| Error::Transport(e.to_string()))
    }

    pub async fn json<T: DeserializeOwned>(&self, req: &HttpRequest) -> Result<T> {
        let response = self.send(req).await?;
        response
            .json::<T>()
            .await
            .map_err(|e| Error::Parse(format!("invalid JSON: {e}")))
    }

    /// Equivalent to the TS pattern `if (!res.ok) throw new Error(\`<prefix> request failed: ${res.status}\`)`.
    pub async fn text_checked(&self, req: &HttpRequest, prefix: &str) -> Result<String> {
        let response = self.send(req).await?;
        if !response.status().is_success() {
            return Err(Error::upstream(prefix, response.status().as_u16()));
        }
        response
            .text()
            .await
            .map_err(|e| Error::Transport(e.to_string()))
    }

    /// Checked variant of [`Self::json`] that maps non-2xx to the TS error text.
    pub async fn json_checked<T: DeserializeOwned>(
        &self,
        req: &HttpRequest,
        prefix: &str,
    ) -> Result<T> {
        let response = self.send(req).await?;
        if !response.status().is_success() {
            return Err(Error::upstream(prefix, response.status().as_u16()));
        }
        response
            .json::<T>()
            .await
            .map_err(|e| Error::Parse(format!("invalid JSON: {e}")))
    }

    pub fn client(&self) -> &reqwest::Client {
        &self.client
    }
}

fn should_retry(status: StatusCode) -> bool {
    status == StatusCode::TOO_MANY_REQUESTS || status.is_server_error()
}

async fn backoff(attempt: u32) {
    let millis = 80u64 * 2u64.saturating_pow(attempt.saturating_sub(1));
    tokio::time::sleep(Duration::from_millis(millis)).await;
}

pub fn query_pairs<'a>(pairs: &[(&'a str, &'a str)]) -> HashMap<&'a str, &'a str> {
    pairs.iter().copied().collect()
}
