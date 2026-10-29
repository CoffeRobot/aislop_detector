# Vendored @wllama/wllama — provenance

`vendor/wllama/` is a verbatim copy of the `@wllama/wllama` npm package layout
(esm JS + TypeScript declarations), built from **wllama master** on
**2026-10-20 15:15 GMT** by the project's own deployment pipeline (the demo site
at `https://github.ngxson.com/wllama/esm/`). `public/wllama.wasm` is the matching
WebAssembly binary from the same build.

## Why vendored

The newest npm release, `@wllama/wllama@3.8.1` (2026-10-02), vendors llama.cpp
from 2026-09-03 (`c7bda03`) — **before** the LiquidAI d1 model-architecture
support merged upstream (llama.cpp PRs #30110/#30114, 2026-10-07/08). Verified
directly: the 3.8.1 wasm contains no `lfm2-d1` arch strings, so loading
`LiquidAI/d1-3B-GGUF` fails with an unknown-architecture error. wllama master
(llama.cpp @ `5aeac37`, 2026-10-18) has the support but is not yet published to
npm (master is at 3.12.0, unpublished; no docker on this machine to build the
wasm ourselves). This vendored copy is the project's own build of master.

Swap back to the registry dependency — one line in `package.json` — as soon as
npm publishes a d1-capable release (≥3.9.0, watch for `lfm2-d1` in the release
notes), then delete `vendor/` and `public/wllama.wasm` (re-import the wasm from
the package instead).

## Files and checksums (as committed)

- `vendor/wllama/esm/index.js` — self-contained ESM bundle
  sha256 `ae78882006d36eea6b55d75bc8577143d37f397151dd6f68344ea1c53bd23b25`
- `public/wllama.wasm` — wasm binary (single asset; loaded via
  `chrome.runtime.getURL('wllama.wasm')`, so it sits in `public/`)
  sha256 `f5283730528f46ad68101c29714c014e8648344ee50a11d81e06693d4375ae66`
- `vendor/wllama/esm/*.d.ts` — type declarations from the same build
- `vendor/wllama/LICENCE` — upstream MIT licence

The deployed files are rebuilt by upstream on every master push; the checksums
above pin what this repo actually contains.

## Engine verification (done at vendoring time)

- `public/wllama.wasm` contains arch strings `lfm2-d1` and `lfm2-d1-omni`
  (required for the d1-3B / d1-omni decision models), the systemone glue
  (`server_task_result_decision`, "Image input is not supported for systemone")
  and the ggml WebGPU backend (`ggml-webgpu.cpp`).
- It does **not** contain the d1-2B arch (needs llama.cpp ≥ b11960 / v0.8.0,
  2026-10-28 — newer than this build); the d1-2B profile defers until an engine
  catches up.
- Upstream: https://github.com/ngxson/wllama — master 3.12.0, llama.cpp sync
  `5aeac37` (2026-10-18).