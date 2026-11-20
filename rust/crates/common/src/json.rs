use serde::Serialize;
use serde_json::{Number, Value};

/// Serialise a response the way `JSON.stringify` does for numbers: integral
/// doubles become integer JSON numbers (`27.0` -> `27`) while fractional values
/// stay as they are. This keeps wire shape comparisons with the TS routes exact.
pub fn js_json<T: Serialize>(value: &T) -> Value {
    normalise(serde_json::to_value(value).expect("response type must serialise"))
}

fn normalise(value: Value) -> Value {
    match value {
        Value::Number(number) => {
            if let Some(float) = number.as_f64()
                && float.is_finite()
                && float.fract() == 0.0
                && float >= i64::MIN as f64
                && float <= i64::MAX as f64
            {
                return Value::Number(Number::from(float as i64));
            }
            Value::Number(number)
        }
        Value::Array(items) => Value::Array(items.into_iter().map(normalise).collect()),
        Value::Object(entries) => Value::Object(
            entries
                .into_iter()
                .map(|(key, value)| (key, normalise(value)))
                .collect(),
        ),
        other => other,
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn matches_json_stringify_number_format() {
        assert_eq!(
            js_json(&json!({ "whole": 27.0, "fraction": 0.5, "nested": [1.0, null] })),
            json!({ "whole": 27, "fraction": 0.5, "nested": [1, null] })
        );
    }
}
