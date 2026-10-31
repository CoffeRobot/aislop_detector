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
npm test           # type-check (tsc) + unit tests (vitest)
npm run type-check # types only
npm run lint       # ESLint over the repo
npm run format     # Prettier --write over the repo (see .prettierignore)
```

## Pre-commit hooks

`npm install` installs [husky](https://typicode.github.io/husky/) git hooks (via the
`prepare` script). From then on every `git commit` runs, in order:

1. **lint-staged** — on staged files only: ESLint (`--fix`), Prettier (`--write`),
   and vitest on tests related to the staged source (`test:staged`)
2. **gitleaks** — secret scan of the staged content (`gitleaks protect --staged`)
3. **tsc --noEmit** — full type check

The `commit-msg` hook additionally runs **commitlint** to enforce Conventional
Commits (`feat:`, `fix:`, `docs:`, `chore:`, …).

Requirements beyond npm:

- **gitleaks** (>= 8): `brew install gitleaks` — if missing, the hook warns and
  skips the secret scan (all other gates still run)

Emergency bypass (rare, justified use only): `git commit --no-verify`.


## Load the extension in Brave

1. `npm run build` (needs a fresh `dist/`)
2. Open `brave://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the repo's `dist/` folder
5. After code changes: rebuild, then hit **Reload** (↻) on the extension card

## Run the decision-model spike locally

Findings and full reproduction details: [`docs/spike-wllama.md`](docs/spike-wllama.md).
`spike/` is throwaway harness code (see the doc); it is not part of the extension.

### Easiest: an existing Ollama (≥ 0.40.x, vendored llama.cpp with d1 decision
### support — verified on 0.40.12)

```bash
# on the Ollama host (Windows): pull the decision models once
ollama pull d1        # the 3B decision model — fits a 12 GB GPU easily
ollama pull d1-omni   # the 600M small option

# then, from the repo root (WSL in our setup — reach the host Ollama over the LAN/Tailscale):
SPIKE_BASE_URL=http://<ollama-host>:11434 python3 spike/run_path_a.py d1:latest
SPIKE_BASE_URL=http://<ollama-host>:11434 python3 spike/run_path_a.py d1-omni:latest
```

Each run prints per-post per-class probabilities and cold/warm latency for the
4 synthetic posts in `spike/posts.jsonl` (3 rounds; first request after a load is
the cold one). Path B (LFM2.5-1.2B chat + top-k logprobs) needs llama-server
below — LFM2.5-1.2B-Instruct is not in the Ollama registry.

### Alternative: llama-server (what the recorded numbers in the doc were measured on)

```bash
# Path A — d1 decision model, per-option probabilities from full logits
python3 spike/run_path_a.py LiquidAI/d1-3B-GGUF:Q4_K_M
python3 spike/run_path_a.py LiquidAI/d1-omni-600M-GGUF:Q8_0 -b 4096 -ub 4096

# Path B — LFM2.5-1.2B-Instruct chat + top-k logprobs
python3 spike/run_path_b.py LiquidAI/LFM2.5-1.2B-Instruct-GGUF:Q4_K_M
```

`llama-server` must be llama.cpp ≥ 0.7.0 / after the d1 PRs #30110+#30114 and
reachable via `$LLAMA_SERVER`; first run downloads each model from HuggingFace
once (Q4 d1-3B ≈ 1.9 GB, d1-omni-600M ≈ 0.64 GB, 1.2B ≈ 0.75 GB).

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