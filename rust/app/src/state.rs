use std::sync::Arc;

use crypto_stocks_coingecko::port::CoinGeckoService;
use crypto_stocks_common::{client::Http, config::Config, error::Result};
use crypto_stocks_feargreed::port::FearGreedService;
use crypto_stocks_news::port::NewsService;
use crypto_stocks_polymarket::port::PolymarketService;
use crypto_stocks_resolver::port::AssetResolver;
use crypto_stocks_yahoo::port::YahooService;

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
    pub yahoo: Arc<YahooService>,
    pub resolver: Arc<AssetResolver>,
}

impl AppState {
    pub fn new(config: Config) -> Result<Self> {
        let http = Arc::new(Http::new(&config)?);
        let coingecko = CoinGeckoService::new(http.clone(), config.urls.coingecko.clone());
        let yahoo = YahooService::new(
            http.clone(),
            config.urls.yahoo_query.clone(),
            config.urls.yahoo_fc.clone(),
        );
        let resolver = AssetResolver::new(coingecko.clone(), yahoo.clone());
        Ok(Self {
            feargreed: Arc::new(FearGreedService::new(
                http.clone(),
                config.urls.fear_greed.clone(),
            )),
            coingecko: Arc::new(coingecko),
            news: Arc::new(NewsService::new(
                http.clone(),
                config.urls.google_news.clone(),
            )),
            polymarket: Arc::new(PolymarketService::new(
                http.clone(),
                config.urls.polymarket_gamma.clone(),
                config.urls.polymarket_clob.clone(),
            )),
            yahoo: Arc::new(yahoo),
            resolver: Arc::new(resolver),
            config: Arc::new(config),
            http,
        })
    }
}
