# Spike — local validation of both readout paths (issue-2, M1-P2)

Findings from real runs on the owner's machine, 2026-10-27/28. The harness is the
`llama-server` CLI (llama.cpp b11936, 0.7.0-dev, commit `27b7a8a00`, prebuilt
ubuntu-x64, CPU backend); the scripts in `spike/` are **throwaway** orchestration
(start server, post requests, time them) — marked as such, committed for
reproducibility. Sample posts are synthetic (`spike/posts.jsonl`): one per intended
class plus the TAXONOMY tie-break case (machine cadence + engagement bait →
`rubbish` by the substance axis). No scraped or owner-labeled data. Class
definitions in all prompts are copied from TAXONOMY.md v1.

## Environment

- CPU: Intel i7-8700K (6c/12t), **no GPU**, 7.7 GiB RAM (2.7 GiB available at run time)
- llama.cpp b11936 (0.7.0-dev) — includes d1 decision support (`lfm2-d1` model type,
  `/v1/systemone` endpoint; PRs #30110, #30114 merged before this build)
- Models (one-time HuggingFace downloads via `llama-server -hf`):
  - Path A: `LiquidAI/d1-3B-GGUF:Q4_K_M` (~1.9 GB; Q8_0 would not fit available RAM)
  - Path A small option: `LiquidAI/d1-omni-600M-GGUF:Q8_0` (~0.64 GB)
  - Path B: `LiquidAI/LFM2.5-1.2B-Instruct-GGUF:Q4_K_M` (~0.75 GB)

## Path A — d1 decision model, full logits (`/v1/systemone`)

One typed `choice` question over each post (`spike/spike_common.py`, `QUESTION`):
options `ai_slop` / `rubbish` / `genuine` with TAXONOMY v1 criteria. The server
returns per-option probabilities from full logits — zero generated tokens, no
top-k window, every option always readable.

Command: `python3 spike/run_path_a.py LiquidAI/d1-3B-GGUF:Q4_K_M`

| post (intended) | ai_slop | rubbish | genuine | server top | ms (cold) | ms (warm avg) |
|---|---|---|---|---|---|---|
| slop_listicle (ai_slop) | **0.769** | 0.037 | 0.194 | ai_slop ✓ | 5912 | ~5500 |
| engagement_bait (rubbish) | 0.042 | **0.895** | 0.063 | rubbish ✓ | 5246 | ~5400 |
| firsthand (genuine) | 0.014 | 0.011 | **0.975** | genuine ✓ | 5644 | ~5280 |
| bot_hype_thread (rubbish, tie-break) | **0.469** | 0.461 | 0.070 | ai_slop ✗ | 5499 | ~5700 |

- Deterministic: identical probabilities across all 3 rounds per post.
- The three clean posts classify as intended with wide margins. The tie-break post
  lands in a near-tie `ai_slop` 0.469 vs `rubbish` 0.461 — the ai_slop↔rubbish
  confusion PLAN.md already flags as the expected trouble spot (M4 tuning, not a
  spike blocker; the tie-break rule itself may need to enter the question criteria).
- Decision prompt ≈ 190–220 tokens, fully evaluated per request (decision models
  disable the prompt cache by default; the shared question prefix is cacheable via
  `--cache-ram` / wllama's `cache_prompt`).
- Model load ≈ 13 s (cold start incl. Q8_0 mmproj the server loads automatically).

### d1-omni-600M (Q8_0, `-b 4096 -ub 4096`)

Command: `python3 spike/run_path_a.py LiquidAI/d1-omni-600M-GGUF:Q8_0 -b 4096 -ub 4096`

| post | ai_slop | rubbish | genuine | server top | ms (cold) | ms (warm avg) |
|---|---|---|---|---|---|---|
| slop_listicle | 0.314 | 0.186 | **0.500** | genuine ✗ | 1206 | ~820 |
| engagement_bait | 0.152 | 0.147 | **0.701** | genuine ✗ | 971 | ~710 |
| firsthand | 0.353 | 0.225 | **0.422** | genuine ✓ | 875 | ~730 |
| bot_hype_thread | 0.331 | 0.253 | **0.417** | genuine ✗ | 868 | ~730 |

~7× faster but unusable as-is: everything leans `genuine`, margins are flat
(0.42–0.70), engagement bait scores genuine 0.70. Not salvageable without prompt
tuning, which is out of spike scope (M4).

## Path B — LFM2.5-1.2B-Instruct chat + top-k logprobs

Chat completion (`max_tokens: 1`) whose first generated token is the class answer;
per-class probabilities = softmax over the class first-tokens found in the
`top_logprobs` window.

Command: `python3 spike/run_path_b.py LiquidAI/LFM2.5-1.2B-Instruct-GGUF:Q4_K_M`

**First-token check (via `/tokenize`):** `ai_slop` → id 2112 (`ai`), `rubbish` →
id 1005, `genuine` → id 1658 — distinct ✓. Match by **token id**: string-prefix
matching is wrong here (`ru`, `gener`, `gent` are spurious matches inside the window;
that bug produced false coverage numbers in an early run — see harness comment).

**Full logits vs top-k, quantified:**

- Max `top_logprobs` window llama-server honours: **≥1024** (requested 1024,
  returned 1024; probe cap, not a server limit).
- Coverage (all three class first-tokens inside window): window 1024 → **4/4 posts,
  12/12 requests**; window 20 → 4/4; window 10 → 4/4; window 5 → **3/4**.
- Where coverage fails: at window 5, `engagement_bait` loses `genuine` (its `gen`
  token sits at rank 7). The renormalized softmax then silently spreads mass over
  the surviving classes — the reader cannot tell a class was invisible. This is the
  structural top-k failure mode: coverage failure fabricates confidence.
- Class-token ranks per post (window 1024): `ai` always rank 0; `rubb` rank 2–4
  (logprob −5.8…−7.8); `gen` rank 1–7. All inside a window ≥10 on these posts.

**Per-class probabilities (window 1024, minimal prompt):**

| post | ai_slop | rubbish | genuine | emitted | ms (cold) | ms (warm avg) |
|---|---|---|---|---|---|---|
| slop_listicle | **0.934** | 0.001 | 0.065 | `ai` | 1560 | ~1590 |
| engagement_bait | **0.997** | 0.003 | 0.000 | `ai` | 1347 | ~1390 |
| firsthand | **0.991** | 0.002 | 0.007 | `ai` | 1395 | ~1400 |
| bot_hype_thread | **0.992** | 0.000 | 0.008 | `ai` | 1386 | ~1450 |

**The readout works; the judgment does not.** The model answers `ai_slop` (~0.93–0.997)
for every post regardless of content. Ad-hoc probe with the class order in the system
prompt reversed (genuine listed first) flips it: `gen` wins at ~0.99 for every post —
slop listicle included. With this minimal prompt the top-token mass encodes option
order, not post substance. Fixing that would need few-shot/ordering work — prompt
tuning is explicitly out of spike scope, and d1 exists precisely to avoid it.

## Latency summary (per post, cold = first request after load, warm = mean of later rounds)

| path / model | cold | warm | notes |
|---|---|---|---|
| A: d1-3B Q4_K_M | ~5.5–5.9 s | ~5.3–5.6 s | ~190–220 tok decision prompt, full eval, 12 CPU threads |
| A: d1-omni-600M Q8_0 | ~0.9–1.2 s | ~0.75 s | but wrong answers (above) |
| B: 1.2B-Instruct Q4_K_M | ~1.4–1.6 s | ~1.4 s | 1 generated token, ~250 tok prompt |

Server model-load times measured: d1-3B ≈ 13 s, 1.2B-Instruct ≈ 1.7 s (page cache
warm). d1-3B at ~5.5 s/post on CPU is the main integration risk — but M2's scoring
queue tolerates late scores, and levers exist (d1-2B below, prefix caching, quant).

## Cross-check: same decision path on the owner's Windows Ollama (2026-10-28)

The owner runs Ollama 0.40.12 on the Windows host (reached from WSL2 over the LAN;
hardware specs not yet recorded — warm latencies suggest notably faster hardware
than the WSL CPU side). Ollama vendors llama.cpp with the d1 decision support and
serves the same `/v1/systemone` endpoint, so **llama-server is not required to run
Path A** — an Ollama install with the `d1-omni` model works out of the box.
Run mode: `SPIKE_BASE_URL=http://<host>:11434 python3 spike/run_path_a.py d1-omni:latest`.

**d1-omni via Ollama** (warm ~0.18–0.25 s; cold reload ≈ 24 s after Ollama's
keep-alive expiry):

| post | ai_slop | rubbish | genuine | top |
|---|---|---|---|---|
| slop_listicle | 0.326 | 0.180 | **0.494** | genuine ✗ |
| engagement_bait | 0.153 | 0.150 | **0.697** | genuine ✗ |
| firsthand | 0.326 | 0.247 | **0.427** | genuine (weak) |
| bot_hype_thread | 0.332 | 0.250 | **0.418** | genuine ✗ |

Same flattening-to-genuine failure as the WSL llama-server run (probabilities match
within backend/numerical variation) — the rejection of d1-omni-600M is
engine-independent. Latency is ~3× better than WSL (~0.2 s vs ~0.75 s warm).

**d3 via Ollama** — the owner also pulled `d3:latest` from the Ollama registry: a
4.8B Q8_0 decision-capable model of the **qwen35** family (not a Liquid d1/LFM
model). Accuracy is the best measured in the whole spike:

| post | ai_slop | rubbish | genuine | top | ms (warm) |
|---|---|---|---|---|---|
| slop_listicle | **0.598** | 0.392 | 0.010 | ai_slop ✓ | ~21000 |
| engagement_bait | 0.042 | **0.950** | 0.008 | rubbish ✓ | ~19200 |
| firsthand | 0.004 | 0.006 | **0.990** | genuine ✓ | ~19200 |
| bot_hype_thread | 0.272 | **0.722** | 0.006 | rubbish ✓ (tie-break correct!) | ~19200 |

It is the only model that classifies the TAXONOMY tie-break post correctly (d1-3B
called it a near-tie leaning ai_slop). But: ~19 s/post warm, ~100 s first load,
5.8 GB of weights — unusable for a timeline and impossible for in-browser wllama
(way outside any MV3 memory budget, and outside the plan's d1/LFM model family).
Kept as a quality reference point, not a candidate profile.

**Path B via Ollama:** this Ollama build does expose `logprobs`/`top_logprobs` in its
OpenAI-compat chat API, but `LFM2.5-1.2B-Instruct` is not in the Ollama registry —
Path B stays on llama-server unless the model is imported via Modelfile from the
HF GGUF.

## Recommendation (pending gold-set confirmation, M4)

- **Path: A — d1 decision model via the systemone/decision API.** Per-option
  probabilities by construction (no window, nothing silently dropped), deterministic,
  content-differentiated. Path B is rejected on evidence: order-anchored answers on
  the minimal prompt, plus the structural small-window blindness (3/4 coverage at
  window 5, renormalization fabricates confidence).
- **Model profile: d1-3B Q4_K_M as the default on this machine.** d1-omni-600M
  rejected as-is (flat, everything→genuine); 1.2B-Instruct rejected (above).
- **Flag for issue-3 (in-app):** upstream has deprecated d1-3B in favor of
  **d1-2B** (1.92B, built on LFM3-VL-2B; "a third fewer parameters… plus typed
  answers", per Liquid docs). Likely faster and more accurate; evaluate it alongside
  d1-3B when wiring the in-app slice. Not measured in this spike.
- **In-app feasibility (issue-3):** wllama exposes `createSystemOne` (d1 decision
  endpoint) and logprobs in its chat API — Path A is reachable through the sanctioned
  runtime dependency. Requires a wllama build on llama.cpp ≥ the d1 PRs (#30110/#30114);
  verify the bundled engine version at integration.
- **Harness note:** Ollama ≥ 0.40.x can replace llama-server for Path A (same
  `/v1/systemone` API, verified); the numbers above stay llama-server-recorded.
  d3 (`qwen35` decision model from the Ollama registry) shows the tie-break case is
  learnable — worth remembering when comparing d1-3B vs d1-2B at issue-3 — but its
  size/latency disqualify it as a profile.
- All accuracy observations come from 4 synthetic posts; nothing here gates model or
  threshold choices — the gold set (M4) does.

## Reproduction

```bash
# 1. llama-server (b11936, ubuntu x64 prebuilt; any build ≥ the d1 PRs works)
curl -sL -o llama-bin.tar.gz \
  https://github.com/ggml-org/llama.cpp/releases/download/b11936/llama-b11936-bin-ubuntu-x64.tar.gz
tar xzf llama-bin.tar.gz   # → llama-b11936/llama-server
export LLAMA_SERVER=$PWD/llama-b11936/llama-server

# 2. Path A — d1-3B (first run downloads the model from HuggingFace once)
python3 spike/run_path_a.py LiquidAI/d1-3B-GGUF:Q4_K_M

# 2b. Path A — d1-omni-600M
python3 spike/run_path_a.py LiquidAI/d1-omni-600M-GGUF:Q8_0 -b 4096 -ub 4096

# 3. Path B — LFM2.5-1.2B-Instruct chat + top-k logprobs
python3 spike/run_path_b.py LiquidAI/LFM2.5-1.2B-Instruct-GGUF:Q4_K_M

# 4. Path A against a running Ollama instead of llama-server (any install
#    whose vendored llama.cpp has the d1 decision support; verified on 0.40.12)
SPIKE_BASE_URL=http://<ollama-host>:11434 python3 spike/run_path_a.py d1-omni:latest
```

The order-reversal probe (Path B anchoring) was run ad hoc: same request as
`run_path_b.py` with the three class definitions in the system prompt listed
genuine-first — every post then answers `genuine` at ~0.99.

Harness scripts and posts are throwaway spike code (`spike/`); the reproduction
commands above are the durable artifact. Not wired into the extension, no unit
tests (per the issue's testing decisions: model-behavior claims are proven by the
recorded numbers, not tests).