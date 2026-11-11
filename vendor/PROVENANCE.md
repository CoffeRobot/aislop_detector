# Vendored @wllama/wllama — from-source provenance

`vendor/wllama/esm/index.js` and `public/wllama.wasm` are built from pinned
upstream sources on this machine. They replace the previous demo-deployment
vendored copy (wllama master, 2026-10-20 15:15 GMT).

## Obsolescence update (2026-11-11)

The swap-back condition below is **met**: `@wllama/wllama@3.13.0` reached npm on
2026-11-08 and is d1-capable on a newer llama.cpp (`b12211-7d7f028` vs this
build's `b11719-5aeac37`). Verified on the actual tarball (`npm pack`):
`lfm2-d1` ×2, `lfm2-d1-omni` ×1, systemone ×2, decision glue ×4, `ggml-webgpu` ×2
— same six feature markers as this build. This from-source path is therefore
obsolete: retire it via `issue-16` (GitHub #35). Until that lands, this file
remains the provenance of the shipped bytes; note the "Why built from source"
section below quotes `npm view` output that was current at build time (2026-11-06,
latest then was 3.8.1) and is kept for the historical record.

## Why built from source

The published npm package is still not d1-capable:

```text
$ npm view @wllama/wllama version
3.8.1
```

`@wllama/wllama@3.8.1` vendors llama.cpp from 2026-09-03, before the LiquidAI
d1 architecture support merged upstream (llama.cpp PRs #30110/#30114,
2026-10-07/08). Its wasm contains no `lfm2-d1` strings, so `LiquidAI/d1-3B-GGUF`
fails to load. Therefore this repo builds the engine itself from a pinned
wllama master commit that includes d1 support.

If a d1-capable release later appears on npm, swap back to the registry
dependency (`"@wllama/wllama": "^<version>"` in `package.json`, delete
`vendor/wllama/` and `public/wllama.wasm`, re-point the wasm path if needed) and
close this provenance path.

## Pinned source commits

| repository | commit | date | notes |
|---|---|---|---|
| `ngxson/wllama` | `3bb2a46f0dab0b924e8cd992b85e8881c3d3a859` | 2026-10-20 16:57:55 +0200 | `sync latest llama.cpp (#293)` |
| `ggerganov/llama.cpp` (submodule) | `5aeac37a35b44fde4bdffaec9159f2fcb253b622` | 2026-10-18 10:59:06 +0200 | has d1 decision support |

These SHAs are the exact upstream state used for this build. The llama.cpp
submodule commit matches the one recorded in the previous demo-deployment
provenance file, so the engine behavior on d1-3B is expected to be unchanged
within float drift.

## Build environment

- Machine: Ubuntu 26.04.1 LTS (x86_64)
- CPU threads used: 12 (`nproc`)
- Emscripten SDK: 4.0.20 (`sdk-releases-c387d7a7e9537d0041d2c3ae71b7538cc978104e-64bit`)
- CMake: 4.4.5
- Node.js: 26.10.0
- Python: 3.14.8
- Build date: 2026-11-06 05:33 UTC

## Build steps

Native build (no Docker on this machine). The commands below reproduce the
artifacts from a fresh clone given the toolchain.

```bash
# 1. Install toolchain --------------------------------------------------------
#    - cmake  (tested with 4.4.5 from Homebrew)
#    - emsdk  4.0.20
#    - node, python3, curl, make, git (standard Ubuntu packages)

# Install emsdk if not already present
git clone https://github.com/emscripten-core/emsdk.git ~/emsdk
cd ~/emsdk
./emsdk install 4.0.20
./emsdk activate 4.0.20

# 2. Clone pinned sources ------------------------------------------------------
git clone --recurse-submodules https://github.com/ngxson/wllama.git wllama-src
cd wllama-src
git checkout 3bb2a46f0dab0b924e8cd992b85e8881c3d3a859
git submodule update --init --recursive

# 3. Install JS build deps -----------------------------------------------------
npm install

# 4. Source emsdk env in every shell that builds --------------------------------
source "$HOME/emsdk/emsdk_env.sh"

# 5. Download emdawnwebgpu (matches scripts/docker-compose.yml) -----------------
mkdir -p build/emdawn
cd build
curl -L -o emdawn.zip \
  "https://github.com/google/dawn/releases/download/v20260317.182325/emdawnwebgpu_pkg-v20260317.182325.zip"
python3 -c "import zipfile; z=zipfile.ZipFile('emdawn.zip','r'); z.extractall('emdawn'); z.close()"
cd ..

# 6. Configure and build the wasm -----------------------------------------------
emcmake cmake -S . -B build \
  -DGGML_WEBGPU=ON \
  -DGGML_WEBGPU_JSPI=ON \
  -DEMDAWNWEBGPU_DIR="$PWD/build/emdawn/emdawnwebgpu_pkg" \
  -DWLLAMA_TEST_BACKEND=OFF

emmake make -C build wllama -j$(nproc)

# 7. Copy wasm artifacts into the wllama package tree ---------------------------
cp build/wllama.js src/wasm/
cp build/wllama.wasm src/wasm/
node scripts/build_source_map.js

# 8. Bundle the JS/TS package ---------------------------------------------------
npm run build:worker
npm run build:tsup
npm run build:typedef
./scripts/post_build.sh

# 9. Copy the built artifacts into this repo ------------------------------------
#    (run from the aislop_detector repo root)

# JS entry point
cp wllama-src/esm/index.js aislop_detector/vendor/wllama/esm/index.js

# All declaration files, preserving the esm/ subdirectory layout
find wllama-src/esm -name '*.d.ts' -type f | while read -r f; do
  target="${f/#wllama-src\/esm/aislop_detector\/vendor\/wllama\/esm}"
  mkdir -p "$(dirname "$target")"
  cp "$f" "$target"
done

# Wasm binary (served from public/, not the package tree)
cp wllama-src/esm/wasm/wllama.wasm aislop_detector/public/wllama.wasm
```

The upstream docker path is `scripts/build_wasm.sh` + `npm run build`; the native
sequence above is equivalent and produces the same engine features.

## Committed artifacts and checksums

| file | sha256 | size |
|---|---|---|
| `public/wllama.wasm` | `0e0ae71241b59fa0e636a54d788b8047ebca672967db1e96dc3ef18644411efe` | 9,233,991 bytes |
| `vendor/wllama/esm/index.js` | `f2ca7739000986a1d5a88c3005ac16a4f8e6801b51cfcbcd4f56bc7b78a868c0` | 320,187 bytes |

## Engine verification

```bash
strings public/wllama.wasm | grep -c 'lfm2-d1'       # 2
strings public/wllama.wasm | grep -c 'lfm2-d1-omni' # 1
strings public/wllama.wasm | grep -c 'systemone'     # 2
strings public/wllama.wasm | grep -c 'server_task_result_decision' # 1
strings public/wllama.wasm | grep -c 'Image input is not supported for systemone' # 1
strings public/wllama.wasm | grep -c 'ggml-webgpu'  # 2
```

The d1-3B / d1-omni architecture strings and the systemone decision endpoint
glue are present, and the ggml WebGPU backend is compiled in.

## Reproducibility note

WebAssembly builds from C++ are not guaranteed to be bit-for-bit identical across
build environments (absolute paths, locale, toolchain minor variations, and
emscripten cache state can perturb the binary). The provenance above pins the
exact source commits, cmake flags, and toolchain versions so that anyone with
the same environment can rebuild an engine with the same feature set. The
acceptance bar is: same source + same flags → same d1 capability and same
in-browser behavior, not byte-identical wasm.

## Regression status

The required Brave four-post regression against `docs/spike-wllama.md` was not
performed in this build ticket (owner-only manual step, requires the d1-3B model
download + Brave load). The PR remains a draft until that regression is supplied.
The engine strings and automated project checks pass; no application logic was
changed.
