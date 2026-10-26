---
autonomy: co-draft        # none | co-draft | full
ops: direct               # direct | orchestrated — who drives the coder (default: direct)
---

# AISlop Detector — Plan

Plan-of-record for this repo. Authored 2026-10-22 from the settled grill session —
this is a fresh scaffold under the product-dev workflow, planned before any code.

## Vision

X is full of AI slop and populistic things the owner is not interested in; he wants a
filter. AISlop Detector is a personal-use, fully local browser extension (Chrome-family MV3, built for and
tested in Brave) that scores every X timeline post with an open-weight decision model
running in the browser, and shows a **probability bar per class** — `ai_slop`,
`rubbish`, `genuine` — never a single collapsed verdict. Posts whose dominant class
is `ai_slop` or `rubbish` at/above a threshold get blurred and stamped. The owner's
confirm/correct labels are the ground truth and build a gold set that gates all
model/prompt/threshold tuning. Built by the owner as a learning project: the
decision-model core (taxonomy, prompt, probability extraction) is his to implement;
boilerplate is delegable. Everything runs locally — no cloud APIs, no accounts; the
only runtime egress is the one-time HuggingFace model download.

## Current State

(2026-10-22)

- Repo born today: owner created the empty folder; this kit (AGENTS.md, GLOSSARY.md,
  PLAN.md, TAXONOMY.md, `assets/stamp.png`, .gitignore) is the docs-only first commit.
- No application code, no GitHub remote yet, no issues.
- Prior art surveyed in the grill: slop-filter, jev-slop-guard (both Jev-based, binary
  slop/not-slop), distil-ai-slop-detector (in-browser GGUF, binary), sloptrim
  (heuristics). None ships a three-way substance taxonomy with per-class probability
  bars — that is this project's space.

(2026-10-23)

- to-spec review pass against the vault template: Decision Log doors normalized,
  testing doctrine and problem statement added, v1 surface scope settled — home
  timelines only (owner decision).

## Milestones

### M1 — Scaffold + in-browser decision-model spike · status: active
The gate milestone: proves the model runs and yields per-class probabilities inside
MV3 before anything else is built on top.

- M1-P1 — Repo scaffold: Vite + CRXJS + TypeScript + vitest; loads unpacked in Brave;
  module layout (scraper adapter isolated behind one file) · todo
- M1-P2 — wllama decision spike: LFM2.5-1.2B-Instruct Q4 GGUF loaded from HuggingFace
  in an MV3 offscreen document; constrained class-token choice with logit access
  verified; WebGPU vs WASM-SIMD behavior in Brave documented (incl. COOP/COEP
  constraint); per-post latency measured · todo

### M2 — Score the timeline · status: todo
- M2-P1 — Scraper adapter: MutationObserver + `article[data-testid="tweet"]` on
  the home timelines (For You + Following), top-level posts only (quoted text judged
  as part of the post); SKIP rules per TAXONOMY (promoted, <5 words, non-text) · todo
- M2-P2 — Decision model wiring: TAXONOMY-driven prompt, class-token softmax →
  per-class probabilities; model + prompt versioned, not inlined · todo
- M2-P3 — Probability bars UI: one filled bar per class on every scored post;
  click-through detail (probabilities + what fired) · todo
- M2-P4 — Scoring queue: bounded concurrency (2–3), per-post cache, async — scrolling
  never blocks · todo

### M3 — Verdict UX: blur, stamp, options, labels · status: todo
- M3-P1 — Blur + stamp: dominant class ∈ {ai_slop, rubbish} ∧ p ≥ threshold
  (default 70%) → blur + Dr. Slump stamp overlay; click-to-reveal; `genuine` gets a
  small green pill, no blur · todo
- M3-P2 — Options page: threshold slider, model profile dropdown (350M fast /
  1.2B default / 2.6B quality), pause/start · todo
- M3-P3 — Confirm/correct UI + label store: owner validates or fixes each post's
  classification; JSONL label records (id, text, probabilities, owner label,
  timestamp, taxonomy version) to `chrome.storage.local`; export button · todo

### M4 — Evaluate, then tune · status: todo
No model/prompt/threshold tuning before this milestone's evidence exists.

- M4-P1 — Gold set: ≥50 owner-confirmed labels; confusion matrix + calibration check
  generated from the export · todo
- M4-P2 — Evidence-driven tuning: threshold, model-size default, prompt adjustments —
  each justified against the gold set; `ai_slop` ↔ `rubbish` confusion is the expected
  trouble spot · todo

## Decision Log

Settled in the 2026-10-22 grill session; amended in the 2026-10-23 to-spec review.

- 2026-10-22 — Goal: learning project (owner implements the decision-model core
  himself), with a usable personal tool as the acceptance bar; publishing is a
  post-hoc option. (owner-set; one-way)
- 2026-10-22 — Three classes `ai_slop`, `rubbish`, `genuine`; taxonomy expandable via
  new class tokens + TAXONOMY.md entries. Tie-break: substance wins (hype thread →
  `rubbish`); SKIP path for short/promoted/non-text posts. (two-way)
- 2026-10-22 — UI shows a probability bar per class — never collapsed to a single
  verdict. (owner-set; one-way — do not reopen)
- 2026-10-22 — Blur + stamp when dominant ∈ {ai_slop, rubbish} ∧ p ≥ 70% (slider);
  stamp image = Dr. Slump poop PNG. (two-way mechanism; image owner-set)
- 2026-10-22 — Fully in-browser model via wllama (GGUF from HuggingFace, cached);
  no cloud APIs; localhost LM Studio bridge is a possible later option, v1 non-goal.
  (one-way for v1)
- 2026-10-22 — Model family: Liquid AI LFM2.5 open weights (LFM Open License v1.0);
  default 1.2B-Instruct Q4 pending spike + gold-set evidence; 350M/2.6B as profiles.
  (two-way, evidence-gated)
- 2026-10-22 — Ground truth = owner-confirmed labels via confirm/correct UI from the
  start; ≥50 labels form the gold set that gates all tuning. (owner-set; one-way)
- 2026-10-22 — Stamp art is copyright Dr. Slump (fan-sourced): personal use only;
  must be replaced before any public release. (one-way)
- 2026-10-26 — Extension icon art `assets/poo.png` is owner-supplied, assumed same
  Dr. Slump provenance as the stamp art: personal use only; replaced together with
  the stamp before any public release. (one-way)
- 2026-10-22 — Personal-use scope, Brave first; no store listing planned. (two-way)
- 2026-10-22 — Repo kit follows the product-dev workflow: issue-first, one PR per
  concern, docs-only kit commits; ops direct (boilerplate delegable to
  workspace-coder, core owner-implemented). (two-way)
- 2026-10-23 — v1 scores the home timelines only: For You + Following, top-level
  posts (quoted text judged as part of the post). Other surfaces — profile pages,
  threads/replies, search — are added only after the timeline flow works end-to-end.
  (owner-set; two-way sequencing)
- 2026-10-23 — Testing doctrine: pure logic (probability extraction, thresholds,
  queue, SKIP rules) is unit-tested at the classifier-adapter seam with vitest; DOM
  scraping gets no selector tests — proven only by manual end-to-end evidence in
  Brave on the real timeline (X markup churns; selector tests rot); model-behavior
  claims are proven by real per-class probabilities from real runs in PR evidence.
  Every ticket carries its own explicit Testing Decisions section. (two-way)

## Open Questions

- wllama's exact logit/decision API surface inside an MV3 offscreen document, and
  WebGPU behavior in Brave (incl. COOP/COEP multi-thread constraint) — spike M1-P2
  answers before model size commits.
- GitHub remote creation (CoffeRobot org, private repo) — Alessandro decides when
  first code lands; until then the local repo is the source of truth.
- Whether the LM Studio localhost bridge is worth adding after v1 — explicit v1
  non-goal, revisit only after M4.

## Glossary → GLOSSARY.md

Domain language lives in `GLOSSARY.md` at the repo root.

## Done Archive

(nothing merged yet)

- —