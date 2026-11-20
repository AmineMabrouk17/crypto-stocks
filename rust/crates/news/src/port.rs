use std::{sync::Arc, sync::LazyLock, time::Duration};

use crypto_stocks_common::{
    cache::{single_flight, ttl_cache},
    client::{Http, HttpRequest},
    error::Result,
    types::{NewsArticle, Sentiment},
};
use moka::future::Cache;
use regex::Regex;

const POSITIVE_WORDS: &[&str] = &[
    "surge",
    "surges",
    "rally",
    "rallies",
    "gain",
    "gains",
    "soar",
    "soars",
    "jump",
    "jumps",
    "record high",
    "beat",
    "beats",
    "boost",
    "boosts",
    "rebound",
    "rebounds",
    "climb",
    "climbs",
    "upgrade",
    "upgraded",
];

const NEGATIVE_WORDS: &[&str] = &[
    "plunge",
    "plunges",
    "crash",
    "crashes",
    "drop",
    "drops",
    "slump",
    "slumps",
    "miss",
    "misses",
    "warns",
    "warning",
    "sink",
    "sinks",
    "tumble",
    "tumbles",
    "fall",
    "falls",
    "downgrade",
    "downgraded",
    "sell-off",
    "selloff",
];

static ITEM_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?s)<item>(.*?)</item>").unwrap());
static CDATA_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?s)^<!\[CDATA\[(.*)\]\]>$").unwrap());

/// JS `encodeURIComponent`: keeps A-Z a-z 0-9 and `-_.!~*'()`, percent-encodes
/// every other UTF-8 byte with uppercase hex.
fn encode_uri_component(value: &str) -> String {
    let mut encoded = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z'
            | b'a'..=b'z'
            | b'0'..=b'9'
            | b'-'
            | b'_'
            | b'.'
            | b'!'
            | b'~'
            | b'*'
            | b'\''
            | b'('
            | b')' => encoded.push(byte as char),
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}

/// Entity decode order matches the TS chain exactly, with `&amp;` last so
/// double-encoded input (`&amp;lt;`) decodes the same way.
fn decode_entities(text: &str) -> String {
    text.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#039;", "'")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&amp;", "&")
}

fn strip_cdata(text: &str) -> String {
    let inner = CDATA_RE
        .captures(text)
        .map(|captures| captures[1].to_owned())
        .unwrap_or_else(|| text.to_owned());
    decode_entities(inner.trim())
}

fn extract_tag(block: &str, tag: &str) -> Option<String> {
    let pattern = format!(r"(?is)<{tag}[^>]*>(.*?)</{tag}>");
    let regex = Regex::new(&pattern).ok()?;
    regex
        .captures(block)
        .map(|captures| strip_cdata(&captures[1]))
}

fn detect_sentiment(title: &str) -> Sentiment {
    let lower = title.to_lowercase();
    let positive = POSITIVE_WORDS.iter().any(|word| lower.contains(word));
    let negative = NEGATIVE_WORDS.iter().any(|word| lower.contains(word));
    match (positive, negative) {
        (true, false) => Sentiment::Positive,
        (false, true) => Sentiment::Negative,
        _ => Sentiment::Neutral,
    }
}

/// Pure port of the TS hand-rolled RSS parser.
pub fn parse_news_feed(xml: &str) -> Vec<NewsArticle> {
    ITEM_RE
        .find_iter(xml)
        .filter_map(|item| {
            let block = item.as_str();
            let raw_title = extract_tag(block, "title").unwrap_or_default();
            let source = extract_tag(block, "source");
            let suffix = source.as_ref().map(|source| format!(" - {source}"));
            let title = match suffix {
                Some(suffix) => raw_title
                    .strip_suffix(&suffix)
                    .unwrap_or(&raw_title)
                    .to_owned(),
                None => raw_title,
            };

            let sentiment = detect_sentiment(&title);
            let article = NewsArticle {
                title,
                link: extract_tag(block, "link").unwrap_or_default(),
                source,
                published_at: extract_tag(block, "pubDate"),
                sentiment,
            };

            (article.title.chars().next().is_some() && article.link.chars().next().is_some())
                .then_some(article)
        })
        .collect()
}

/// Fetcher with a 5 min TTL and single-flight deduplication.
pub struct NewsService {
    http: Arc<Http>,
    base: String,
    cache: Cache<String, Vec<NewsArticle>>,
}

impl NewsService {
    pub fn new(http: Arc<Http>, base: String) -> Self {
        Self {
            http,
            base,
            cache: ttl_cache(Duration::from_secs(300), 512),
        }
    }

    pub async fn fetch(&self, query: &str) -> Result<Vec<NewsArticle>> {
        let key = query.to_owned();
        let http = self.http.clone();
        let base = self.base.clone();
        single_flight(&self.cache, key, || async move {
            let request = HttpRequest::get(format!(
                "{base}?q={}&hl=en-US&gl=US&ceid=US:en",
                encode_uri_component(query)
            ))?;
            let xml = http.text_checked(&request, "Google News RSS").await?;
            Ok(parse_news_feed(&xml))
        })
        .await
        .map_err(|error| (*error).clone())
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn encodes_query_like_encode_uri_component() {
        assert_eq!(encode_uri_component("Bitcoin & ETH"), "Bitcoin%20%26%20ETH");
        assert_eq!(encode_uri_component("a-b_c.d!~*'()"), "a-b_c.d!~*'()");
        assert_eq!(encode_uri_component("é"), "%C3%A9");
    }

    #[test]
    fn decodes_entities_in_the_ts_order() {
        assert_eq!(
            decode_entities("&lt;b&gt;&quot;&#39;&#039;&apos;&amp;"),
            "<b>\"'''&"
        );
    }

    #[test]
    fn parses_feed_and_strips_source_suffix() {
        let xml = r#"
        <rss><channel>
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
          <item><title></title><link>https://news.example/empty</link></item>
        </channel></rss>"#;

        let articles = parse_news_feed(xml);
        assert_eq!(articles.len(), 2);

        assert_eq!(articles[0].title, "Bitcoin surges to record high");
        assert_eq!(articles[0].link, "https://news.example/btc");
        assert_eq!(articles[0].source.as_deref(), Some("Coin Desk"));
        assert_eq!(
            articles[0].published_at.as_deref(),
            Some("Tue, 04 Aug 2026 12:00:00 GMT")
        );
        assert_eq!(articles[0].sentiment, Sentiment::Positive);

        assert_eq!(articles[1].title, "Stocks plunge on warning");
        assert_eq!(articles[1].source, None);
        assert_eq!(articles[1].published_at, None);
        assert_eq!(articles[1].sentiment, Sentiment::Negative);
    }

    #[test]
    fn serialised_shape_has_required_null_fields() {
        let articles = parse_news_feed(
            r#"<rss><item><title>Example</title><link>https://example.com</link></item></rss>"#,
        );
        let value = serde_json::to_value(&articles).unwrap();
        assert_eq!(
            value,
            json!([{
                "title": "Example",
                "link": "https://example.com",
                "source": null,
                "publishedAt": null,
                "sentiment": "neutral"
            }])
        );
    }
}
