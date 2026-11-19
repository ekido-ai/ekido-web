#!/bin/sh
# Rebuilds the WebAssembly module into src/lib/pii/wasm (run from anywhere).
#   needs: rustup target add wasm32-unknown-unknown ; cargo install wasm-bindgen-cli --version 0.2.100 --locked
set -eu
cd "$(dirname "$0")"
cargo build --locked --release --lib --target wasm32-unknown-unknown
out="../src/lib/pii/wasm"
mkdir -p "$out"
wasm-bindgen target/wasm32-unknown-unknown/release/ekido_pii.wasm --target web --out-dir "$out" --out-name ekido_pii
ls -l "$out"
