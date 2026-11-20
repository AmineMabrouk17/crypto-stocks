use std::{env, net::SocketAddr, time::Duration};

use crate::error::{Error, Result};

#[derive(Debug, Clone)]
pub struct BaseUrls {
    pub binance_rest: String,
    pub coingecko: String,
    pub yahoo_query: String,
    pub yahoo_fc: String,
    pub fear_greed: String,
    pub polymarket_gamma: String,
    pub polymarket_clob: String,
    pub google_news: String,
    pub gemini: String,
    pub groq: String,
    pub openai: String,
    pub anthropic: String,
}

impl Default for BaseUrls {
    fn default() -> Self {
        Self {
            binance_rest: "https://api.binance.com".into(),
            coingecko: "https://api.coingecko.com/api/v3".into(),
            yahoo_query: "https://query1.finance.yahoo.com".into(),
            yahoo_fc: "https://fc.yahoo.com".into(),
            fear_greed: "https://api.alternative.me/fng".into(),
            polymarket_gamma: "https://gamma-api.polymarket.com".into(),
            polymarket_clob: "https://clob.polymarket.com".into(),
            google_news: "https://news.google.com/rss/search".into(),
            gemini: "https://generativelanguage.googleapis.com/v1beta".into(),
            groq: "https://api.groq.com/openai/v1".into(),
            openai: "https://api.openai.com/v1".into(),
            anthropic: "https://api.anthropic.com/v1".into(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct Config {
    pub bind_addr: SocketAddr,
    pub cors_origins: Vec<String>,
    pub request_timeout: Duration,
    pub upstream_timeout: Duration,
    pub retry_max_attempts: u32,
    pub gemini_api_key: Option<String>,
    pub groq_api_key: Option<String>,
    pub urls: BaseUrls,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let host = env::var("HOST").unwrap_or_else(|_| "127.0.0.1".into());
        let port = env::var("PORT")
            .ok()
            .and_then(|p| p.parse::<u16>().ok())
            .unwrap_or(8080);
        let bind_addr = format!("{host}:{port}")
            .parse()
            .map_err(|e| Error::Config(format!("invalid HOST/PORT: {e}")))?;

        let cors_origins = env::var("CORS_ORIGINS")
            .unwrap_or_else(|_| "http://localhost:3000".into())
            .split(',')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_owned)
            .collect();

        let request_timeout_ms = env_u64("REQUEST_TIMEOUT_MS", 15_000)?;
        let upstream_timeout_ms = env_u64("UPSTREAM_TIMEOUT_MS", 8_000)?;
        let retry_max_attempts = env_u64("RETRY_MAX_ATTEMPTS", 3)? as u32;

        let mut urls = BaseUrls::default();
        urls.binance_rest = env::var("BINANCE_REST_BASE").unwrap_or(urls.binance_rest);
        urls.coingecko = env::var("COINGECKO_BASE").unwrap_or(urls.coingecko);
        urls.yahoo_query = env::var("YAHOO_QUERY_BASE").unwrap_or(urls.yahoo_query);
        urls.yahoo_fc = env::var("YAHOO_FC_BASE").unwrap_or(urls.yahoo_fc);
        urls.fear_greed = env::var("ALTERNATIVE_ME_FNG_BASE").unwrap_or(urls.fear_greed);
        urls.polymarket_gamma = env::var("POLYMARKET_GAMMA_BASE").unwrap_or(urls.polymarket_gamma);
        urls.polymarket_clob = env::var("POLYMARKET_CLOB_BASE").unwrap_or(urls.polymarket_clob);
        urls.google_news = env::var("GOOGLE_NEWS_RSS_BASE").unwrap_or(urls.google_news);
        urls.gemini = env::var("GEMINI_API_BASE").unwrap_or(urls.gemini);
        urls.groq = env::var("GROQ_API_BASE").unwrap_or(urls.groq);
        urls.openai = env::var("OPENAI_API_BASE").unwrap_or(urls.openai);
        urls.anthropic = env::var("ANTHROPIC_API_BASE").unwrap_or(urls.anthropic);

        Ok(Self {
            bind_addr,
            cors_origins,
            request_timeout: Duration::from_millis(request_timeout_ms),
            upstream_timeout: Duration::from_millis(upstream_timeout_ms),
            retry_max_attempts,
            gemini_api_key: env::var("GEMINI_API_KEY").ok(),
            groq_api_key: env::var("GROQ_API_KEY").ok(),
            urls,
        })
    }
}

fn env_u64(name: &str, default: u64) -> Result<u64> {
    match env::var(name) {
        Ok(v) => v
            .parse()
            .map_err(|_| Error::Config(format!("{name} must be a number"))),
        Err(_) => Ok(default),
    }
}
