# Rust porting guide: US Eastern time and Google News RSS

This guide records how to reproduce two pieces of TypeScript behavior in Rust:

1. ET offset and ET calendar parts from `Intl.DateTimeFormat`, used for
   Polymarket slug generation in `packages/lib/src/polymarket.ts:179-228`.
2. The hand-written Google News RSS parser in `packages/lib/src/news.ts:56-112`.

It is written against the TypeScript currently in the repo, not against an
idealized version of either behavior. Every source claim is linked to a primary
source (crate docs, ECMA-402 / MDN, or the IANA tzdb).

## Crate versions

Pin these versions; the APIs below were checked against these exact docs.

| Crate | Version | Docs | Repository |
|---|---|---|---|
| `chrono` | 0.4.45 | <https://docs.rs/chrono/0.4.45/chrono/> | <https://github.com/chronotope/chrono> |
| `chrono-tz` | 0.10.4 | <https://docs.rs/chrono-tz/0.10.4/chrono_tz/> | <https://github.com/chronotope/chrono-tz> |
| `quick-xml` | 0.42.0 | <https://docs.rs/quick-xml/0.42.0/quick_xml/> | <https://github.com/tafia/quick-xml> |
| `regex` | 1.13.2 | <https://docs.rs/regex/1.13.2/regex/> | <https://github.com/rust-lang/regex> |

Versions confirmed from the crates.io API: <https://crates.io/api/v1/crates/chrono>,
<https://crates.io/api/v1/crates/chrono-tz>, <https://crates.io/api/v1/crates/quick-xml>,
<https://crates.io/api/v1/crates/regex>.

---

# Part 1 — ET offset and ET date parts

## 1.1 What the TypeScript actually does

`etOffsetHours` (polymarket.ts:180-191) formats an instant with
`Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "longOffset" })`,
takes the `timeZoneName` part, and parses it with `/GMT([+-])(\d{2}):?(\d{2})?/`:

- `match` absent → returns `0` (silently treats the zone as UTC).
- Otherwise `sign * (hours + minutes / 60)`, where `sign` is `-1` for `-` and
  `+1` otherwise. So `GMT-04:00` → `-4`, `GMT-05:00` → `-5`.

`etDateParts` (polymarket.ts:193-202) formats with
`{ timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" }`
and returns `{ month: month.toLowerCase(), day, year }` as strings.

The two consumers matter because they use the offset differently:

- `fourHourSlugs` (204-218) computes the offset **once, at `now`**, shifts the
  instant into an "ET-numbered" epoch, floors to a 4-hour boundary, then shifts
  back with the *same* offset. It does **not** recompute the offset per boundary.
- `dailySlugs` (221-228) adds `day * 86_400_000` **UTC milliseconds** to `now`,
  then formats ET calendar parts for each shifted instant. It does **not** add
  local calendar days.

Reproducing the original means keeping those two conventions, even though they
are approximations around DST transitions.

## 1.2 What ECMA-402 specifies (and what it does not)

`formatToParts()` returns an array of records with `type` and `value` fields;
`timeZoneName` is one of the possible `type`s
(<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatToParts>).

The `timeZoneName` option accepts `"short"`, `"long"`, `"shortOffset"`,
`"longOffset"`, `"shortGeneric"`, `"longGeneric"`; MDN gives `"longOffset"` the
example `GMT-08:00`
(<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#timezonename>).
The ECMA-402 components table lists the same six values
(<https://tc39.es/ecma402/#table-datetimeformat-components>).

Crucially, ECMA-402 does **not** mandate the literal string `GMT-04:00`. In
`FormatDateTime`, the `timeZoneName` part is an implementation-defined locale
data string whose value "may depend on the `[[InDST]]` field of `localTime`" for
`short`, `long`, `shortOffset`, or `longOffset`
(<https://tc39.es/ecma402/#sec-formatdatetime>). The `GMT±HH:MM` spelling is a
V8/ICU (CLDR) convention that the TS regex happens to rely on.

For calendar parts, the spec says a `month` part's value is the 1-based month
and `day`/`year` are the corresponding local fields
(<https://tc39.es/ecma402/#sec-formatdatetime>, Table 16). `month: "long"` and
`day: "numeric"` are implementation-defined localized strings; for `en-US` they
are the full English month name and an unpadded day number.

**Consequence for Rust:** do not try to generate and re-parse an ICU-style
`GMT-04:00` string. Compute the numeric offset and calendar parts directly from
the timezone database, as shown below. The ICU string is an output format, not
an input format.

## 1.3 IANA tzdb facts for `America/New_York`

The IANA timezone database is the primary source at
<https://www.iana.org/time-zones>, with the raw source files at
<https://data.iana.org/time-zones/tzdb/>.

`northamerica` defines:

```text
Zone America/New_York  -4:56:02 -  LMT  1883 Nov 18 17:00u
                       -5:00    US  E%sT 1920
                       ...
                       -5:00    US  E%sT
```

and the relevant `US` rules are:

```text
Rule  US  1967  2006  -  Oct  lastSun  2:00  0     S
Rule  US  1987  2006  -  Apr  Sun>=1  2:00  1:00  D
Rule  US  2007  max   -  Mar  Sun>=8  2:00  1:00  D
Rule  US  2007  max   -  Nov  Sun>=1  2:00  0     S
```

Source: <https://data.iana.org/time-zones/tzdb/northamerica>.

So for modern dates the offset is `-05:00` (EST) in winter and `-04:00` (EDT)
from the second Sunday in March to the first Sunday in November. `chrono-tz`
compiles these rules into its `Tz` enum; `chrono_tz::Tz::America__New_York` is a
variant whose docs display the identifier `America/New_York`
(<https://docs.rs/chrono-tz/0.10.4/chrono_tz/enum.Tz.html>).

## 1.4 Rust reproduction

Relevant APIs:

- `DateTime::with_timezone::<Tz2>(&self, tz: &Tz2) -> DateTime<Tz2>` changes the
  associated timezone without changing the instant
  (<https://docs.rs/chrono/0.4.45/chrono/struct.DateTime.html#method.with_timezone>).
- `chrono::Datelike` provides `year() -> i32`, `month() -> u32` (1-based), and
  `day() -> u32` (1-based)
  (<https://docs.rs/chrono/0.4.45/chrono/trait.Datelike.html>).
- `chrono_tz::TzOffset::fix()` (from the `Offset` trait) returns a `FixedOffset`,
  whose `local_minus_utc()` gives **seconds east of UTC**
  (<https://docs.rs/chrono-tz/0.10.4/chrono_tz/struct.TzOffset.html>,
  <https://docs.rs/chrono/0.4.45/chrono/trait.TimeZone.html>).
- `format("%B")` yields the full English month name; `%z` yields `+0930` and
  `%:z` yields `+09:30`
  (<https://docs.rs/chrono/0.4.45/chrono/format/strftime/index.html>).

```rust
use chrono::{DateTime, Datelike, Duration, Offset, Utc};
use chrono_tz::Tz;

const HOUR_4_SECS: f64 = 4.0 * 3600.0;
const DAY_MS: i64 = 86_400_000;

/// Same sign convention as the TS helper: west of UTC is negative.
fn et_offset_hours(now: DateTime<Utc>) -> f64 {
    let et = now.with_timezone(&Tz::America__New_York);
    // local_minus_utc() is seconds EAST of UTC, so -4h for EDT.
    et.offset().fix().local_minus_utc() as f64 / 3600.0
}

fn et_date_parts(now: DateTime<Utc>) -> (String, String, String) {
    let et = now.with_timezone(&Tz::America__New_York);
    // %B is the full English month name; to_lowercase() mirrors the TS helper.
    let month = et.format("%B").to_string().to_lowercase();
    // day() is already unpadded, matching day: "numeric" in en-US.
    (month, et.day().to_string(), et.year().to_string())
}

fn four_hour_slugs(short: &str, now: DateTime<Utc>) -> Vec<String> {
    let offset = et_offset_hours(now); // computed ONCE, as in the TS
    let now_et = now.timestamp_millis() as f64 / 1000.0 + offset * 3600.0;
    let current_start_et = (now_et / HOUR_4_SECS).floor() * HOUR_4_SECS;

    (0..3)
        .map(|k| {
            let start_utc =
                current_start_et + k as f64 * HOUR_4_SECS - offset * 3600.0;
            format!("{short}-updown-4h-{}", start_utc.round() as i64)
        })
        .collect()
}

fn daily_slugs(name: &str, now: DateTime<Utc>) -> Vec<String> {
    (0..3)
        .map(|day| {
            // UTC milliseconds, exactly like now.getTime() + day * 86_400_000.
            let shifted = now + Duration::milliseconds(day * DAY_MS);
            let (month, day_num, year) = et_date_parts(shifted);
            format!("{name}-up-or-down-on-{month}-{day_num}-{year}")
        })
        .collect()
}
```

If you need to accept an arbitrary IANA identifier at runtime, `Tz` implements
`FromStr`, so `"America/New_York".parse::<Tz>()` works
(<https://docs.rs/chrono-tz/0.10.4/chrono_tz/enum.Tz.html>).

## 1.5 DST and sign pitfalls

1. **Query the offset for the instant, never once per day.** ET is `-05:00`
   (EST) and `-04:00` (EDT) depending on the instant. A hardcoded `-5` breaks
   half the year.
2. **Do not invert the sign.** `local_minus_utc()` is east-positive; the TS
   helper returns west-negative because `GMT-04:00` encodes `-4`. Negating it
   twice (or using `utc_minus_local`) silently shifts slugs by 8–10 hours.
3. **Keep the TS's single-offset approximation in `fourHourSlugs`.** The
   original uses the offset at `now` for all three 4-hour windows. Recomputing
   per `k` would diverge from the TS exactly on the DST transition day.
4. **Keep the TS's UTC-day arithmetic in `dailySlugs`.** Adding local days or
   using `checked_add_days` changes the date sequence across a DST boundary;
   the original adds 86,400,000 UTC ms per step.
5. **Watch the floor for pre-1970 instants.** The TS does a floating-point
   `Math.floor`, which floors toward −∞. Rust's `as i64` truncates toward zero;
   the `f64::floor()` above preserves the TS semantics.
6. **`GMT-04:00` is not a chrono offset literal.** `%z` parses `+0930`-style
   offsets, `%:z` parses/formats `+09:30`; neither accepts a `GMT` prefix
   (<https://docs.rs/chrono/0.4.45/chrono/format/strftime/index.html>). If you
   absolutely must parse an ICU string, strip the literal `GMT` and parse the
   remainder yourself; the robust path is to derive the offset from `Tz`, as above.
7. **The TS regex is unanchored and forgiving.** It matches `GMT-04`, `GMT-0400`,
   and `GMT-04:00`, and returns `-4` for all. It returns `0` when the part is
   missing. A strict parser that errors on an unexpected string is a
   behavioral change; decide deliberately whether to keep the `0` fallback.

---

# Part 2 — Google News RSS hand-parsing

## 2.1 What the TypeScript actually does

From `packages/lib/src/news.ts`:

- Feed URL (line 87):
  `` `${GOOGLE_NEWS_RSS_BASE}?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en` ``
  where `GOOGLE_NEWS_RSS_BASE = "https://news.google.com/rss/search"`
  (`packages/lib/src/constants.ts`).
- Items (line 92): `xml.match(/<item>[\s\S]*?<\/item>/g) ?? []` — case-sensitive,
  non-greedy, requires literal `<item>` with no attributes.
- Tags (71-74): `new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)</" + tag + ">", "i")`
  — case-insensitive, allows attributes after the tag name, first match only.
- CDATA (66-69): `text.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/)`; if it matches, use
  group 1, else use the whole text; **then** `.trim()`, **then** decode entities.
  Entities inside CDATA are decoded too. Note the match is attempted on the raw
  text *before* trimming, so leading/trailing whitespace prevents CDATA stripping.
- Entity decode (56-64), in this exact order: `&lt;` → `<`, `&gt;` → `>`,
  `&quot;` → `"`, `&#0?39;` → `'`, `&apos;` → `'`, and finally `&amp;` → `&`.
- Title suffix (96-101): if `<source>` produced a nonempty string, build
  `" - ${source}"`; if `rawTitle.endsWith(suffix)`, strip it with
  `rawTitle.slice(0, -suffix.length)`.
- Filter (111): keep only articles where `title.length > 0 && link.length > 0`.

## 2.2 Approach A — `regex`, closest to the TS

Use `regex` 1.13.2. `Regex::captures` / `captures_iter` replace `.exec()` / the
`g` flag
(<https://docs.rs/regex/1.13.2/regex/struct.Regex.html>).

```rust
use regex::Regex;

#[derive(Debug)]
struct Article {
    title: String,
    link: String,
    source: Option<String>,
    published_at: Option<String>,
}

/// Exact order from news.ts: decodeEntities(). `&amp;` MUST be last.
fn decode_entities(s: &str) -> String {
    s.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&#039;", "'") // the `0?` in TS's &#0?39;
        .replace("&apos;", "'")
        .replace("&amp;", "&")
}

/// Match on the RAW text first, as the TS does; trimming happens after.
fn strip_cdata(text: &str, re: &Regex) -> String {
    let inner = match re.captures(text) {
        Some(c) => c[1].to_string(),
        None => text.to_string(),
    };
    decode_entities(inner.trim())
}

fn extract_tag(block: &str, tag: &str, cdata_re: &Regex) -> Option<String> {
    let pattern = format!(r"(?i)<{tag}[^>]*>([\s\S]*?)</{tag}>");
    let re = Regex::new(&pattern).ok()?;
    let caps = re.captures(block)?;
    Some(strip_cdata(&caps[1], cdata_re))
}

fn parse_feed(xml: &str) -> Vec<Article> {
    let item_re = Regex::new(r"<item>[\s\S]*?</item>").unwrap();
    // `\z` is an unambiguous end-of-haystack anchor.
    let cdata_re = Regex::new(r"(?s)^<!\[CDATA\[([\s\S]*)\]\]>\z").unwrap();

    item_re
        .find_iter(xml)
        .filter_map(|m| {
            let item = &xml[m.range()];
            let raw_title = extract_tag(item, "title", &cdata_re).unwrap_or_default();
            let source = extract_tag(item, "source", &cdata_re);

            // strip_suffix is byte-safe and mirrors JS endsWith + slice for
            // valid Unicode strings (see 2.5).
            let suffix = source.as_ref().map(|s| format!(" - {s}"));
            let title = match suffix {
                Some(s) => raw_title.strip_suffix(&s).unwrap_or(&raw_title).to_string(),
                None => raw_title,
            };

            let article = Article {
                title,
                link: extract_tag(item, "link", &cdata_re).unwrap_or_default(),
                source,
                published_at: extract_tag(item, "pubDate", &cdata_re),
            };
            (!article.title.is_empty() && !article.link.is_empty()).then_some(article)
        })
        .collect()
}
```

Notes on exactness:

- The TS item regex is case-sensitive and has no attributes on `<item>`; the
  Rust pattern is the same. If the feed emits `<item >` or `<ITEM>`, the TS
  skips it and so should the port.
- `(?i)` is Rust's inline case-insensitive flag, equivalent to JS `i`.
- `[\s\S]` works in Rust regex and matches any character including newlines.
  In JS it matches any UTF-16 code unit; in Rust it matches any Unicode scalar.
  This does not change the content captured from well-formed UTF-8 RSS.
- The TS `new RegExp(...)` uses tag names as raw interpolated text; here all
  four tag names are compile-time literals, so no escaping is needed. If the
  tag ever becomes dynamic, use `regex::escape(tag)`.

## 2.3 Approach B — `quick-xml`

`quick_xml::reader::Reader::from_str` + `read_event_into` gives a real XML event
stream: `Event::Start`, `Event::Text`, `Event::CData`, `Event::End`, `Event::Eof`
(<https://docs.rs/quick-xml/0.42.0/quick_xml/reader/struct.Reader.html>). This
handles `<source url="...">` attributes and nested markup more robustly than
the regex, but has different failure modes from the forgiving TS parser.

```rust
use quick_xml::events::Event;
use quick_xml::reader::Reader;

// Reuse decode_entities() from 2.2: quick-xml leaves Event::Text and
// Event::CData payloads raw, so the same decoder is applied to both.
fn parse_feed_qx(xml: &str) -> Vec<Article> {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut in_item = false;
    let mut current: Option<usize> = None; // 0 title, 1 link, 2 source, 3 pubDate
    let mut fields: [Option<String>; 4] = Default::default();
    let mut out = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => match e.name().as_ref() {
                b"item" => {
                    in_item = true;
                    fields = Default::default();
                }
                b"title" if in_item => current = Some(0),
                b"link" if in_item => current = Some(1),
                b"source" if in_item => current = Some(2),
                b"pubDate" if in_item => current = Some(3),
                _ => {}
            },
            Ok(Event::Text(e)) | Ok(Event::CData(e)) => {
                if let Some(i) = current {
                    let decoded = decode_entities(String::from_utf8_lossy(&e).trim());
                    match &mut fields[i] {
                        Some(s) => s.push_str(&decoded),
                        slot => *slot = Some(decoded),
                    }
                }
            }
            Ok(Event::End(e)) => match e.name().as_ref() {
                b"item" => {
                    in_item = false;
                    current = None;
                    let raw_title = fields[0].take().unwrap_or_default();
                    let source = fields[2].take();
                    let suffix = source.as_ref().map(|s| format!(" - {s}"));
                    let title = match suffix {
                        Some(s) => raw_title.strip_suffix(&s).unwrap_or(&raw_title).to_string(),
                        None => raw_title,
                    };
                    let article = Article {
                        title,
                        link: fields[1].take().unwrap_or_default(),
                        source,
                        published_at: fields[3].take(),
                    };
                    if !article.title.is_empty() && !article.link.is_empty() {
                        out.push(article);
                    }
                }
                _ => current = None,
            },
            Ok(Event::Eof) => break,
            Err(_) => break, // TS parser is forgiving; pick a policy explicitly
            _ => {}
        }
        buf.clear();
    }
    out
}
```

**quick-xml does not replace the TS decoder for free.** `escape::unescape(raw)`
decodes XML named entities (`amp`, `lt`, `gt`, `quot`, `apos`) and decimal/hex
numeric character references, and with the `escape-html` feature it recognizes
all HTML5 escapes
(<https://docs.rs/quick-xml/0.42.0/quick_xml/escape/fn.unescape.html>,
<https://docs.rs/quick-xml/0.42.0/quick_xml/escape/index.html>). That is a
*superset* of the TS six-replacement chain, so using it directly would decode
`&#x27;`, `&nbsp;`, etc. that the TS leaves literal. If exact parity matters,
keep `decode_entities()` and apply it to both text and CDATA events, as above.

Other differences to accept deliberately: quick-xml is a strict parser (malformed
XML becomes `Err`, while the TS regex keeps going), and `extractTag` takes the
first match only while the event loop above concatenates all text inside a tag.

## 2.4 Entity-decoding order pitfalls

- **`&amp;` must be last.** `&amp;lt;` → `&lt;` → `<` if `&amp;` were decoded
  early, which is a double decode. The TS order avoids that.
- **`&#0?39;` matches two spellings.** The TS regex decodes both `&#39;` and
  `&#039;`. A single `.replace("&#39;", "'")` would miss the leading-zero form.
- **The TS decoder is deliberately small.** It does not decode `&nbsp;`,
  `&mdash;`, `&#x27;`, `&AMP;`, or any other entity. `quick-xml::escape::unescape`
  would decode more, so "more correct XML" is not "same output".
- **Case sensitivity.** The TS `.replace` calls are case-sensitive; XML named
  entities are also case-sensitive, so `&AMP;` stays literal in both.

## 2.5 UTF-8 bytes vs JS UTF-16 code units

JavaScript `String.length` is the number of UTF-16 code units, and
`endsWith`/`slice` index by those units
(<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/length>,
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith>,
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/slice>).
Rust `str::len()` counts UTF-8 bytes, and `&s[a..b]` must land on char boundaries.

Practical consequences for this parser:

- **Suffix stripping.** `raw_title.endsWith(suffix)` followed by
  `raw_title.slice(0, -suffix.length)` is faithfully reproduced by
  `raw_title.strip_suffix(&suffix)`. This is byte-safe in Rust and gives the
  same result for well-formed strings, including astral characters (emoji):
  JS removes two code units per emoji and `strip_suffix` removes the same bytes.
  Do **not** try to emulate `-suffix.length` by computing a byte length from the
  JS value; that is where panics on non-char-boundary slices come from.
- **Empty checks.** `title.length > 0` maps to `!title.is_empty()`.
- **Exact lone-surrogate behavior.** JS strings can contain unpaired surrogates,
  which cannot exist in Rust `str`. To mimic `-n` by UTF-16 unit count, encode
  with `str::encode_utf16()`, slice the `Vec<u16>`, then `String::from_utf16_lossy()`.
  The lossy conversion replaces lone surrogates with U+FFFD, so it is not a
  perfect match; for RSS titles this edge case is not worth modeling.
- **Regex `.` / `[\s\S]`.** Rust regex operates on Unicode scalars; JS regex
  (without `u`) operates on UTF-16 code units. For valid Unicode RSS content the
  captured text is identical.

## 2.6 Feed URL encoding

`encodeURIComponent` escapes everything except `A–Z a–z 0–9 - _ . ! ~ * ' ( )`
and emits UTF-8 percent escapes
(<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent>).
Do not substitute an `application/x-www-form-urlencoded` helper blindly: it
encodes `!'()*` and turns spaces into `+`, which differs from the TS query
string. If exact byte-level parity of the request URL matters, implement that
allow-list explicitly (or use `percent_encoding` with a matching `AsciiSet`).

---

## Source index

**Crate docs / APIs**

- <https://docs.rs/chrono/0.4.45/chrono/>
- <https://docs.rs/chrono/0.4.45/chrono/struct.DateTime.html#method.with_timezone>
- <https://docs.rs/chrono/0.4.45/chrono/trait.Datelike.html>
- <https://docs.rs/chrono/0.4.45/chrono/format/strftime/index.html>
- <https://docs.rs/chrono/0.4.45/chrono/trait.TimeZone.html>
- <https://docs.rs/chrono-tz/0.10.4/chrono_tz/enum.Tz.html>
- <https://docs.rs/chrono-tz/0.10.4/chrono_tz/struct.TzOffset.html>
- <https://docs.rs/quick-xml/0.42.0/quick_xml/reader/struct.Reader.html>
- <https://docs.rs/quick-xml/0.42.0/quick_xml/escape/fn.unescape.html>
- <https://docs.rs/regex/1.13.2/regex/struct.Regex.html>

**JavaScript / ECMA-402 / MDN**

- <https://tc39.es/ecma402/#sec-formatdatetime>
- <https://tc39.es/ecma402/#table-datetimeformat-components>
- <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#timezonename>
- <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatToParts>
- <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/length>
- <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith>
- <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/slice>
- <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent>

**IANA timezone database**

- <https://www.iana.org/time-zones>
- <https://data.iana.org/time-zones/tzdb/northamerica>
