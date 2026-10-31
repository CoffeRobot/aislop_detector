// Paste-a-post harness: the owner pastes a post's text and gets the three
// per-class probabilities from the decision model, end to end. The model runs
// in the offscreen document; this page only sends messages and renders.

import type { ModelStatus, ScoreResult } from './decision/classifier'
import type { ClassId } from './decision/probabilities'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const post = $('post') as HTMLTextAreaElement
const scoreBtn = $('score') as HTMLButtonElement
const statusEl = $('status')
const resultEl = $('result')
const metaEl = $('meta')

async function ensureOffscreen(): Promise<void> {
  try {
    await chrome.offscreen.createDocument({
      url: 'src/offscreen.html',
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: 'Hosts the local decision model (wllama) that scores posts.',
    })
  } catch (err) {
    // "Only a single offscreen document…" — someone else created it first.
    const msg = String((err as Error)?.message ?? err)
    if (!/single offscreen/i.test(msg)) throw err
  }
}

async function pollStatus(): Promise<void> {
  const s = (await chrome.runtime.sendMessage({ type: 'status' })) as ModelStatus
  renderStatus(s)
  if (s.phase === 'ready') {
    scoreBtn.disabled = false
  } else if (s.phase === 'loading') {
    setTimeout(pollStatus, 500)
  } else {
    scoreBtn.disabled = true
  }
}

function renderStatus(s: ModelStatus): void {
  statusEl.classList.remove('error')
  if (s.phase === 'loading') {
    const pct = s.progress !== undefined ? Math.round(s.progress * 100) : null
    statusEl.textContent =
      pct !== null
        ? `preparing model (${pct}%) — first run downloads the GGUF from HuggingFace once`
        : 'preparing model…'
  } else if (s.phase === 'ready') {
    const b = s.backend
    statusEl.textContent =
      `model ready: ${s.detail}` +
      (b
        ? ` — ${b.threads} wasm threads${b.webgpuAvailable ? ', WebGPU adapter present' : ''}, cross-origin isolated: ${b.crossOriginIsolated}`
        : '')
  } else {
    statusEl.classList.add('error')
    statusEl.textContent = `model error: ${s.detail} — reload this page to retry`
  }
}

async function score(): Promise<void> {
  const text = post.value.trim()
  if (!text || scoreBtn.disabled) return
  scoreBtn.disabled = true
  statusEl.classList.remove('error')
  statusEl.textContent = 'scoring…'
  try {
    const result = (await chrome.runtime.sendMessage({ type: 'score', text })) as
      | ScoreResult
      | { error: string }
    if (result && 'error' in result) {
      statusEl.classList.add('error')
      statusEl.textContent = `score failed: ${result.error}`
      return
    }
    renderResult(result)
    statusEl.textContent = ''
  } catch (err) {
    statusEl.classList.add('error')
    statusEl.textContent = `score failed: ${String((err as Error)?.message ?? err)}`
  } finally {
    scoreBtn.disabled = false
  }
}

function renderResult(r: ScoreResult): void {
  resultEl.classList.remove('hidden')
  const rows = resultEl.querySelectorAll<HTMLElement>('.bar-row')
  rows.forEach((row) => {
    const id = row.dataset.class as ClassId
    const fill = row.querySelector<HTMLElement>('.fill')
    const value = row.querySelector<HTMLElement>('.value')
    if (!fill || !value) return
    const p = r.probabilities[id]
    fill.style.width = `${(p * 100).toFixed(1)}%`
    value.textContent = p.toFixed(3)
    row.style.opacity = r.dominant === id ? '1' : '0.55'
  })
  const tie = r.dominant === null ? ' (tie for top)' : ''
  metaEl.textContent =
    `model: ${r.modelName} — prompt ${r.promptVersion} / taxonomy ${r.taxonomyVersion} — ` +
    `${r.inputTokens} input tokens, ${r.ms.toFixed(0)} ms${tie}`
}

scoreBtn.addEventListener('click', score)

ensureOffscreen()
  .then(pollStatus)
  .catch((err) => {
    statusEl.classList.add('error')
    statusEl.textContent = `offscreen document failed: ${String((err as Error)?.message ?? err)}`
  })
