// Background service worker. Two jobs:
// 1. Create the offscreen document (the wllama host) when a content script asks —
//    content scripts cannot call chrome.offscreen themselves. The harness page
//    creates the same document directly via src/ensure-offscreen.ts.
// 2. Drive chrome.action from here: offscreen documents have restricted API access,
//    so the offscreen page publishes model status updates as messages and this
//    worker updates the toolbar badge.

import { badgeFor } from './action-badge'
import type { ModelStatus } from './decision/classifier'
import { ensureOffscreen } from './ensure-offscreen'

function applyBadge(spec: ReturnType<typeof badgeFor>): void {
  const text = spec?.text ?? ''
  const color = spec?.color ?? ([0, 0, 0, 0] as [number, number, number, number])
  chrome.action.setBadgeText({ text }).catch(() => {})
  chrome.action.setBadgeBackgroundColor({ color }).catch(() => {})
}

chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  const type = (msg as { type?: unknown } | null)?.type

  if (type === 'ensure-offscreen') {
    ensureOffscreen()
      .then(() => sendResponse(true))
      .catch((err: unknown) => sendResponse({ error: String((err as Error)?.message ?? err) }))
    return true // async response
  }

  if (type === 'model-status') {
    const status = (msg as { status?: unknown }).status as ModelStatus | undefined
    if (status) applyBadge(badgeFor(status))
    return false
  }

  return false
})
