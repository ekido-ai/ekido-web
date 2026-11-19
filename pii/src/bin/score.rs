//! Measures the PII stripper against the labelled set (experiments/pii/pii-set.jsonl in ekido-core).
//!
//!     cargo run --release --bin score -- path/to/pii-set.jsonl --out path/to/result.json
//!
//! A detected span counts as correct only if its start, end and type all match a labelled span (strict). The result
//! lists every miss and every false positive, per type recall and precision, and the false-positive count on the lines
//! that contain no personal data. It refuses to overwrite an existing result file.

use ekido_pii::{detect, Kind, Span};
use serde::Deserialize;
use serde_json::json;
use std::collections::BTreeMap;
use std::{env, fs, process};

#[derive(Deserialize)]
struct Labelled {
    start: usize,
    end: usize,
    #[serde(rename = "type")]
    kind: String,
}

#[derive(Deserialize)]
struct Line {
    text: String,
    spans: Vec<Labelled>,
}

fn rate(num: usize, den: usize) -> serde_json::Value {
    if den == 0 { serde_json::Value::Null } else { json!((num as f64 / den as f64 * 10000.0).round() / 10000.0) }
}

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    let (Some(input), Some(out)) = (args.first(), args.iter().position(|a| a == "--out").and_then(|i| args.get(i + 1))) else {
        eprintln!("usage: score <pii-set.jsonl> --out <result.json>");
        process::exit(2);
    };
    if fs::metadata(out).is_ok() {
        eprintln!("{out} already exists; choose a new name so an earlier result is never overwritten");
        process::exit(2);
    }
    let raw = fs::read_to_string(input).unwrap_or_else(|e| {
        eprintln!("cannot read {input}: {e}");
        process::exit(2);
    });
    let lines: Vec<Line> = raw.lines().filter(|l| !l.trim().is_empty()).map(|l| serde_json::from_str(l).expect("a valid line")).collect();

    let mut tp: BTreeMap<&str, usize> = BTreeMap::new();
    let mut fp: BTreeMap<&str, usize> = BTreeMap::new();
    let mut fneg: BTreeMap<&str, usize> = BTreeMap::new();
    let (mut misses, mut false_positives) = (Vec::new(), Vec::new());
    let (mut clean_lines, mut clean_lines_with_fp) = (0usize, 0usize);

    for (number, line) in lines.iter().enumerate() {
        let chars: Vec<char> = line.text.chars().collect();
        let text_of = |a: usize, b: usize| chars[a..b].iter().collect::<String>();
        let found: Vec<Span> = detect(&line.text);
        let mut matched = vec![false; found.len()];
        for label in &line.spans {
            let hit = found.iter().position(|s| s.start == label.start && s.end == label.end && s.kind.label() == label.kind);
            match hit {
                Some(i) => {
                    matched[i] = true;
                    *tp.entry(Kind::ALL.iter().find(|k| k.label() == label.kind).unwrap().label()).or_default() += 1;
                }
                None => {
                    *fneg.entry(Kind::ALL.iter().find(|k| k.label() == label.kind).unwrap().label()).or_default() += 1;
                    let overlapping: Vec<String> = found.iter().filter(|s| s.start < label.end && label.start < s.end).map(|s| format!("{}:{}", s.kind.label(), text_of(s.start, s.end))).collect();
                    misses.push(json!({"line": number + 1, "type": label.kind, "expected": text_of(label.start, label.end), "found_instead": overlapping, "text": line.text}));
                }
            }
        }
        for (i, span) in found.iter().enumerate() {
            if !matched[i] {
                *fp.entry(span.kind.label()).or_default() += 1;
                false_positives.push(json!({"line": number + 1, "type": span.kind.label(), "text_found": text_of(span.start, span.end), "text": line.text}));
            }
        }
        if line.spans.is_empty() {
            clean_lines += 1;
            if !found.is_empty() {
                clean_lines_with_fp += 1;
            }
        }
    }

    let mut per_type = serde_json::Map::new();
    let (mut all_tp, mut all_fp, mut all_fn) = (0, 0, 0);
    for kind in Kind::ALL {
        let l = kind.label();
        let (t, f, n) = (*tp.get(l).unwrap_or(&0), *fp.get(l).unwrap_or(&0), *fneg.get(l).unwrap_or(&0));
        all_tp += t;
        all_fp += f;
        all_fn += n;
        per_type.insert(l.into(), json!({"labelled": t + n, "found_correctly": t, "missed": n, "false_positives": f, "recall": rate(t, t + n), "precision": rate(t, t + f)}));
    }
    let result = json!({
        "tool": "ekido_pii score (strict match: start, end and type)",
        "input": input,
        "lines": lines.len(),
        "clean_lines": clean_lines,
        "clean_lines_with_a_false_positive": clean_lines_with_fp,
        "overall": {"recall": rate(all_tp, all_tp + all_fn), "precision": rate(all_tp, all_tp + all_fp), "missed": all_fn, "false_positives": all_fp},
        "per_type": per_type,
        "misses": misses,
        "false_positives": false_positives,
    });
    fs::write(out, serde_json::to_string_pretty(&result).unwrap() + "\n").expect("write the result");
    println!("{}", serde_json::to_string_pretty(&result["overall"]).unwrap());
    println!("clean lines with a false positive: {clean_lines_with_fp} of {clean_lines}");
    for kind in Kind::ALL {
        let t = &result["per_type"][kind.label()];
        println!("{:8} recall {} precision {} (missed {}, false positives {})", kind.label(), t["recall"], t["precision"], t["missed"], t["false_positives"]);
    }
}
