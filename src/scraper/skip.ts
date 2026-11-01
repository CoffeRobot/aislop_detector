// Pure SKIP rules (TAXONOMY.md "SKIP rules") over plain facts extracted from
// the DOM by the adapter. No DOM here — every rule is unit-tested in
// tests/skip.test.ts.

export type SkipReason = 'promoted' | 'widget' | 'non_text' | 'too_short' | 'no_id'

/** Facts about one timeline cell, extracted by the adapter (src/scraper/adapter.ts). */
export interface PostCandidate {
  /** `/user/status/nnn`, or null when no status permalink was found. */
  id: string | null
  /** Text of the top-level post itself (nested articles excluded). */
  mainText: string
  /** Quoted-post text, folded into the judged text per the plan. */
  quotedText: string
  /** The cell carries X's ad-placement tracker. */
  isPromoted: boolean
  /** The cell is a Who-to-follow widget row. */
  isWidget: boolean
}

/** A candidate that passed every SKIP rule; the adapter scores exactly these. */
export type ScoreableCandidate = PostCandidate & { id: string }

/** Under this many words there is too little signal to judge (TAXONOMY: "~5"). */
export const MIN_WORDS = 5

/** The text the decision model judges: the post's own text plus quoted text. */
export function judgedText(c: PostCandidate): string {
  return [c.mainText, c.quotedText].filter((t) => t.trim() !== '').join('\n\n')
}

/**
 * Why a candidate must not be scored, or null when it should be. Order is
 * part of the contract: promoted/widget win over content rules, and no_id
 * (not a TAXONOMY rule, but without a stable id there is nothing to cache
 * or label later) falls out last.
 */
export function skipReason(c: PostCandidate): SkipReason | null {
  if (c.isPromoted) return 'promoted'
  if (c.isWidget) return 'widget'
  const text = judgedText(c)
  if (text === '') return 'non_text'
  if (wordCount(text) < MIN_WORDS) return 'too_short'
  if (c.id === null) return 'no_id'
  return null
}

/** Narrow a candidate to one that may be scored (SKIP-checked, id present). */
export function scoreable(c: PostCandidate): c is ScoreableCandidate {
  return c.id !== null && skipReason(c) === null
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * `/user/status/123?s=20` → `/user/status/123`; null for anything that is not
 * a status permalink (e.g. `/i/status/…` share links — `i` is X's own route,
 * not a user handle). The path is the stable per-post id the scoring cache
 * and label records reuse.
 */
export function normalizeStatusId(href: string): string | null {
  try {
    const path = new URL(href, 'https://x.invalid').pathname
    return /^\/(?!i\/)[^/]+\/status\/\d+$/.test(path) ? path : null
  } catch {
    return null
  }
}
