# pii: personal-detail removal in the browser

Rust, compiled to WebAssembly, used by `src/lib/pii/strip.ts`. It finds phone numbers, emails, Aadhaar, PAN, GSTIN, UPI IDs, addresses and names in a customer's rows and replaces them with `[KIND]` before anything is uploaded. The module has no way to reach the network (its only import is wasm-bindgen's table set-up; a test checks that).

## What it can and cannot do

- Aadhaar numbers must pass the Verhoeff check, GSTINs their check character, PANs a valid holder type. Phone numbers and PANs next to words like "tracking" or "coupon" (English and Hindi) are left alone.
- **It also removes shapes that real people never have** (the test set in ekido-core uses them so that no identifier in a public repo can belong to anyone): a Verhoeff-valid 12-digit number starting with 0 or 1; a mobile starting with 5 when it has a `+91`, `91` or `0` prefix or a space or hyphen inside (ten bare digits starting with 5 are left alone, because they are common as order numbers); a PAN-shaped code whose 4th letter is not a holder type, when the word PAN (or पैन) is one of the three words before it. This makes it slightly broader than a detector for real values only.
- **Names come from lists of common Indian first names and surnames**, so unusual names are missed. Addresses are found only when they start with Flat, House, Plot, Shop, Door or Room (or the Hindi equivalents) and end with a pincode.
- It is a safety net, not a guarantee. The upload screen must show the preview of what was removed, and the product must not claim that nothing personal is left.

## Measured (raw files in `results/`)

| Set | Lines | Recall | Precision | Notes |
|---|---|---|---|---|
| `experiments/pii/pii-set.jsonl` (ekido-core, 300 lines, identifiers that cannot be issued, 24 Nov) | 300 | 1.0000 | 1.0000 | **Optimistic**: the detector was adapted to this set. Before the detector change the same set scored recall 0.6621 (PHONE, AADHAAR and PAN 0.0: `pii-score-20261124-new-set-before-detector-change.json`); after: `pii-score-20261124-new-set-after-detector-change.json` |
| the previous 300-line set (real-shaped values, replaced on 24 Nov), scored with the changed detector | 300 | 1.0000 | 1.0000 | Shows the change did not lose the real-shaped forms: `pii-score-20261124-previous-set-after-detector-change.json` |
| `experiments/pii/pii-set.jsonl` (ekido-core, earlier real-shaped version, 19 Nov) | 300 | 1.0000 | 1.0000 | **Optimistic**: the detectors were tuned on this set (first run 0.9909 and 0.9909; run 1 is kept) |
| `heldout/heldout-set.jsonl` (40 lines, written after tuning, never tuned on) | 40 | 0.8000 | 0.9231 | The honest number: names 0.55 recall. Unchanged by the 24 Nov detector change (`pii-score-heldout-20261124-after-detector-change.json`). Its values are of the real shapes and have not been replaced yet |

## Commands

```
cargo test                                   # unit tests
cargo run --release --bin score -- <set.jsonl> --out results/<new-name>.json
python -I -X utf8 heldout/make_heldout.py    # regenerate the held-out set from its markup
./build.sh  (or  build.ps1)                  # rebuild src/lib/pii/wasm
```

`score` refuses to overwrite an existing result file.

## The shipped WebAssembly is tied to this source

The module in `src/lib/pii/wasm` runs in customers' browsers on their raw data, and nobody can read a binary, so CI proves that it is what this source builds (`.github/workflows/ci.yml`, job "PII remover"):
- the Rust version is pinned in `rust-toolchain.toml` (1.99.1) and `wasm-bindgen-cli` to 0.2.100 (the version in `Cargo.lock`);
- CI builds the module from the source in the commit with `build.sh`, and **fails if the result differs byte for byte** from the committed `.wasm` and glue files;
- the committed files must therefore be the ones a Linux build writes. A build on another system (for example Windows) is not byte-identical, because the compiler embeds path strings and line endings differ. When the check fails, CI uploads its build as the `ekido-pii-wasm` artifact: copy those files into `src/lib/pii/wasm` and commit them.
- `.gitattributes` marks `src/lib/pii/wasm/*` as binary so no tool rewrites their line endings.

I have not shown that two different Linux machines give identical bytes beyond re-running the job on a fresh runner (see the PR). If that ever fails, the fallback is to stop committing the module and build it inside the web build.
