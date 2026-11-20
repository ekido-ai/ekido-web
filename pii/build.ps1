# Rebuilds the WebAssembly module into src/lib/pii/wasm (run from anywhere).
#   needs: rustup target add wasm32-unknown-unknown ; cargo install wasm-bindgen-cli --version 0.2.100 --locked
Set-Location $PSScriptRoot
# Keep this machine's folder names out of the binary (panic messages carry source paths).
$repo = (Resolve-Path "..").Path
$env:RUSTFLAGS = "--remap-path-prefix=$HOME\.cargo=/cargo --remap-path-prefix=$HOME\.rustup=/rustup --remap-path-prefix=$repo=/repo"

# cargo writes progress to stderr, so check the exit code instead of letting PowerShell treat that as an error.
cargo build --locked --release --lib --target wasm32-unknown-unknown
if ($LASTEXITCODE -ne 0) { throw "cargo build failed" }
$out = Join-Path $PSScriptRoot "..\src\lib\pii\wasm"
New-Item -ItemType Directory -Force $out | Out-Null
wasm-bindgen "target\wasm32-unknown-unknown\release\ekido_pii.wasm" --target web --out-dir $out --out-name ekido_pii
if ($LASTEXITCODE -ne 0) { throw "wasm-bindgen failed" }
Get-ChildItem $out | ForEach-Object { "{0}  {1:N0} bytes" -f $_.Name, $_.Length }
