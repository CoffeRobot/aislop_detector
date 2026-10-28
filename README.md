# AISlop Detector

A personal-use Chrome-family (MV3) extension — built for and tested in **Brave** —
that scores X timeline posts with an open-weight decision model running entirely in
the browser, showing a probability bar per class: `ai_slop`, `rubbish`, `genuine`.
Posts dominated by `ai_slop` or `rubbish` get blurred and stamped; the owner's
confirm/correct labels build the gold set that gates all tuning.

Everything runs locally. No cloud APIs, no accounts, no telemetry. The only planned
runtime network egress is the one-time HuggingFace model download.

## Prerequisites

- Node.js ≥ 20
- npm (bundled with Node)
- Brave (or any Chrome-family browser)

## Build and test

```bash
npm install        # once, after cloning / pulling new dependencies
npm run build      # → production build in dist/
npm test           # typecheck (tsc) + unit tests (vitest)
npm run typecheck  # types only
```

## Load the extension in Brave

1. `npm run build` (needs a fresh `dist/`)
2. Open `brave://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the repo's `dist/` folder
5. After code changes: rebuild, then hit **Reload** (↻) on the extension card

## Run the decision-model spike locally

Findings and full reproduction details: [`docs/spike-wllama.md`](docs/spike-wllama.md).
You need `llama-server` (llama.cpp ≥ 0.7.0 / after the d1 PRs #30110+#30114)
reachable via `$LLAMA_SERVER` — first run downloads each model from
HuggingFace once (Q4 d1-3B ≈ 1.9 GB, d1-omni-600M ≈ 0.64 GB, 1.2B ≈ 0.75 GB):

```bash
# Path A — d1 decision model, per-option probabilities from full logits
python3 spike/run_path_a.py LiquidAI/d1-3B-GGUF:Q4_K_M
python3 spike/run_path_a.py LiquidAI/d1-omni-600M-GGUF:Q8_0 -b 4096 -ub 4096

# Path B — LFM2.5-1.2B-Instruct chat + top-k logprobs
python3 spike/run_path_b.py LiquidAI/LFM2.5-1.2B-Instruct-GGUF:Q4_K_M
```

`spike/` is throwaway harness code (see the doc); it is not part of the extension.

## Project layout

| Path | What it is |
|---|---|
| `src/` | Extension source (background, content script, scraper adapter) |
| `tests/` | Vitest unit tests (pure logic; DOM scraping is proven manually) |
| `dist/` | Build output — load this in Brave, not the repo root |
| `manifest.config.ts` | MV3 manifest source, compiled by CRXJS into `dist/manifest.json` |
| `docs/` | Findings and decision records (e.g. the issue-2 spike report) |
| `PLAN.md` | Plan of record: milestones, decision log, ticket registry |
| `TAXONOMY.md` | Class definitions and prompts (versioned, never inlined in code) |
| `GLOSSARY.md` | Domain language |
| `AGENTS.md` | Contract for anyone (human or agent) implementing in this repo |

## Status

Scaffold milestone (M1-P1) merged; the next gate is the local decision-model
validation spike (issue-2): d1 decision model with full-logit per-option
probabilities vs LFM2.5 chat + top-k logprobs. No model wiring exists in the
extension yet.

## License constraints (personal use only)

`assets/stamp.png` and `assets/poo.png` are copyright-protected fan-sourced Dr.
Slump art. Fine for personal use; **must not ship in any published release** —
publication requires replacing both first.