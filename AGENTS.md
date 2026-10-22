# AGENTS.md — AISlop Detector

Contract for any implementer working in this repo, human or coding agent. Once the
GitHub remote exists, the issue tracker is the only work queue; until then Alessandro
directs work explicitly. This file and the issue templates are the whole contract.
When instructions conflict: the specific issue wins over this file, and Alessandro's
direction wins over both.

## Working from tickets

- Every change starts from an issue (once the remote exists). No issue for the change
  you think is needed = stop and say so; never freelance scope.
- Read the issue in full before touching code. Issues are self-contained: problem,
  expected behavior, acceptance criteria, non-goals, pointers. If a requirement is
  ambiguous or contradicts this file, comment on the issue with the concrete blocker
  and stop — never guess or silently invent requirements.
- Before starting work, comment on the issue saying you are taking it and from which
  commit, and set the label `status: claimed`. Then create branch `issue-<n>` from the
  default branch. Skip the issue if it already carries `status: claimed`,
  `status: has-pr`, or `status: done`, or if an open PR references it.
- One issue = one branch = one PR. Reference the issue with `Fixes #<n>` in the PR body.
- Blocked for more than ~15 minutes on anything: comment with the exact blocker and
  what you tried, then stop. Never work around missing inputs by inventing data.

## What this repo is

- A personal-use Chrome-family (MV3) extension, built for and tested in **Brave**,
  that scores X timeline posts with an in-browser decision model and shows a
  probability bar per class (`ai_slop`, `rubbish`, `genuine`). See PLAN.md + GLOSSARY.md.
- **Everything runs locally.** No cloud APIs, no accounts, no telemetry. The only
  network egress at runtime is the one-time HuggingFace model download.
- Personal-use scope: no store listing. Note the stamp asset license constraint below.

## Engineering floor

- TypeScript + Vite + CRXJS (MV3). Pure logic (probability extraction, thresholds,
  queue, feature tells) in plain TS modules covered by vitest; DOM scraping thin and
  isolated behind one adapter module (X markup churns; selectors live in one file).
- Runtime dependency budget: `@wllama/wllama` plus its transitive needs; anything else
  must be justified in the PR.
- The decision model is a *constrained choice over class tokens* (see GLOSSARY.md),
  not free-form text generation. Keep prompts and class definitions in versioned
  files (TAXONOMY.md), never inlined in multiple places.
- Never block scrolling: scoring is async with bounded concurrency and a per-post
  cache. A score arriving late is fine; a janky timeline is a defect.

## Data hygiene (one-way invariants)

- Never commit labeled post data, label exports, scraped timelines, credentials, or
  API keys. `data/` and `exports/` are gitignored — add ignore entries before
  producing any such files.
- Owner labels are ground truth and stay on the owner's machine.
- The stamp image `assets/stamp.png` (Dr. Slump character) is copyright-protected
  fan-sourced art: fine for personal use, **must not ship in any published release**.
  Publication requires replacing it first — that swap is non-negotiable.

## Definition of done

A PR is done when:

1. Every acceptance criterion in the issue is demonstrably met, reported as a
   checklist: criterion → how it is proven.
2. The extension was loaded unpacked in Brave and the real X timeline was exercised
   end-to-end, not only unit pieces.
3. Relevant tests added and passing where test infrastructure exists; otherwise
   manual proof with exact commands and output in the PR body.
4. The PR body follows the template: What Problem This Solves / User Impact / Why
   This Change Was Made / Evidence / `Fixes #<n>`.
5. No secrets, tokens, labeled data, or private post content in commits, logs, or proof.

## Commits and pushes

- Conventional commits, small and coherent: `feat:`, `fix:`, `docs:`, `chore:`.
- Never force-push. Push to `origin`; open the PR against the default branch.
- Plan/kit edits (PLAN.md, GLOSSARY.md, AGENTS.md) are docs-only commits — never
  bundle application code into them.

## Evidence rules

- Screenshots for anything visual (bars, blur, stamp, options page) — before/after.
- For model-behavior claims: the actual per-class probabilities from real runs.
- Redact handles/post text in proof screenshots unless the post is public boilerplate.

## Review loop

- Treat review comments as the action list. Patch minimally, run relevant checks,
  push, then reply to each addressed comment with the fix and commit reference.
- Update the PR body when the problem, solution, or evidence changes.
- Scope creep from review → flag on the issue; Alessandro decides.