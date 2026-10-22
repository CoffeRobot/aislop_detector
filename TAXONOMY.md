# TAXONOMY.md — Class Definitions

The single source of truth for what each class means. The decision prompt, the
confirm/correct UI, and the owner's labeling judgment all defer to this file. When
definitions change, label records keep their original label + a taxonomy version.

## Classes

- **`genuine`** — Real substance: firsthand experience, specific verifiable claims,
  original insight or perspective, honest signal of any kind. AI-*assisted* writing
  can be genuine — authorship does not disqualify substance.
- **`ai_slop`** — Machine-generated filler: LLM cadence tells ("it's not X, it's Y"
  pivots, tidy bows, importance-words with no information), generic advice, listicle
  padding, no personal anchor. Written *by* a machine *without* substance.
- **`rubbish`** — Low value regardless of author: engagement bait, hype and shilling,
  overclaiming, outrage farming, threadbait hooks, "10 habits" filler. Substance is
  the axis; a human hype thread is rubbish, not ai_slop.

## Tie-break: substance wins

When a post qualifies as both machine slop and hype/low-value (a bot-written
engagement thread), the substance axis decides: it is `rubbish`. `ai_slop` is
reserved for posts whose defining feature is the machine-generated-filler style
itself. Origin (human vs machine) can later become a secondary flag displayed next
to the verdict; it never overrides the substance axis.

## SKIP rules

Never scored (softmax never sees them, no bars shown):

- Promoted/sponsored posts and "Who to follow" widgets.
- Posts under ~5 words — too little signal to judge.
- Non-text posts: image/video-only with no meaningful caption text.

## Expansion procedure

The taxonomy is expandable by design. Adding a class:

1. Add the written definition here.
2. Add the class token to the decision prompt's constrained token set.
3. Add a bar color + TAXONOMY version bump.
4. Old label records remain valid under their taxonomy version.

## Taxonomy version

- v1 — 2026-10-22 — initial three classes (`ai_slop`, `rubbish`, `genuine`), tie-break
  and SKIP rules as settled in the grill session.