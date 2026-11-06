// Scraper adapter: the only module that touches X's DOM. A MutationObserver
// drives it; each timeline cell is extracted as plain facts, the pure SKIP
// rules (skip.ts) decide, and the first visible scoreable post is scored
// end-to-end through the offscreen pipeline and gets the three probability
// bars. Selectors live in selectors.ts; decisions in skip.ts; this file is
// the thin glue between DOM and pure logic. v1 surface: home timelines only.

import type { ModelStatus, ScoreResult } from '../decision/classifier'
import { CLASS_IDS, type ClassId } from '../decision/probabilities'
import * as S from './selectors'
import {
  isExplicitPromotedLabel,
  judgedText,
  normalizeStatusId,
  scoreable,
  skipMarkerText,
  skipReason,
  type PostCandidate,
  type ScoreableCandidate,
  type SkipReason,
} from './skip'

// Per-post cache keyed by the stable id — issue-5 grows this into the whole
// timeline queue. Kept in the content script so a re-rendered post never
// scores twice.
const scored = new Map<string, ScoreResult>()
const pending = new Set<string>()

// Our badge on a cell, keyed by the post id it belongs to — X's virtualizer
// recycles cells, so a badge for the wrong post is rebuilt, not reused.
const BADGE_ID_ATTR = 'data-aislop-badge-id'

// The skip marker on a cell, holding the skip reason. Its own attribute, so
// it never collides with the score badge of a recycled cell.
const SKIP_ATTR = 'data-aislop-skip'

const BAR_COLORS: Record<ClassId, string> = {
  ai_slop: '#e5484d',
  rubbish: '#f5a623',
  genuine: '#46a758',
}

// Base container style for the score badge; loading/error/scoring pills override it.
const BADGE_BASE_STYLE = 'padding:6px 16px;font:12px system-ui;color:#9a9'

// Loud in-post status pill: high-contrast rounded badge so the loading/error
// state is visible at a glance against X's timeline.
const pillStyle = (background: string) =>
  `display:inline-block;padding:4px 10px;border-radius:999px;font:12px/1.2 system-ui,sans-serif;font-weight:600;color:#fff;background:${background};margin:6px 16px;`

export function start(): void {
  new MutationObserver(scheduleTick).observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
  tick()
  // Wake the model and update the toolbar badge on every X page, even before a
  // scoreable post appears. The offscreen document will broadcast its status to
  // the background service worker.
  void chrome.runtime.sendMessage({ type: 'status' }).catch(() => null)
}

let tickQueued = false
function scheduleTick(): void {
  if (tickQueued) return
  tickQueued = true
  setTimeout(() => {
    tickQueued = false
    tick()
  }, 200)
}

function tick(): void {
  // Home timelines only (For You + Following): the v1 surface, owner-set.
  if (!location.pathname.startsWith('/home')) return
  // Only the first visible scoreable post is scored (issue-4), one scoring
  // in flight at a time; the whole timeline is issue-5. Skipped cells are
  // marked along the way, so the scan continues past that post.
  let scoredFirst = false
  for (const cell of document.querySelectorAll<HTMLElement>(S.TIMELINE_CELL)) {
    const candidate = extractCandidate(cell)
    if (!candidate) {
      clearSkipMarker(cell)
      continue
    }
    if (!scoreable(candidate)) {
      // Skipped: say why, so silence never reads as "the extension is broken".
      const reason = skipReason(candidate)
      if (reason !== null) renderSkipMarker(cell, reason)
      continue
    }
    // The cell was recycled onto a scoreable post: its old marker is stale.
    clearSkipMarker(cell)
    if (scoredFirst || !isVisible(cell)) continue
    scoredFirst = true
    const cached = scored.get(candidate.id)
    if (cached) renderBars(cell, candidate.id, cached)
    else if (pending.size === 0) void scoreCell(cell, candidate)
  }
}

/** Facts about one timeline cell, for the pure SKIP rules. */
function extractCandidate(cell: HTMLElement): PostCandidate | null {
  const article = topLevelArticle(cell)
  if (!article) {
    // A widget cell is a candidate so the Who-to-follow rule stays pure and
    // tested; cells with neither a post nor a widget are not posts at all.
    return cell.querySelector(S.WHO_TO_FOLLOW)
      ? { id: null, mainText: '', quotedText: '', isPromoted: false, isWidget: true }
      : null
  }
  const href = firstStatusHref(article)
  return {
    id: href ? normalizeStatusId(href) : null,
    mainText: textsIn(article, false).join('\n'),
    quotedText: textsIn(article, true).join('\n'),
    isPromoted: isPromotedCell(cell),
    isWidget: false,
  }
}

/** Whether X visibly labels this cell as an ad. Tracking wrappers alone are not proof. */
function isPromotedCell(cell: HTMLElement): boolean {
  if (
    [...cell.querySelectorAll<HTMLElement>(S.PROMOTED_LABEL_SOURCES)].some(carriesPromotedLabel)
  ) {
    return true
  }
  // The text scan is the heavy path; ad cells always carry the placement wrapper.
  if (!cell.querySelector(S.PROMOTED_TRACKER)) return false
  return [...cell.querySelectorAll<HTMLElement>(S.PROMOTED_TEXT_SOURCES)].some(carriesPromotedLabel)
}

/** Whether one element states an ad label, ignoring post text and display names. */
function carriesPromotedLabel(element: HTMLElement): boolean {
  if (element.closest(S.TWEET_TEXT) || element.closest(S.USER_NAME)) return false
  if (isExplicitPromotedLabel(element.getAttribute('aria-label') ?? '')) return true
  const text =
    element.tagName === 'SPAN'
      ? [...element.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent ?? '')
          .join('')
          .trim()
      : (element.textContent ?? '').trim()
  return isExplicitPromotedLabel(text)
}

/** The unnested post article of a cell, or null — nested articles are quoted
 * tweets (their text folds into the judged text; they are never scored alone). */
function topLevelArticle(cell: HTMLElement): HTMLElement | null {
  for (const a of cell.querySelectorAll<HTMLElement>(S.TWEET_ARTICLE)) {
    if (a.parentElement?.closest('article') === null) return a
  }
  return null
}

/** Tweet texts inside the article: its own, or the nested ones' for quoted text. */
function textsIn(article: HTMLElement, nested: boolean): string[] {
  const texts: string[] = []
  for (const t of article.querySelectorAll<HTMLElement>(S.TWEET_TEXT)) {
    if ((t.closest('article') !== article) === nested) texts.push(t.textContent ?? '')
  }
  return texts
}

/** The post's own permalink href — a status link not owned by a nested article. */
function firstStatusHref(article: HTMLElement): string | null {
  for (const a of article.querySelectorAll<HTMLAnchorElement>(S.STATUS_LINK)) {
    if (a.closest('article') === article) return a.getAttribute('href')
  }
  return null
}

function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  return r.height > 0 && r.bottom > 0 && r.top < window.innerHeight
}

async function scoreCell(cell: HTMLElement, candidate: ScoreableCandidate): Promise<void> {
  pending.add(candidate.id)
  const badge = renderBadge(cell, candidate.id)
  renderLoadingPill(badge)

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  try {
    // Content scripts cannot call chrome.offscreen; the background does it.
    await chrome.runtime.sendMessage({ type: 'ensure-offscreen' })

    // Poll model status while it loads so the in-post pill and toolbar badge
    // stay in sync. Abort early on error; proceed once ready.
    while (true) {
      const s = (await chrome.runtime
        .sendMessage({ type: 'status' })
        .catch(() => null)) as ModelStatus | null
      if (!s) {
        await sleep(500)
        continue
      }
      if (s.phase === 'loading') {
        renderLoadingPill(badge)
        await sleep(500)
      } else if (s.phase === 'error') {
        throw new Error(s.detail ?? 'model failed')
      } else {
        // ready
        break
      }
    }

    renderScoringPill(badge)
    const result = await requestScore(judgedText(candidate))
    scored.set(candidate.id, result)
    // X may have recycled this cell; reconcile the result against current posts.
    tick()
  } catch (err) {
    renderErrorPill(badge, String((err as Error)?.message ?? err))
  } finally {
    pending.delete(candidate.id)
  }
}

/** Score via the offscreen document; retry while that document is still
 * loading (a message sent into an unregistered listener resolves undefined). */
async function requestScore(text: string): Promise<ScoreResult> {
  const lastError = new Error('no response')
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const r = await chrome.runtime.sendMessage({ type: 'score', text })
      if (r && typeof r === 'object' && 'probabilities' in r) return r as ScoreResult
      if (r && typeof r === 'object' && 'error' in r) {
        throw new Error(String((r as { error: unknown }).error))
      }
    } catch (err) {
      Object.assign(lastError, { message: String((err as Error)?.message ?? err) })
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw lastError
}

/** Say why a post was not scored: a marker, never bars or probabilities
 * (TAXONOMY SKIP rules — a skipped post is not a score). */
function renderSkipMarker(cell: HTMLElement, reason: SkipReason): void {
  // A recycled cell may still carry the previous post's bars — drop them.
  cell.querySelector(`[${BADGE_ID_ATTR}]`)?.remove()
  const existing = cell.querySelector<HTMLElement>(`[${SKIP_ATTR}]`)
  if (existing?.getAttribute(SKIP_ATTR) === reason) return
  existing?.remove()
  const marker = document.createElement('div')
  marker.setAttribute(SKIP_ATTR, reason)
  marker.style.cssText = 'padding:2px 16px;font:11px system-ui;color:#767676'
  marker.textContent = skipMarkerText(reason)
  cell.appendChild(marker)
}

/** Drop a stale skip marker (the cell now holds a scoreable post). */
function clearSkipMarker(cell: HTMLElement): void {
  cell.querySelector(`[${SKIP_ATTR}]`)?.remove()
}

/** The cell's badge for `id`, or a fresh one; rebuilt when X recycled the cell. */
function renderBadge(cell: HTMLElement, id: string): HTMLElement {
  const existing = cell.querySelector<HTMLElement>(`[${BADGE_ID_ATTR}]`)
  if (existing?.getAttribute(BADGE_ID_ATTR) === id) {
    existing.textContent = ''
    existing.style.cssText = BADGE_BASE_STYLE
    return existing
  }
  existing?.remove()
  const badge = document.createElement('div')
  badge.setAttribute(BADGE_ID_ATTR, id)
  badge.style.cssText = BADGE_BASE_STYLE
  cell.appendChild(badge)
  return badge
}

/** Loud loading pill: orange rounded badge so the load is visible at a glance. */
function renderLoadingPill(badge: HTMLElement): void {
  badge.textContent = 'aislop: loading model…'
  badge.style.cssText = pillStyle('#f5a623')
}

/** Transient "scoring…" pill shown after the model is ready but before bars render. */
function renderScoringPill(badge: HTMLElement): void {
  badge.textContent = 'aislop: scoring…'
  badge.style.cssText = pillStyle('#3b82f6')
}

/** Red pill naming the failure so a broken model is not silent. */
function renderErrorPill(badge: HTMLElement, message: string): void {
  badge.textContent = `aislop: ${message}`
  badge.style.cssText = pillStyle('#e5484d')
}

/** The three probability bars — one per class, fill = probability. */
function renderBars(cell: HTMLElement, id: string, r: ScoreResult): void {
  const badge = renderBadge(cell, id)
  for (const cls of CLASS_IDS) {
    const p = r.probabilities[cls]
    const row = document.createElement('div')
    row.style.cssText =
      'display:grid;grid-template-columns:7em 1fr 3.5em;gap:.5em;align-items:center;margin:.2em 0'
    const label = document.createElement('span')
    label.textContent = cls
    label.style.cssText = `font-size:.9em;opacity:${r.dominant === cls ? 1 : 0.55}`
    const track = document.createElement('span')
    track.style.cssText = 'display:block;background:#333;border-radius:3px;height:.7em'
    const fill = document.createElement('span')
    fill.style.cssText = `display:block;height:100%;border-radius:3px;background:${BAR_COLORS[cls]};width:${(p * 100).toFixed(1)}%`
    track.appendChild(fill)
    const value = document.createElement('span')
    value.textContent = p.toFixed(3)
    value.style.cssText = 'text-align:right;font-variant-numeric:tabular-nums;font-size:.9em'
    row.append(label, track, value)
    badge.appendChild(row)
  }
}
