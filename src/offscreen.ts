// Offscreen document: hosts the wllama decision model for the whole extension
// (the distil-labs pattern, per GLOSSARY.md). Loads the model on first contact
// and answers `status` / `score` messages. Nothing else lives here — scoring
// is pure in src/decision/.

import { ensureModel, modelStatus, scorePost } from './decision/classifier'

chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  const { type, text } = (msg ?? {}) as { type?: unknown; text?: unknown }
  if (type === 'status') {
    // First poll kicks the model load off; later polls just report it.
    void ensureModel().catch(() => {})
    sendResponse(modelStatus())
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
