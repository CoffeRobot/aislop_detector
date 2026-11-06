// Scraper adapter: the only module that touches X's DOM. A MutationObserver
// drives it; each timeline cell is extracted as plain facts, the pure SKIP
// rules (skip.ts) decide, and every top-level post is scored asynchronously
// through the bounded-concurrency queue, getting three probability bars plus a
// click-through detail. Selectors live in selectors.ts; decisions in skip.ts;
// queue logic in queue/scoringQueue.ts. v1 surface: home timelines only.

import type { ScoreResult } from '../decision/classifier'
import { CLASS_COLORS, CLASS_IDS } from '../decision/probabilities'
import { createScoringQueue } from '../queue/scoringQueue'
import * as S from './selectors'
import {
  isExplicitPromotedLabel,
  judgedText,
  normalizeStatusId,
  scoreable,
  skipMarkerText,
  skipReason,
  type PostCandidate,
  type SkipReason,
} from './skip'

// Bounded-concurrency queue: at most this many classifier calls in parallel.
const SCORING_CONCURRENCY = 2
// Max queued (not yet running) posts. Once scrolling outpaces the model, the
// oldest unstarted job is dropped so memory does not grow without bound.
const MAX_BACKLOG = 20
// Cap cached results and errors so a long scrolling session does not grow
// these maps without bound. Both use insertion-order eviction (LRU-ish).
const MAX_CACHED_RESULTS = 1000
const MAX_CACHED_ERRORS = 500

const queue = createScoringQueue<ScoreResult>({
  concurrency: SCORING_CONCURRENCY,
  maxBacklog: MAX_BACKLOG,
  maxCacheSize: MAX_CACHED_RESULTS,
  classify: (text) => requestScore(text),
  onResult: () => scheduleTick(),
  onError: (id, err) => {
    recordError(id, String((err as Error)?.message ?? err))
    scheduleTick()
  },
})

// Per-post error state: ids whose classifier call failed are shown as failed and
// not resubmitted in this session.
const errored = new Map<string, string>()

function recordError(id: string, message: string): void {
  if (errored.size >= MAX_CACHED_ERRORS) {
    const first = errored.keys().next().value
    if (first !== undefined) errored.delete(first)
  }
  errored.set(id, message)
}

// Our badge on a cell, keyed by the post id it belongs to — X's virtualizer
// recycles cells, so a badge for the wrong post is rebuilt, not reused.
const BADGE_ID_ATTR = 'data-aislop-badge-id'

// The skip marker on a cell, holding the skip reason. Its own attribute, so
// it never collides with the score badge of a recycled cell.
const SKIP_ATTR = 'data-aislop-skip'

// Detail panel inside a badge; hidden until the user clicks the badge.
const DETAIL_ATTR = 'data-aislop-detail'
// Guard so the badge click listener is attached at most once.
const DETAIL_LISTENER_ATTR = 'data-aislop-detail-listener'
// Marker on each probability bar row so renderBars can skip rebuilds.
const BAR_ATTR = 'data-aislop-bar'

export function start(): void {
  new MutationObserver(scheduleTick).observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
  tick()
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
  // Walk every timeline cell: scoreable posts get bars (cached or queued);
  // skipped posts get a reason marker; unscored posts show nothing until
  // their score lands. Scrolling is never blocked — the queue bounds work.
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
    const cached = queue.result(candidate.id)
    if (cached) {
      renderBars(cell, candidate.id, cached)
    } else if (errored.has(candidate.id)) {
      // Refresh the entry so long-visible failed posts are not retried once
      // the capped error map evicts older ids under pressure.
      const message = errored.get(candidate.id)!
      errored.delete(candidate.id)
      errored.set(candidate.id, message)
      renderError(cell, candidate.id, message)
    } else if (!queue.has(candidate.id)) {
      queue.submit(candidate.id, judgedText(candidate))
    }
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

/** Score via the offscreen document; retry while that document is still
 * loading (a message sent into an unregistered listener resolves undefined). */
async function requestScore(text: string): Promise<ScoreResult> {
  // Ensure the offscreen document exists before the first real score request.
  await chrome.runtime.sendMessage({ type: 'ensure-offscreen' })
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
    // Keep the existing badge so click listeners and open detail panels survive
    // the 200 ms DOM reconciliation tick.
    return existing
  }
  existing?.remove()
  const badge = document.createElement('div')
  badge.setAttribute(BADGE_ID_ATTR, id)
  badge.style.cssText =
    'padding:6px 16px;font:12px system-ui;color:#9a9;cursor:pointer;user-select:none'
  cell.appendChild(badge)
  return badge
}

/** The three probability bars — one per class, fill = probability. */
function renderBars(cell: HTMLElement, id: string, r: ScoreResult): void {
  const badge = renderBadge(cell, id)
  // Bars for this id are already rendered; rebuilding them every tick would
  // flicker and destroy the click-through detail panel.
  if (badge.querySelector(`[${BAR_ATTR}]`)) {
    ensureDetail(badge, r)
    return
  }
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
    fill.style.cssText = `display:block;height:100%;border-radius:3px;background:${CLASS_COLORS[cls]};width:${(p * 100).toFixed(1)}%`
    track.appendChild(fill)
    const value = document.createElement('span')
    value.textContent = p.toFixed(3)
    value.style.cssText = 'text-align:right;font-variant-numeric:tabular-nums;font-size:.9em'
    row.append(label, track, value)
    row.setAttribute(BAR_ATTR, '')
    badge.appendChild(row)
  }
  ensureDetail(badge, r)
}

function renderError(cell: HTMLElement, id: string, message: string): void {
  const badge = renderBadge(cell, id)
  badge.textContent = `aislop: score failed: ${message}`
}

/** Toggle the click-through detail panel showing exactly what the model said. */
function ensureDetail(badge: HTMLElement, r: ScoreResult): void {
  if (badge.getAttribute(DETAIL_LISTENER_ATTR)) return
  badge.setAttribute(DETAIL_LISTENER_ATTR, '')
  badge.addEventListener('click', (e) => {
    e.stopPropagation()
    e.preventDefault()
    const existing = badge.querySelector<HTMLElement>(`[${DETAIL_ATTR}]`)
    if (existing) {
      existing.remove()
      return
    }
    const detail = document.createElement('div')
    detail.setAttribute(DETAIL_ATTR, '')
    detail.style.cssText =
      'margin-top:.6em;padding:.6em;background:rgba(0,0,0,.55);border-radius:4px;font:11px system-ui;line-height:1.5;color:#bbb'
    detail.addEventListener('click', (ev) => {
      ev.stopPropagation()
      ev.preventDefault()
    })
    const dominant = r.dominant ?? 'tie'
    detail.innerHTML = [
      `<strong>probabilities</strong>: ${CLASS_IDS.map((c) => `${c} ${r.probabilities[c].toFixed(3)}`).join(', ')}`,
      `<strong>dominant</strong>: ${dominant}`,
      `<strong>model</strong>: ${escapeHtml(r.modelName)}`,
      `<strong>prompt</strong>: ${escapeHtml(r.promptVersion)} — <strong>taxonomy</strong>: ${escapeHtml(r.taxonomyVersion)}`,
    ].join('<br>')
    badge.appendChild(detail)
  })
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
