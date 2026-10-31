import { describe, expect, it } from 'vitest'

describe('toolchain smoke', () => {
  it('runs vitest with TypeScript', () => {
    expect([1, 2, 3].reduce((a, b) => a + b, 0)).toBe(6)
  })
})
