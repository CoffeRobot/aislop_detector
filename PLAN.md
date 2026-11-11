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

(2026-11-06)

- M1 and M2 complete: scaffold, local spike, in-browser harness, first-post tracer,
  skip markers, and whole-timeline async scoring (issue-5) are all merged. Every
  top-level home-timeline post gets three probability bars plus a click-through
  detail with exact probabilities, dominant class, and model/prompt/taxonomy
  versions, via a pure bounded-concurrency queue with per-post cache.
- Owner verified the whole-timeline flow in Brave on the real X timeline on
  2026-11-06 (PR #32 comment), which also closes the pending evidence gap for
  issue-4 and issue-15. "Extension context invalidated" after an extension reload
  is the expected MV3 symptom (refresh the tab), not a defect.
- Latency remains the main risk: ~31–37 s/post on CPU wasm. WebGPU, thread tuning,
  prompt-prefix caching, and a smaller d1 are candidate levers, not settled fixes.
- The wllama engine is built from source (issue-12, merged); swapping back to npm
  @wllama/wllama once it ships d1 support is issue-16.
- M3 and M4 have not started. Blur/stamp verdict UX, options, label export, gold
  set, and evidence-gated tuning remain unimplemented.

## Milestones

### M1 — Scaffold + decision-model validation spike · status: done
Completed 2026-10-29: the decision pattern yields per-class probabilities locally,
and issue-3 subsequently proved the same path in the MV3 offscreen document.

- M1-P1 — Repo scaffold: Vite + CRXJS + TypeScript + vitest; loads unpacked in Brave;
  module layout (scraper adapter isolated behind one file) · done (issue-1, PR #20,
  2026-10-26; Brave load confirmed by owner screenshot)
- M1-P2 — local validation spike (issue-2, split per owner direction 2026-10-27): both
  readout paths proved in a minimal local harness — (A) d1 decision model with
  per-option probabilities from full logits, (B) LFM2.5-1.2B-Instruct chat + top-k
  logprobs; full-vs-top-k difference quantified; per-post latency measured; path +
  model recommendation recorded (pending gold set). Findings → `docs/spike-wllama.md`
  · done (issue-2, PR #23, 2026-10-29; d1 full-logit path selected, LFM2.5 chat
  top-k path rejected on measured evidence)

### M2 — Score the timeline · status: done
Completed 2026-11-06: all three tracers merged and owner-verified in Brave on the
real X timeline (PR #32 comment, 2026-11-06).
- M2-P1 — Scraper adapter: MutationObserver + `article[data-testid="tweet"]` on
  the home timelines (For You + Following), top-level posts only (quoted text judged
  as part of the post); SKIP rules per TAXONOMY (promoted, <5 words, non-text)
  · done (issue-4, PR #28, 2026-11-01; issue-15, PR #31, 2026-11-01; owner Brave
  verification 2026-11-06)
- M2-P2 — Decision model wiring: TAXONOMY-driven prompt, class-token softmax →
  per-class probabilities; model + prompt versioned, not inlined
  · done (issue-3, PR #24, 2026-10-31): versioned prompt, validated probabilities,
  d1-3B Q4_K_M via wllama `createSystemOne` in an MV3 offscreen document; no
  free-form generation
- M2-P3 — Probability bars UI: one filled bar per class on every scored post;
  click-through detail (probabilities + what fired)
  · done (issue-5, PR #32, 2026-11-06): bars on every top-level post, click-through
  detail shows exact probabilities, dominant class, and model/prompt/taxonomy
  versions; class colors centralized in `src/decision/probabilities.ts`
- M2-P4 — Scoring queue: bounded concurrency (2–3), per-post cache, async — scrolling
  never blocks · done (issue-5, PR #32, 2026-11-06): pure queue module
  (`src/queue/scoringQueue.ts`) with capped backlog (drop-oldest) and LRU result /
  error caches, unit-tested; fast-scroll no-jank confirmed by owner in Brave

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

## Ticket Registry

Plan IDs are the ticket names (`issue-1 … issue-N`), assigned once, in plan order,
and never renumbered; GitHub's numbers are internal keys (rules: AGENTS.md → Ticket
numbering). This registry is the single source of the plan ID ↔ GitHub number mapping.

| plan ID | GitHub | ticket | state |
|---|---|---|---|
| issue-1 | #1 | M1-P1 scaffold | merged (PR #20, 2026-10-26) |
| issue-2 | #2 | M1-P2 local validation: d1 full-logit vs LFM2.5 chat top-k | merged (PR #23, 2026-10-29) |
| issue-3 | #14 | M2 tracer: paste-a-post harness (in-app integration of issue-2's validated path) | merged (PR #24, 2026-10-31) |
| issue-4 | #15 | M2 tracer: first visible post scored | merged (PR #28, 2026-11-01; owner Brave verification 2026-11-06) |
| issue-5 | #16 | M2 tracer: whole timeline async | merged (PR #32, 2026-11-06; owner Brave verification same day) |
| issue-6 | #17 | M3 tracer: blur + stamp + green pill | open |
| issue-7 | #18 | M3 tracer: options page | open |
| issue-8 | #19 | M3 tracer: confirm/correct → JSONL export | open |
| issue-9 | #12 | M4-P1a eval tooling | open |
| issue-10 | #13 | M4-P1b gold set v1 | open |
| issue-11 | #21 | Field: custom extension icon | merged (PR #22, 2026-10-26) |
| issue-12 | #25 | engine provenance: build wllama from source, replace vendored build | done (merged 57e71d3; #25 closed) |
| issue-13 | #26 | pre-commit quality & security gates (husky + lint-staged + prettier + eslint + commitlint + gitleaks) | merged (PR #27, 2026-10-31) |
| issue-14 | #29 | field: model-loading state visible (toolbar icon badge + loud in-post pill) | open (draft PR #33) |
| issue-15 | #30 | field: explicit per-post skip marker (sponsored / widget / too short / non-text / no id) | merged (PR #31, 2026-11-01; owner Brave verification 2026-11-06) |
| issue-16 | #35 | swap back to npm @wllama/wllama@3.13.0; retire the from-source vendored engine | open |

Next free plan ID: `issue-17`. Historical exception: the issue-11 work ran on branch
`issue-21` under the old numbering; the branch name is left as-is. The superseded
first-cut issues (GitHub #3–#11, never given plan IDs) are removed in this cleanup.

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

- wllama engine provenance — issue-12's from-source build is merged; swapping back
  to npm @wllama/wllama once it ships d1 support is issue-16. d1-2B was not evaluated
  because the available engine was too old.
- In-browser latency — ~31–37 s/post on CPU wasm. WebGPU, thread tuning,
  prompt-prefix caching, and a smaller d1 are candidate levers, not settled fixes.
  MV3 cross-origin isolation and the offscreen-document path are proven.
- Whether the LM Studio localhost bridge is worth adding after v1 — explicit v1
  non-goal, revisit only after M4.

## Glossary → GLOSSARY.md

Domain language lives in `GLOSSARY.md` at the repo root.

## Done Archive

- issue-1 — M1-P1 scaffold (merged via PR #20, 2026-10-26)
- issue-11 — Field: custom extension icon (merged via PR #22, 2026-10-26)
- issue-2 — M1-P2 local validation spike (merged via PR #23, 2026-10-29)
- issue-3 — M2 tracer: paste-a-post in-browser harness (merged via PR #24, 2026-10-31)
- issue-4 — M2 tracer: first visible timeline post scored (merged via PR #28,
  2026-11-01; owner Brave verification 2026-11-06)
- issue-13 — Pre-commit quality and security gates (merged via PR #27, 2026-10-31)
- issue-15 — Field: explicit per-post skip markers (merged via PR #31, 2026-11-01;
  owner Brave verification 2026-11-06)
- issue-12 — Engine provenance: build wllama from source (merged 57e71d3, 2026-11-06)
- issue-5 — M2 tracer: whole timeline async scoring (merged via PR #32, 2026-11-06;
  owner Brave verification same day — M2 complete)