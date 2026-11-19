# Rebuilds the WebAssembly module into src/lib/pii/wasm (run from the repo root or from pii/).
#   needs: rustup target add wasm32-unknown-unknown ; cargo install wasm-bindgen-cli --version 0.2.100 --locked
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
cargo build --locked --release --lib --target wasm32-unknown-unknown
$out = Join-Path $PSScriptRoot "..\src\lib\pii\wasm"
New-Item -ItemType Directory -Force $out | Out-Null
wasm-bindgen "target\wasm32-unknown-unknown\release\ekido_pii.wasm" --target web --out-dir $out --out-name ekido_pii
Get-ChildItem $out | ForEach-Object { "{0}  {1:N0} bytes" -f $_.Name, $_.Length }
