use crypto_stocks_common::{
    client::{Http, HttpRequest},
    config::Config,
    error::{Error, Result},
    types::{ChatAsset, ChatMessage, LlmProvider, LlmSettings, MarketStats},
};
use serde_json::{Value, json};

struct FreeModelDef {
    id: &'static str,
    #[allow(dead_code)]
    label: &'static str,
    provider: &'static str,
    model_id: &'static str,
}

/// Free models, identical to `FREE_MODELS` in the TS constants module.
static FREE_MODELS: [FreeModelDef; 7] = [
    FreeModelDef {
        id: "gemini-1.5-flash",
        label: "Gemini 1.5 Flash",
        provider: "gemini",
        model_id: "gemini-1.5-flash",
    },
    FreeModelDef {
        id: "gemini-2.0-flash",
        label: "Gemini 2.0 Flash",
        provider: "gemini",
        model_id: "gemini-2.0-flash",
    },
    FreeModelDef {
        id: "gemini-1.5-pro",
        label: "Gemini 1.5 Pro",
        provider: "gemini",
        model_id: "gemini-1.5-pro",
    },
    FreeModelDef {
        id: "groq-gpt-oss-120b",
        label: "Groq GPT-OSS 120B",
        provider: "groq",
        model_id: "openai/gpt-oss-120b",
    },
    FreeModelDef {
        id: "groq-gpt-oss-20b",
        label: "Groq GPT-OSS 20B",
        provider: "groq",
        model_id: "openai/gpt-oss-20b",
    },
    FreeModelDef {
        id: "groq-llama-3.3-70b",
        label: "Groq Llama 3.3 70B",
        provider: "groq",
        model_id: "llama-3.3-70b-versatile",
    },
    FreeModelDef {
        id: "groq-llama-3.1-8b",
        label: "Groq Llama 3.1 8B",
        provider: "groq",
        model_id: "llama-3.1-8b-instant",
    },
];

fn decimals_for_price(price: f64) -> usize {
    let abs = price.abs();
    if abs >= 1.0 {
        2
    } else if abs >= 0.01 {
        4
    } else {
        6
    }
}

/// `Intl.NumberFormat("en-US", { minimumFractionDigits, maximumFractionDigits })`.
fn format_number(amount: f64, decimals: usize) -> String {
    let sign = if amount < 0.0 { "-" } else { "" };
    let rounded = format!("{:.*}", decimals, amount.abs());
    let (whole, fraction) = match rounded.split_once('.') {
        Some((whole, fraction)) => (whole, Some(fraction)),
        None => (rounded.as_str(), None),
    };
    let mut grouped = String::new();
    for (i, ch) in whole.chars().enumerate() {
        if i > 0 && (whole.len() - i) % 3 == 0 {
            grouped.push(',');
        }
        grouped.push(ch);
    }
    match fraction {
        Some(fraction) => format!("{sign}{grouped}.{fraction}"),
        None => format!("{sign}{grouped}"),
    }
}

fn format_currency(amount: f64) -> String {
    format!("${}", format_number(amount, decimals_for_price(amount)))
}

/// Port of `buildSystemInstruction` in the chat route.
pub fn build_system_instruction(
    asset: &ChatAsset,
    live_price: Option<f64>,
    market_stats: Option<&MarketStats>,
    description: Option<&str>,
) -> String {
    let price_line = match live_price {
        Some(price) => format!("Current live price: {}.", format_currency(price)),
        None => "Live price is currently unavailable.".to_owned(),
    };

    let stats_line = match market_stats {
        Some(stats) if stats.change_percent.is_some() || stats.high.is_some() => [
            Some("Live chart data for the currently loaded window:".to_owned()),
            stats.change_percent.map(|value| {
                format!(
                    "change {}{:.2}% since session open",
                    if value >= 0.0 { "+" } else { "" },
                    value
                )
            }),
            stats
                .session_open
                .map(|value| format!("open {}", format_currency(value))),
            stats
                .high
                .map(|value| format!("high {}", format_currency(value))),
            stats
                .low
                .map(|value| format!("low {}", format_currency(value))),
        ]
        .into_iter()
        .flatten()
        .collect::<Vec<_>>()
        .join(", "),
        _ => String::new(),
    };

    [
        "You are a concise financial assistant embedded in a live crypto/stocks dashboard.".to_owned(),
        format!(
            "The user currently has {} ({}, a {}) selected.",
            asset.name,
            asset.symbol,
            if asset.kind == crypto_stocks_common::types::AssetKind::Crypto {
                "cryptocurrency"
            } else {
                "stock/ETF"
            }
        ),
        price_line,
        stats_line,
        description.map(|text| format!("Background: {text}")).unwrap_or_default(),
        "Ground your answers about price action and movement in the live chart data above, not general knowledge. Keep replies short and plain-text. Make clear you are not providing financial advice.".to_owned(),
    ]
    .into_iter()
    .filter(|line| !line.is_empty())
    .collect::<Vec<_>>()
    .join(" ")
}

fn reply_or_empty(value: Option<String>) -> String {
    value
        .map(|text| text.trim().to_owned())
        .filter(|text| !text.is_empty())
        .unwrap_or_else(|| "I couldn't generate a response for that.".to_owned())
}

/// Errors that map to distinct route status codes.
#[derive(Debug)]
pub enum ChatError {
    /// 400 — invalid request (e.g. custom provider without a base URL).
    BadRequest(&'static str),
    /// 500 — a required server API key is missing.
    NotConfigured(&'static str),
    /// 502 — any upstream/provider failure (message is logged, not returned).
    Upstream(String),
}

/// Gemini `generateContent`.
pub async fn generate_gemini(
    http: &Http,
    base: &str,
    api_key: &str,
    system_instruction: &str,
    messages: &[ChatMessage],
    model: &str,
) -> Result<String> {
    let url = format!("{base}/models/{model}:generateContent");
    let contents = messages
        .iter()
        .map(|message| {
            json!({
                "role": if message.role == "assistant" { "model" } else { "user" },
                "parts": [{ "text": message.content }]
            })
        })
        .collect::<Vec<_>>();
    let body = serde_json::to_vec(&json!({
        "systemInstruction": { "parts": [{ "text": system_instruction }] },
        "contents": contents
    }))
    .map_err(|e| Error::parse(e.to_string()))?;

    let request = HttpRequest::post(url, body)?
        .header("Content-Type", "application/json")?
        .header("X-goog-api-key", api_key)?;
    let response = http.send(&request).await?;
    if !response.status().is_success() {
        let status = response.status().as_u16();
        let text = response.text().await.unwrap_or_default();
        let message = serde_json::from_str::<Value>(&text)
            .ok()
            .and_then(|json| {
                json.get("error")
                    .and_then(|e| e.get("message"))
                    .and_then(Value::as_str)
                    .map(str::to_owned)
            })
            .unwrap_or_else(|| format!("Gemini returned status {status}"));
        return Err(Error::Upstream(message));
    }
    let data: Value = response
        .json()
        .await
        .map_err(|e| Error::Parse(format!("invalid JSON: {e}")))?;
    let reply = data
        .get("candidates")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .and_then(|candidate| candidate.get("content"))
        .and_then(|content| content.get("parts"))
        .and_then(Value::as_array)
        .map(|parts| {
            parts
                .iter()
                .map(|part| part.get("text").and_then(Value::as_str).unwrap_or(""))
                .collect::<String>()
        });
    Ok(reply_or_empty(reply))
}

/// OpenAI-compatible chat completions (also used for Groq and custom providers).
pub async fn generate_openai(
    http: &Http,
    base: &str,
    api_key: &str,
    model: &str,
    system_instruction: &str,
    messages: &[ChatMessage],
) -> Result<String> {
    let base = base.trim_end_matches('/');
    let url = format!("{base}/chat/completions");
    let mut all_messages = vec![json!({ "role": "system", "content": system_instruction })];
    all_messages.extend(messages.iter().map(|message| {
        json!({
            "role": if message.role == "assistant" { "assistant" } else { "user" },
            "content": message.content
        })
    }));
    let body = serde_json::to_vec(&json!({ "model": model, "messages": all_messages }))
        .map_err(|e| Error::parse(e.to_string()))?;
    let request = HttpRequest::post(url, body)?
        .header("Content-Type", "application/json")?
        .header("Authorization", &format!("Bearer {api_key}"))?;
    let response = http.send(&request).await?;
    if !response.status().is_success() {
        let status = response.status().as_u16();
        let text = response.text().await.unwrap_or_default();
        return Err(Error::Upstream(format!(
            "OpenAI request failed: {status} {text}"
        )));
    }
    let data: Value = response
        .json()
        .await
        .map_err(|e| Error::Parse(format!("invalid JSON: {e}")))?;
    let reply = data
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(Value::as_str)
        .map(str::to_owned);
    Ok(reply_or_empty(reply))
}

/// Anthropic Messages API.
pub async fn generate_anthropic(
    http: &Http,
    base: &str,
    api_key: &str,
    model: &str,
    system_instruction: &str,
    messages: &[ChatMessage],
) -> Result<String> {
    let url = format!("{base}/messages");
    let mapped = messages
        .iter()
        .map(|message| {
            json!({
                "role": if message.role == "assistant" { "assistant" } else { "user" },
                "content": message.content
            })
        })
        .collect::<Vec<_>>();
    let body = serde_json::to_vec(&json!({
        "model": model,
        "system": system_instruction,
        "max_tokens": 1024,
        "messages": mapped
    }))
    .map_err(|e| Error::parse(e.to_string()))?;
    let request = HttpRequest::post(url, body)?
        .header("Content-Type", "application/json")?
        .header("x-api-key", api_key)?
        .header("anthropic-version", "2023-06-01")?;
    let response = http.send(&request).await?;
    if !response.status().is_success() {
        let status = response.status().as_u16();
        let text = response.text().await.unwrap_or_default();
        return Err(Error::Upstream(format!(
            "Anthropic request failed: {status} {text}"
        )));
    }
    let data: Value = response
        .json()
        .await
        .map_err(|e| Error::Parse(format!("invalid JSON: {e}")))?;
    let reply = data
        .get("content")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .and_then(|item| item.get("text"))
        .and_then(Value::as_str)
        .map(str::to_owned);
    Ok(reply_or_empty(reply))
}

/// Provider dispatch, matching the chat route's byok -> free -> gemini-default
/// precedence. Returns a typed error so the route can pick the exact status.
pub async fn reply(
    http: &Http,
    config: &Config,
    settings: Option<&LlmSettings>,
    free_model_id: Option<&str>,
    system_instruction: &str,
    messages: &[ChatMessage],
) -> std::result::Result<String, ChatError> {
    let upstream = |error: Error| ChatError::Upstream(error.to_string());

    if let Some(settings) = settings.filter(|settings| !settings.api_key.is_empty()) {
        return match settings.provider {
            LlmProvider::Openai => generate_openai(
                http,
                &config.urls.openai,
                &settings.api_key,
                &settings.model,
                system_instruction,
                messages,
            )
            .await
            .map_err(upstream),
            LlmProvider::Anthropic => generate_anthropic(
                http,
                &config.urls.anthropic,
                &settings.api_key,
                &settings.model,
                system_instruction,
                messages,
            )
            .await
            .map_err(upstream),
            LlmProvider::Groq => generate_openai(
                http,
                &config.urls.groq,
                &settings.api_key,
                &settings.model,
                system_instruction,
                messages,
            )
            .await
            .map_err(upstream),
            LlmProvider::Custom => {
                let Some(base) = settings.custom_base_url.as_deref() else {
                    return Err(ChatError::BadRequest(
                        "customBaseUrl is required for the custom provider",
                    ));
                };
                generate_openai(
                    http,
                    base,
                    &settings.api_key,
                    &settings.model,
                    system_instruction,
                    messages,
                )
                .await
                .map_err(upstream)
            }
            LlmProvider::Gemini => generate_gemini(
                http,
                &config.urls.gemini,
                &settings.api_key,
                system_instruction,
                messages,
                &settings.model,
            )
            .await
            .map_err(upstream),
        };
    }

    if let Some(free_id) = free_model_id {
        let fallback = &FREE_MODELS[0];
        let model = FREE_MODELS
            .iter()
            .find(|candidate| candidate.id == free_id)
            .unwrap_or(fallback);
        return match model.provider {
            "groq" => {
                let Some(key) = config.groq_api_key.as_deref() else {
                    return Err(ChatError::NotConfigured(
                        "GROQ_API_KEY is not configured on the server",
                    ));
                };
                generate_openai(
                    http,
                    &config.urls.groq,
                    key,
                    model.model_id,
                    system_instruction,
                    messages,
                )
                .await
                .map_err(upstream)
            }
            _ => {
                let Some(key) = config.gemini_api_key.as_deref() else {
                    return Err(ChatError::NotConfigured(
                        "GEMINI_API_KEY is not configured on the server",
                    ));
                };
                generate_gemini(
                    http,
                    &config.urls.gemini,
                    key,
                    system_instruction,
                    messages,
                    model.model_id,
                )
                .await
                .map_err(upstream)
            }
        };
    }

    let Some(key) = config.gemini_api_key.as_deref() else {
        return Err(ChatError::NotConfigured(
            "GEMINI_API_KEY is not configured on the server",
        ));
    };
    generate_gemini(
        http,
        &config.urls.gemini,
        key,
        system_instruction,
        messages,
        "gemini-1.5-flash",
    )
    .await
    .map_err(upstream)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_currency_like_js_intl() {
        assert_eq!(format_currency(5349.89), "$5,349.89");
        assert_eq!(format_currency(0.5), "$0.5000");
        assert_eq!(format_currency(0.001), "$0.001000");
        assert_eq!(format_currency(-1234.5), "$-1,234.50");
    }

    #[test]
    fn builds_the_expected_system_instruction() {
        let asset = ChatAsset {
            name: "Bitcoin".into(),
            symbol: "BTCUSDT".into(),
            kind: crypto_stocks_common::types::AssetKind::Crypto,
        };
        let stats = MarketStats {
            session_open: Some(100.0),
            high: Some(110.0),
            low: Some(95.0),
            change_percent: Some(5.5),
        };
        let instruction =
            build_system_instruction(&asset, Some(105.5), Some(&stats), Some("Digital cash"));
        assert!(instruction.contains("Current live price: $105.50."));
        assert!(instruction.contains("change +5.50% since session open"));
        assert!(instruction.contains("Background: Digital cash"));
    }
}
