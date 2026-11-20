use std::sync::Arc;

use crypto_stocks_coingecko::port::CoinGeckoService;
use crypto_stocks_common::{client::Http, config::Config, error::Result};
use crypto_stocks_feargreed::port::FearGreedService;
use crypto_stocks_news::port::NewsService;
use crypto_stocks_polymarket::port::PolymarketService;

/// Shared application state. Every service owns its own TTL caches and shares
/// one pooled `reqwest::Client` through [`Http`].
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub http: Arc<Http>,
    pub feargreed: Arc<FearGreedService>,
    pub coingecko: Arc<CoinGeckoService>,
    pub news: Arc<NewsService>,
    pub polymarket: Arc<PolymarketService>,
}

impl AppState {
    pub fn new(config: Config) -> Result<Self> {
        let http = Arc::new(Http::new(&config)?);
        Ok(Self {
            feargreed: Arc::new(FearGreedService::new(
                http.clone(),
                config.urls.fear_greed.clone(),
            )),
            coingecko: Arc::new(CoinGeckoService::new(
                http.clone(),
                config.urls.coingecko.clone(),
            )),
            news: Arc::new(NewsService::new(
                http.clone(),
                config.urls.google_news.clone(),
            )),
            polymarket: Arc::new(PolymarketService::new(
                http.clone(),
                config.urls.polymarket_gamma.clone(),
                config.urls.polymarket_clob.clone(),
            )),
            config: Arc::new(config),
            http,
        })
    }
}
