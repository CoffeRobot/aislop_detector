// Background service worker. One job: create the offscreen document (the
// wllama host) when a content script asks — content scripts cannot call
// chrome.offscreen themselves. The harness page creates the same document
// directly via src/ensure-offscreen.ts.

import { ensureOffscreen } from './ensure-offscreen'

chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  if ((msg as { type?: unknown } | null)?.type !== 'ensure-offscreen') return false
  ensureOffscreen()
    .then(() => sendResponse(true))
    .catch((err: unknown) => sendResponse({ error: String((err as Error)?.message ?? err) }))
  return true // async response
})
