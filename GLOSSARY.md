# GLOSSARY.md — AISlop Detector

Domain language used across issues, PRs, code, and the PLAN.md. Keep it current when
terms are added or changed.

- **Decision model** — a small LLM used as a classifier: the next-token choice is
  constrained to the class tokens and each class's probability is read from the
  logits (softmax over classes). No free-form text output. The Jev-style pattern.
- **Class tokens** — the literal label tokens the model must choose among: `ai_slop`,
  `rubbish`, `genuine`. Expandable: a new class = a new token + a TAXONOMY.md entry.
- **Taxonomy** — the written class definitions + tie-break + SKIP rules, maintained
  in `TAXONOMY.md`. The source of truth for both prompts and labeling judgment.
- **Probability bars** — the core UI: one filled bar per class showing that class's
  probability. Never collapsed to a single verdict (owner-set decision).
- **Dominant class** — the class with the highest probability for a post.
- **Threshold** — dominant-class probability at/above which blur + stamp fires
  (default 70%, user-adjustable slider).
- **Stamp** — the Dr. Slump poop PNG (`assets/stamp.png`) overlaid on blurred posts.
  Copyright: personal use only; replace before any public release.
- **SKIP** — posts excluded from scoring: promoted/sponsored, under ~5 words, and
  non-text (image/video-only) posts. Softmax never sees them.
- **Tie-break (substance wins)** — a post that is both machine slop and hype is
  judged by substance: it goes to `rubbish`, not `ai_slop`. Origin can later become
  a secondary flag; it never overrides substance.
- **wllama** — WebAssembly build of llama.cpp running GGUF models in a browser
  worker; optional WebGPU acceleration. Chosen over WebLLM (no MLC compile step).
- **GGUF** — llama.cpp's model file format. LFM2.5 GGUFs ship officially from
  LiquidAI on HuggingFace; downloaded once, cached by the browser.
- **LFM2.5** — Liquid AI's small open-weight model family (LFM Open License v1.0).
  Sizes in play: 350M (fast), 1.2B-Instruct (default), 2.6B (quality).
- **Offscreen document** — MV3 API that hosts the model worker outside the page
  (the distil-labs extension pattern).
- **MutationObserver** — DOM API feeding newly rendered timeline posts to the
  scraper adapter.
- **Scoring queue** — bounded-concurrency (2–3) async queue with per-post cache;
  scrolling never blocks on the model.
- **Label record (JSONL)** — one owner-confirmed post: id, text, model
  probabilities, owner label, timestamp. Stored in `chrome.storage.local`, exported
  by button, never committed to git.
- **Confirm/correct** — the UI action where the owner validates or fixes a post's
  classification; every confirmation becomes ground truth.
- **Gold set** — ≥50 owner-confirmed label records; the acceptance test. Model,
  prompt, or threshold tuning only happens after the confusion matrix on the gold
  set says so.
- **Confusion matrix** — per-class accuracy breakdown on the gold set; the gate for
  tuning. The `ai_slop` ↔ `rubbish` cell is the expected trouble spot.
- **Ground truth** — the owner's confirmed labels. The only arbiter of correctness;
  no external dataset overrides it.