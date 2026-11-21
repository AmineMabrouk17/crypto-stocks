use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AssetKind {
    Crypto,
    #[default]
    Stock,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssetRef {
    pub kind: AssetKind,
    pub symbol: String,
    pub id: String,
    pub name: String,
}

/// Wire shape of the one-time asset resolution endpoint and of the TS
/// `ResolvedAsset` returned by `resolveAsset`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResolvedAsset {
    pub asset: AssetRef,
    pub summary: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Candle {
    pub time: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DayStats {
    pub change_percent: Option<f64>,
    pub high: Option<f64>,
    pub low: Option<f64>,
    pub volume: Option<f64>,
}

/// Matches the TS `extra?: Record<string, string | number | undefined>`:
/// always serialised as an object, with `undefined` values omitted.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AssetDescription {
    pub name: String,
    pub summary: String,
    /// Absent in the TS `fetchYahooDescription` response; present (possibly
    /// empty) in `fetchCoinDescription`. `None` omits the key entirely.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub extra: Option<serde_json::Map<String, Value>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SearchResult {
    pub kind: AssetKind,
    pub id: String,
    pub symbol: String,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CoinListEntry {
    pub id: String,
    pub symbol: String,
    pub name: String,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketStats {
    pub session_open: Option<f64>,
    pub high: Option<f64>,
    pub low: Option<f64>,
    pub change_percent: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Sentiment {
    Positive,
    Negative,
    Neutral,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewsArticle {
    pub title: String,
    pub link: String,
    /// Required in the TS contract; `null` when Google News omits it.
    pub source: Option<String>,
    /// Required in the TS contract; `null` when Google News omits it.
    pub published_at: Option<String>,
    pub sentiment: Sentiment,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YahooQuote {
    pub price: Option<f64>,
    pub currency: Option<String>,
    pub candles: Vec<Candle>,
    pub day_stats: DayStats,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FearGreedIndex {
    pub value: f64,
    pub classification: String,
    pub timestamp: f64,
    pub time_until_update: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CrowdOddsHorizon {
    #[serde(rename = "4h")]
    FourHours,
    #[serde(rename = "1D")]
    OneDay,
    #[serde(rename = "1W")]
    OneWeek,
}

impl CrowdOddsHorizon {
    pub const ALL: [Self; 3] = [Self::FourHours, Self::OneDay, Self::OneWeek];

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::FourHours => "4h",
            Self::OneDay => "1D",
            Self::OneWeek => "1W",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "4h" => Some(Self::FourHours),
            "1D" => Some(Self::OneDay),
            "1W" => Some(Self::OneWeek),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PolymarketMarket {
    pub id: String,
    pub slug: String,
    pub question: String,
    pub outcomes: Vec<String>,
    pub outcome_prices: Vec<f64>,
    pub clob_token_ids: Vec<String>,
    pub start_date: String,
    pub end_date: String,
    pub active: bool,
    pub closed: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrowdOddsSnapshot {
    pub market: Option<PolymarketMarket>,
    pub up_probability: f64,
    pub down_probability: f64,
    pub end_time: String,
    pub available_horizons: Vec<CrowdOddsHorizon>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LlmProvider {
    Gemini,
    Openai,
    Anthropic,
    Groq,
    Custom,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmSettings {
    pub provider: LlmProvider,
    pub api_key: String,
    pub model: String,
    pub custom_base_url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequestBody {
    #[serde(default)]
    pub messages: Vec<ChatMessage>,
    #[serde(default)]
    pub asset: ChatAsset,
    pub live_price: Option<f64>,
    pub market_stats: Option<MarketStats>,
    pub description: Option<String>,
    pub llm_settings: Option<LlmSettings>,
    pub free_model_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct ChatAsset {
    pub name: String,
    pub symbol: String,
    pub kind: AssetKind,
}

pub fn camel_value(fields: Vec<(&str, Value)>) -> Value {
    Value::Object(fields.into_iter().map(|(k, v)| (k.to_owned(), v)).collect())
}
