import { describe, expect, it } from 'vitest'
import { badgeFor } from '../src/action-badge'
import type { ModelStatus } from '../src/decision/classifier'

function status(phase: ModelStatus['phase'], progress?: number, detail?: string): ModelStatus {
  return { phase, progress, detail }
}

describe('badgeFor', () => {
  it('shows an ellipsis while loading with no progress yet', () => {
    expect(badgeFor(status('loading'))).toEqual({ text: '...', color: '#f5a623' })
  })

  it('shows the download percentage as a badge while loading', () => {
    expect(badgeFor(status('loading', 0))).toEqual({ text: '...', color: '#f5a623' })
    expect(badgeFor(status('loading', 0.37))).toEqual({ text: '37%', color: '#f5a623' })
    expect(badgeFor(status('loading', 0.995))).toEqual({ text: '100%', color: '#f5a623' })
    expect(badgeFor(status('loading', 1))).toEqual({ text: '100%', color: '#f5a623' })
  })

  it('clears the badge once the model is ready', () => {
    expect(badgeFor(status('ready'))).toBeNull()
    expect(badgeFor(status('ready', 1, 'd1-3B Q4_K_M'))).toBeNull()
  })

  it('shows an error badge when the model fails', () => {
    expect(badgeFor(status('error'))).toEqual({ text: 'ERR', color: '#e5484d' })
    expect(badgeFor(status('error', undefined, 'network failed'))).toEqual({
      text: 'ERR',
      color: '#e5484d',
    })
  })
})
