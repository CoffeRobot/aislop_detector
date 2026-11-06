// Pure mapping from model status to the chrome.action toolbar badge.
// Keeps extension-icon logic small enough to unit-test.

import type { ModelStatus } from './decision/classifier'

export interface BadgeSpec {
  text: string
  color: string
}

/** What the toolbar badge should show for a given model status. */
export function badgeFor(status: ModelStatus): BadgeSpec | null {
  if (status.phase === 'loading') {
    const pct =
      status.progress !== undefined && status.progress > 0
        ? Math.round(status.progress * 100)
        : null
    return {
      text: pct === null ? '...' : `${pct}%`,
      color: '#f5a623',
    }
  }
  if (status.phase === 'error') {
    return { text: 'ERR', color: '#e5484d' }
  }
  // ready: clear the badge back to the default state.
  return null
}
