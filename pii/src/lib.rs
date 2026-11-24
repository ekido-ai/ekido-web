//! Personal-detail removal for a customer's rows (ticket C16).
//!
//! Every detector is a plain pattern plus a check that real values pass and look-alikes fail:
//! Aadhaar numbers must pass the Verhoeff check, GSTINs their own check character, PANs must have a valid holder
//! type. Phone numbers and PANs near words like "tracking" or "coupon" are left alone. Names are matched against a
//! list of common Indian first names and surnames, so unusual names are **missed**: this is a safety net that removes
//! what it can find, never a promise that nothing is left. The upload screen shows the preview so the customer can check.
//!
//! Offsets are in Unicode characters (not bytes), so they match what Python and the test set count.

use regex_lite::Regex;
use serde::Serialize;
use std::sync::OnceLock;
use wasm_bindgen::prelude::*;

mod names;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Kind {
    Gstin,
    Email,
    Upi,
    Aadhaar,
    Pan,
    Phone,
    Address,
    Name,
}

impl Kind {
    pub fn label(self) -> &'static str {
        match self {
            Kind::Gstin => "GSTIN",
            Kind::Email => "EMAIL",
            Kind::Upi => "UPI_ID",
            Kind::Aadhaar => "AADHAAR",
            Kind::Pan => "PAN",
            Kind::Phone => "PHONE",
            Kind::Address => "ADDRESS",
            Kind::Name => "NAME",
        }
    }
    pub const ALL: [Kind; 8] = [Kind::Name, Kind::Phone, Kind::Email, Kind::Aadhaar, Kind::Pan, Kind::Gstin, Kind::Upi, Kind::Address];
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Span {
    pub start: usize,
    pub end: usize,
    #[serde(rename = "type")]
    pub kind: Kind,
}

#[derive(Debug, Serialize)]
pub struct Stripped {
    pub redacted: String,
    pub spans: Vec<Span>,
}

// ---------------------------------------------------------------------------------------------- checksums

const D: [[u8; 10]; 10] = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1], [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P: [[u8; 10]; 8] = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1], [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/// The Verhoeff check that Aadhaar numbers pass.
pub fn verhoeff_ok(digits: &str) -> bool {
    let mut check = 0u8;
    for (i, c) in digits.chars().rev().enumerate() {
        let Some(d) = c.to_digit(10) else { return false };
        check = D[check as usize][P[i % 8][d as usize] as usize];
    }
    check == 0 && !digits.is_empty()
}

const GST_CHARS: &str = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/// Format and check character of a 15-character GSTIN.
pub fn gstin_ok(g: &str) -> bool {
    let chars: Vec<char> = g.chars().collect();
    if chars.len() != 15 {
        return false;
    }
    let mut total = 0usize;
    for (i, c) in chars[..14].iter().enumerate() {
        let Some(v) = GST_CHARS.find(*c) else { return false };
        let v = v * if i % 2 == 0 { 1 } else { 2 };
        total += v / 36 + v % 36;
    }
    GST_CHARS.chars().nth((36 - total % 36) % 36) == Some(chars[14])
}

// ---------------------------------------------------------------------------------------------- patterns

fn re(cell: &'static OnceLock<Regex>, pattern: &str) -> &'static Regex {
    cell.get_or_init(|| Regex::new(pattern).expect("a fixed pattern"))
}

macro_rules! pattern {
    ($p:expr) => {{
        static CELL: OnceLock<Regex> = OnceLock::new();
        re(&CELL, $p)
    }};
}

struct Text {
    chars: Vec<char>,
    /// byte offset of each char, plus the total length at the end
    bytes: Vec<usize>,
}

impl Text {
    fn new(s: &str) -> Self {
        let mut bytes: Vec<usize> = s.char_indices().map(|(i, _)| i).collect();
        bytes.push(s.len());
        Text { chars: s.chars().collect(), bytes }
    }
    fn char_at_byte(&self, byte: usize) -> usize {
        self.bytes.binary_search(&byte).unwrap_or_else(|i| i)
    }
    fn alnum(&self, i: isize) -> bool {
        i >= 0 && (i as usize) < self.chars.len() && self.chars[i as usize].is_alphanumeric()
    }
    fn digit(&self, i: isize) -> bool {
        i >= 0 && (i as usize) < self.chars.len() && self.chars[i as usize].is_ascii_digit()
    }
    fn slice(&self, a: usize, b: usize) -> String {
        self.chars[a..b].iter().collect()
    }
    /// The (lower-cased, char-aligned) text of up to `n` characters before `start`.
    fn before(&self, start: usize, n: usize) -> String {
        let from = start.saturating_sub(n);
        self.chars[from..start].iter().flat_map(|c| c.to_lowercase()).collect()
    }
}

fn matches_of(re: &Regex, t: &Text, source: &str) -> Vec<(usize, usize)> {
    re.find_iter(source).map(|m| (t.char_at_byte(m.start()), t.char_at_byte(m.end()))).collect()
}

fn bounded_alnum(t: &Text, a: usize, b: usize) -> bool {
    !t.alnum(a as isize - 1) && !t.alnum(b as isize)
}

fn bounded_digits(t: &Text, a: usize, b: usize) -> bool {
    !t.digit(a as isize - 1) && !t.digit(b as isize)
}

const NOT_A_PHONE: [&str; 12] = ["tracking", "awb", "waybill", "courier", "reference", "ref no", "consignment", "docket", "invoice no", "ट्रैकिंग", "कूरियर", "संदर्भ"];
const IS_A_PHONE: [&str; 8] = ["phone", "mobile", "call", "contact", "whatsapp", "number is", "ph ", "ph:"];
const NOT_A_PAN: [&str; 8] = ["coupon", "promo", "voucher", "code", "offer", "discount", "कूपन", "कोड"];

fn has_cue(context: &str, cues: &[&str]) -> bool {
    cues.iter().any(|c| context.contains(c))
}

/// True when one of the last three words before a PAN-shaped code is "PAN" (or पैन), as in "PAN ABCDE1234F" or "PAN number is ...".
fn says_pan(before: &str) -> bool {
    before.split(|c: char| !c.is_alphanumeric()).filter(|w| !w.is_empty()).rev().take(3).any(|w| w == "pan" || w == "पैन")
}

/// Every candidate span, with the kind that found it. Overlaps are settled afterwards.
fn candidates(source: &str) -> Vec<Span> {
    let t = Text::new(source);
    let mut out = Vec::new();

    for (a, b) in matches_of(pattern!(r"[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]"), &t, source) {
        if bounded_alnum(&t, a, b) && gstin_ok(&t.slice(a, b)) {
            out.push(Span { start: a, end: b, kind: Kind::Gstin });
        }
    }
    for (a, b) in matches_of(pattern!(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}"), &t, source) {
        out.push(Span { start: a, end: b, kind: Kind::Email });
    }
    for (a, b) in matches_of(pattern!(r"[A-Za-z0-9._-]{2,}@[A-Za-z][A-Za-z0-9]+"), &t, source) {
        let next_is_domain = t.chars.get(b) == Some(&'.') && t.alnum(b as isize + 1);
        if !next_is_domain {
            out.push(Span { start: a, end: b, kind: Kind::Upi });
        }
    }
    for (a, b) in matches_of(pattern!(r"[0-9][0-9]{3}[ -]?[0-9]{4}[ -]?[0-9]{4}"), &t, source) {
        let digits: String = t.slice(a, b).chars().filter(|c| c.is_ascii_digit()).collect();
        if bounded_digits(&t, a, b) && t.chars.get(a.wrapping_sub(1)) != Some(&'+') && digits.len() == 12 && verhoeff_ok(&digits) {
            out.push(Span { start: a, end: b, kind: Kind::Aadhaar });
        }
    }
    for (a, b) in matches_of(pattern!(r"[A-Z]{5}[0-9]{4}[A-Z]"), &t, source) {
        let fourth = t.chars[a + 3];
        let before = t.before(a, 25);
        if bounded_alnum(&t, a, b) && ("PCHABGJLFT".contains(fourth) || says_pan(&before)) && !has_cue(&before, &NOT_A_PAN) {
            out.push(Span { start: a, end: b, kind: Kind::Pan });
        }
    }
    for (a, b) in matches_of(pattern!(r"(?:\+91[ -]?|91[ -]?|0)?[5-9][0-9]{4}[ -]?[0-9]{5}"), &t, source) {
        if !bounded_digits(&t, a, b) || t.alnum(a as isize - 1) {
            continue;
        }
        let text = t.slice(a, b);
        let digits: String = text.chars().filter(|c| c.is_ascii_digit()).collect();
        if digits.chars().rev().nth(9) == Some('5') && text.starts_with('5') && !text.contains([' ', '-']) {
            continue; // ten bare digits starting with 5: no mobile series starts with 5, so without a prefix or a gap this is not marked as a phone
        }
        let context = t.before(a, 30);
        if has_cue(&context, &NOT_A_PHONE) && !has_cue(&t.before(a, 12), &IS_A_PHONE) {
            continue; // a tracking or reference number that happens to look like a mobile number
        }
        out.push(Span { start: a, end: b, kind: Kind::Phone });
    }
    for (a, b) in matches_of(
        pattern!(r"(?:Flat|House No\.?|House|Plot|Shop|Door No\.?|Room)\s*[0-9]+[A-Za-z]?(?:[ ,]+[A-Za-z0-9][A-Za-z0-9 ]{1,30}?){1,4}?[ ,]+[1-9][0-9]{5}"),
        &t,
        source,
    ) {
        if !t.digit(b as isize) {
            out.push(Span { start: a, end: b, kind: Kind::Address });
        }
    }
    for (a, b) in matches_of(pattern!(r"(?:फ्लैट|मकान|प्लॉट|दुकान)\s*[0-9]+(?:[ ,]+[\u{0900}-\u{097F}0-9][\u{0900}-\u{097F}0-9 ]{1,30}?){1,4}?[ ,]+[1-9][0-9]{5}"), &t, source) {
        if !t.digit(b as isize) {
            out.push(Span { start: a, end: b, kind: Kind::Address });
        }
    }
    out.extend(names::find(&t.chars));
    out
}

/// Which kind wins when two spans overlap: the more specific pattern first.
fn rank(kind: Kind) -> u8 {
    match kind {
        Kind::Gstin => 0,
        Kind::Email => 1,
        Kind::Upi => 2,
        Kind::Aadhaar => 3,
        Kind::Pan => 4,
        Kind::Phone => 5,
        Kind::Address => 6,
        Kind::Name => 7,
    }
}

/// The spans to remove, in order, with no overlaps.
pub fn detect(source: &str) -> Vec<Span> {
    let mut all = candidates(source);
    all.sort_by_key(|s| (rank(s.kind), s.start, std::cmp::Reverse(s.end)));
    let mut kept: Vec<Span> = Vec::new();
    for span in all {
        if kept.iter().all(|k| span.end <= k.start || span.start >= k.end) {
            kept.push(span);
        }
    }
    kept.sort_by_key(|s| s.start);
    kept
}

/// The text with every detected span replaced by `[KIND]`, and the spans that were replaced.
pub fn strip(source: &str) -> Stripped {
    let spans = detect(source);
    let chars: Vec<char> = source.chars().collect();
    let mut redacted = String::with_capacity(source.len());
    let mut at = 0;
    for span in &spans {
        redacted.extend(&chars[at..span.start]);
        redacted.push('[');
        redacted.push_str(span.kind.label());
        redacted.push(']');
        at = span.end;
    }
    redacted.extend(&chars[at..]);
    Stripped { redacted, spans }
}

/// For the browser: `strip` as a JSON string, `{"redacted": ..., "spans": [{"start", "end", "type"}]}`.
#[wasm_bindgen]
pub fn strip_json(source: &str) -> String {
    serde_json::to_string(&strip(source)).unwrap_or_else(|_| String::from("{\"redacted\":\"\",\"spans\":[]}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn found(text: &str) -> Vec<(String, &'static str)> {
        let chars: Vec<char> = text.chars().collect();
        detect(text).into_iter().map(|s| (chars[s.start..s.end].iter().collect(), s.kind.label())).collect()
    }

    #[test]
    fn verhoeff_accepts_a_valid_number_and_rejects_a_changed_digit() {
        let valid = (0..10).map(|d| format!("23456789012{d}")).find(|n| verhoeff_ok(n)).expect("one check digit works");
        let mut bad: Vec<char> = valid.chars().collect();
        bad[11] = if bad[11] == '9' { '0' } else { char::from_digit(bad[11].to_digit(10).unwrap() + 1, 10).unwrap() };
        assert!(!verhoeff_ok(&bad.into_iter().collect::<String>()));
        assert!(!verhoeff_ok(""));
    }

    #[test]
    fn a_valid_aadhaar_in_all_three_forms_is_found_and_a_look_alike_is_not() {
        let valid = (0..10).map(|d| format!("23456789012{d}")).find(|n| verhoeff_ok(n)).unwrap();
        let spaced = format!("{} {} {}", &valid[..4], &valid[4..8], &valid[8..]);
        let dashed = spaced.replace(' ', "-");
        for form in [&valid, &spaced, &dashed] {
            assert_eq!(found(&format!("Aadhaar {form} hai")), vec![(form.clone(), "AADHAAR")]);
        }
        let invalid = (0..10).map(|d| format!("23456789012{d}")).find(|n| !verhoeff_ok(n)).unwrap();
        assert_eq!(found(&format!("courier reference {invalid} issued")), vec![]);
        assert_eq!(found(&format!("{valid}5")), vec![]); // part of a longer number
    }

    #[test]
    fn phones_in_common_forms_are_found() {
        for number in ["9876543210", "+919876543210", "+91 98765 43210", "98765-43210", "09876543210"] {
            assert_eq!(found(&format!("call me on {number} today")), vec![(number.to_string(), "PHONE")], "{number}");
        }
        assert_eq!(found("ORD123456 aaya nahi"), vec![]);
        assert_eq!(found("5 items for Rs 1250"), vec![]);
        assert_eq!(found("pin 411001 hai"), vec![]);
    }

    #[test]
    fn a_tracking_number_that_looks_like_a_phone_is_left_alone_unless_phone_words_are_near() {
        assert_eq!(found("Tracking number 9876543210 shows out for delivery"), vec![]);
        assert_eq!(found("courier reference 9876543210 issued"), vec![]);
        assert_eq!(found("courier reference ok, call 9876543210"), vec![("9876543210".into(), "PHONE")]);
    }

    #[test]
    fn email_and_upi_are_told_apart() {
        assert_eq!(found("mail rahul.sharma@example.com now"), vec![("rahul.sharma@example.com".into(), "EMAIL")]);
        assert_eq!(found("pay to rahul12@okaxis."), vec![("rahul12@okaxis".into(), "UPI_ID")]);
        assert_eq!(found("9876543210@ybl is mine"), vec![("9876543210@ybl".into(), "UPI_ID")]);
        assert_eq!(found("a@b"), vec![]);
    }

    #[test]
    fn pan_needs_a_valid_holder_type_or_the_word_pan_and_not_a_coupon_context() {
        assert_eq!(found("PAN ABCPE1234F hai"), vec![("ABCPE1234F".into(), "PAN")]);
        assert_eq!(found("coupon ABCDE1234F lagao"), vec![]);
        assert_eq!(found("code XYZQK9876M"), vec![]); // a coupon context, and 4th letter Q is not a holder type
        assert_eq!(found("ABCQE1234F"), vec![]); // 4th letter Q is not a holder type and nothing says PAN
        assert_eq!(found("order ABCQE1234F aaya"), vec![]);
        // A PAN-shaped code whose 4th letter is not a holder type (no real PAN has one; the test set uses them) is found only when PAN is right before it.
        for text in ["PAN ABCQE1234F hai", "my pan no is ABCDE1234F", "PAN number: XYZKE9876M", "मेरा पैन ABCDE1234F है"] {
            assert_eq!(found(text).len(), 1, "{text}");
            assert_eq!(found(text)[0].1, "PAN", "{text}");
        }
        assert_eq!(found("company ABCQE1234F"), vec![]); // "company" contains the letters pan but is not the word
    }

    #[test]
    fn an_aadhaar_shaped_number_starting_with_0_or_1_is_found_because_the_test_set_uses_them() {
        // UIDAI never issues a number starting with 0 or 1, so the test set uses them. A Verhoeff-valid one is marked like any other; a bad check digit is not.
        let valid = (0..10).map(|d| format!("01234567890{d}")).find(|n| verhoeff_ok(n)).unwrap();
        let spaced = format!("{} {} {}", &valid[..4], &valid[4..8], &valid[8..]);
        for form in [&valid, &spaced] {
            assert_eq!(found(&format!("Aadhaar {form} hai")), vec![(form.clone(), "AADHAAR")]);
        }
        let invalid = (0..10).map(|d| format!("11234567890{d}")).find(|n| !verhoeff_ok(n)).unwrap();
        assert_eq!(found(&format!("courier reference {invalid} issued")), vec![]);
    }

    #[test]
    fn a_five_series_mobile_needs_a_prefix_or_a_gap_to_be_marked() {
        for number in ["+915432109876", "+91 54321 09876", "054321098765".get(..11).unwrap(), "54321-09876", "54321 09876"] {
            assert_eq!(found(&format!("call me on {number} today")), vec![(number.to_string(), "PHONE")], "{number}");
        }
        // ten bare digits starting with 5: nobody's number, and common as order or reference numbers, so left alone
        assert_eq!(found("call me on 5432109876 today"), vec![]);
        assert_eq!(found("order 5432109876 is late"), vec![]);
    }

    #[test]
    fn a_gstin_beats_the_pan_inside_it_and_needs_its_check_character() {
        let body = "27ABCPE1234F1Z";
        let check = GST_CHARS.chars().find(|c| gstin_ok(&format!("{body}{c}"))).unwrap();
        let good = format!("{body}{check}");
        assert_eq!(found(&format!("GSTIN {good} hai")), vec![(good.clone(), "GSTIN")]);
        let wrong = GST_CHARS.chars().find(|c| *c != check).unwrap();
        let spans = found(&format!("GSTIN {body}{wrong} hai"));
        assert!(spans.iter().all(|(_, k)| *k != "GSTIN"));
    }

    #[test]
    fn addresses_with_a_pincode_are_found_in_latin_and_devanagari() {
        assert_eq!(found("Ship to Flat 302, Shanti Nagar, Pune 411001. Thanks"), vec![("Flat 302, Shanti Nagar, Pune 411001".into(), "ADDRESS")]);
        assert_eq!(found("pata: House No. 12, Green Park, Jaipur, 302001 hai"), vec![("House No. 12, Green Park, Jaipur, 302001".into(), "ADDRESS")]);
        assert_eq!(found("पता फ्लैट 180, सिविल लाइन्स, भोपाल 462001।"), vec![("फ्लैट 180, सिविल लाइन्स, भोपाल 462001".into(), "ADDRESS")]);
    }

    #[test]
    fn common_names_are_found_in_pairs_and_after_cue_words_and_unusual_names_are_missed() {
        assert_eq!(found("Customer Rahul Sharma ne order diya"), vec![("Rahul Sharma".into(), "NAME")]);
        assert_eq!(found("Mera naam Priya hai"), vec![("Priya".into(), "NAME")]);
        assert_eq!(found("Priya mujhe pasand hai"), vec![]); // a first name alone, with no cue, is not removed
        assert_eq!(found("Zxqvbn Kowalczyk wrote"), vec![]); // an unusual name is missed, and the docs say so
    }

    #[test]
    fn strip_replaces_spans_and_keeps_everything_else() {
        let out = strip("Mera naam Rahul Sharma hai, call 9876543210 ya rahul@example.com");
        assert_eq!(out.redacted, "Mera naam [NAME] hai, call [PHONE] ya [EMAIL]");
        assert_eq!(out.spans.len(), 3);
        assert!(out.spans.windows(2).all(|w| w[0].end <= w[1].start));
        assert_eq!(strip("kuch bhi nahi").redacted, "kuch bhi nahi");
        assert_eq!(strip("").redacted, "");
    }

    #[test]
    fn offsets_count_characters_not_bytes() {
        let text = "नमस्ते 9876543210";
        let spans = detect(text);
        let chars: Vec<char> = text.chars().collect();
        assert_eq!(chars[spans[0].start..spans[0].end].iter().collect::<String>(), "9876543210");
    }

    #[test]
    fn json_output_has_the_shape_the_browser_expects() {
        let value: serde_json::Value = serde_json::from_str(&strip_json("call 9876543210")).unwrap();
        assert_eq!(value["redacted"], "call [PHONE]");
        assert_eq!(value["spans"][0]["type"], "PHONE");
        assert_eq!((value["spans"][0]["start"].as_u64(), value["spans"][0]["end"].as_u64()), (Some(5), Some(15)));
    }

    #[test]
    fn an_address_stops_at_its_own_pincode_even_when_a_phone_number_follows() {
        let text = "Delivery Flat 358, Green Park, Kochi 682001 pe karna, ghar pe na mile to 8925935218 pe call karna.";
        assert_eq!(found(text), vec![("Flat 358, Green Park, Kochi 682001".into(), "ADDRESS"), ("8925935218".into(), "PHONE")]);
    }

    #[test]
    fn a_plus_91_phone_is_never_taken_for_an_aadhaar_number() {
        // 91 followed by ten digits is twelve digits, and about one in ten of those pass the Verhoeff check by chance.
        let twelve = (0..10u32).map(|d| format!("9168797397{d}8")).find(|n| verhoeff_ok(n)).unwrap_or_else(|| "916879739758".into());
        let spans = found(&format!("baat karo +{twelve} pe"));
        assert!(spans.iter().all(|(_, k)| *k != "AADHAAR"), "{spans:?}");
    }

    #[test]
    fn hindi_tracking_and_coupon_words_protect_look_alikes_too() {
        assert_eq!(found("ट्रैकिंग नंबर 8819019447 आउट फ़ॉर डिलीवरी"), vec![]);
        assert_eq!(found("कूपन RCUCS9571M लगाओ"), vec![]);
    }

    #[test]
    fn nothing_panics_on_odd_input() {
        for text in ["", " ", "@", "+91", "Flat", "Flat 1", "99999999999999999999999999", "\u{0}\u{7f}", "ABCDE1234", "a@b.c", "🙂 🙂 9876543210 🙂"] {
            let _ = strip(text);
        }
    }
}
