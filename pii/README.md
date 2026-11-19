# pii: personal-detail removal in the browser

Rust, compiled to WebAssembly, used by `src/lib/pii/strip.ts`. It finds phone numbers, emails, Aadhaar, PAN, GSTIN, UPI IDs, addresses and names in a customer's rows and replaces them with `[KIND]` before anything is uploaded. The module has no way to reach the network (its only import is wasm-bindgen's table set-up; a test checks that).

## What it can and cannot do

- Aadhaar numbers must pass the Verhoeff check, GSTINs their check character, PANs a valid holder type. Phone numbers and PANs next to words like "tracking" or "coupon" (English and Hindi) are left alone.
- **Names come from lists of common Indian first names and surnames**, so unusual names are missed. Addresses are found only when they start with Flat, House, Plot, Shop, Door or Room (or the Hindi equivalents) and end with a pincode.
- It is a safety net, not a guarantee. The upload screen must show the preview of what was removed, and the product must not claim that nothing personal is left.

## Measured (raw files in `results/`)

| Set | Lines | Recall | Precision | Notes |
|---|---|---|---|---|
| `experiments/pii/pii-set.jsonl` (ekido-core, 300 lines) | 300 | 1.0000 | 1.0000 | **Optimistic**: the detectors were tuned on this set (first run 0.9909 and 0.9909; run 1 is kept) |
| `heldout/heldout-set.jsonl` (40 lines, written after tuning, never tuned on) | 40 | 0.8000 | 0.9231 | The honest number: names 0.55 recall |

## Commands

```
cargo test                                   # unit tests
cargo run --release --bin score -- <set.jsonl> --out results/<new-name>.json
python -I -X utf8 heldout/make_heldout.py    # regenerate the held-out set from its markup
./build.sh  (or  build.ps1)                  # rebuild src/lib/pii/wasm
```

`score` refuses to overwrite an existing result file.
