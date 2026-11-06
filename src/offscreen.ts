// Offscreen document: hosts the wllama decision model for the whole extension
// (the distil-labs pattern, per GLOSSARY.md). Loads the model on first contact
// and answers `status` / `score` messages. Nothing else lives here — scoring
// is pure in src/decision/.

import { ensureModel, modelStatus, scorePost } from './decision/classifier'
import { shouldStartModelLoad } from './offscreen-guard'

/** Broadcast model status to the background so it can update the toolbar badge. */
let lastBroadcastKey = ''
function broadcastStatus(): void {
  const status = modelStatus()
  const key = `${status.phase}|${status.progress ?? ''}|${status.detail ?? ''}`
  if (key === lastBroadcastKey) return
  lastBroadcastKey = key
  chrome.runtime.sendMessage({ type: 'model-status', status }).catch(() => {})
}

// Publish status changes while the model is still loading; stop once we reach a
// terminal state. This keeps the toolbar icon updating even if the content
// script is not actively polling.
const broadcastInterval = setInterval(() => {
  broadcastStatus()
  const phase = modelStatus().phase
  if (phase === 'ready' || phase === 'error') clearInterval(broadcastInterval)
}, 500)

chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  const { type, text } = (msg ?? {}) as { type?: unknown; text?: unknown }
  if (type === 'status') {
    // Only start a load when there is no terminal state yet; this keeps the
    // error badge persistent instead of retrying the failed download on every poll.
    if (shouldStartModelLoad(modelStatus().phase)) {
      void ensureModel().catch(() => {})
    }
    sendResponse(modelStatus())
    broadcastStatus()
    return false
  }
  if (type === 'score' && typeof text === 'string') {
    scorePost(text)
      .then((result) => sendResponse(result))
      .catch((err: unknown) => sendResponse({ error: String((err as Error)?.message ?? err) }))
    return true // async response
  }
  return false
})

// A fresh service worker (or a tab that only called `ensure-offscreen`) needs
// the current badge state immediately, not after the first interval tick.
broadcastStatus()
