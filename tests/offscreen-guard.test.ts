import { describe, expect, it } from 'vitest'
import { shouldStartModelLoad } from '../src/offscreen-guard'

describe('shouldStartModelLoad', () => {
  it('returns true for loading', () => {
    expect(shouldStartModelLoad('loading')).toBe(true)
  })

  it('returns false for ready', () => {
    expect(shouldStartModelLoad('ready')).toBe(false)
  })

  it('returns false for error', () => {
    expect(shouldStartModelLoad('error')).toBe(false)
  })
})
