import { describe, expect, it } from 'vitest'
import { CLASS_IDS, dominantClass, extractProbabilities } from '../src/decision/probabilities'

const spikeAnswer = {
  type: 'choice',
  choice: 'ai_slop',
  probabilities: { ai_slop: 0.769, rubbish: 0.037, genuine: 0.194 },
  confidence: 0.769,
}

function answerWith(over: Record<string, unknown>) {
  return { type: 'choice', probabilities: over, choice: 'ai_slop', confidence: 1 }
}

describe('extractProbabilities', () => {
  it('returns the three class probabilities from a valid answer', () => {
    expect(extractProbabilities(spikeAnswer)).toEqual({
      ai_slop: 0.769,
      rubbish: 0.037,
      genuine: 0.194,
    })
  })

  it('accepts float drift in the sum within tolerance', () => {
    expect(
      extractProbabilities(answerWith({ ai_slop: 0.334, rubbish: 0.333, genuine: 0.333 })),
    ).toEqual({ ai_slop: 0.334, rubbish: 0.333, genuine: 0.333 })
  })

  it('accepts extreme saturated probabilities', () => {
    expect(extractProbabilities(answerWith({ ai_slop: 1, rubbish: 0, genuine: 0 }))).toEqual({
      ai_slop: 1,
      rubbish: 0,
      genuine: 0,
    })
    expect(
      extractProbabilities(answerWith({ ai_slop: 0.999999, rubbish: 1e-6, genuine: 1e-6 })),
    ).toEqual({ ai_slop: 0.999999, rubbish: 1e-6, genuine: 1e-6 })
  })

  it('fails loudly when the sum is off beyond tolerance', () => {
    expect(() =>
      extractProbabilities(answerWith({ ai_slop: 0.5, rubbish: 0.3, genuine: 0.1 })),
    ).toThrow(/malformed decision answer: probabilities sum/)
  })

  it('fails loudly when a class is missing', () => {
    expect(() => extractProbabilities(answerWith({ ai_slop: 1, rubbish: 0 }))).toThrow(
      /malformed decision answer: genuine/,
    )
  })

  it('fails loudly on an unknown class key (taxonomy drift)', () => {
    expect(() =>
      extractProbabilities(answerWith({ ai_slop: 0.5, rubbish: 0.25, genuine: 0.25, spam: 0.25 })),
    ).toThrow(/malformed decision answer: unknown class key "spam"/)
  })

  it('fails loudly on non-finite values', () => {
    const nan = answerWith({ ai_slop: NaN, rubbish: 0.5, genuine: 0.5 })
    expect(() => extractProbabilities(nan)).toThrow(/malformed decision answer: ai_slop/)
    const inf = answerWith({ ai_slop: Infinity, rubbish: 0, genuine: 0 })
    expect(() => extractProbabilities(inf)).toThrow(/malformed decision answer: ai_slop/)
  })

  it('fails loudly on out-of-range values', () => {
    const neg = answerWith({ ai_slop: -0.1, rubbish: 0.6, genuine: 0.5 })
    expect(() => extractProbabilities(neg)).toThrow(/malformed decision answer: ai_slop = -0.1/)
    const over = answerWith({ ai_slop: 1.1, rubbish: 0, genuine: 0 })
    expect(() => extractProbabilities(over)).toThrow(/malformed decision answer: ai_slop = 1.1/)
  })

  it('fails loudly on string values', () => {
    const bad = answerWith({ ai_slop: '0.7', rubbish: 0.2, genuine: 0.1 })
    expect(() => extractProbabilities(bad)).toThrow(/malformed decision answer: ai_slop/)
  })

  it('fails loudly when the answer is not an object', () => {
    expect(() => extractProbabilities(null)).toThrow(/malformed decision answer/)
    expect(() => extractProbabilities('ai_slop')).toThrow(/malformed decision answer/)
    expect(() => extractProbabilities(undefined)).toThrow(/malformed decision answer/)
  })

  it('fails loudly when the answer is not a choice answer', () => {
    const scoreAnswer = { type: 'score', score: 2, probabilities: {}, legend: {} }
    expect(() => extractProbabilities(scoreAnswer)).toThrow(/answer type "score"/)
  })

  it('fails loudly when the probabilities record is missing', () => {
    expect(() => extractProbabilities({ type: 'choice', choice: 'ai_slop' })).toThrow(
      /malformed decision answer: probabilities record missing/,
    )
  })

  it('covers exactly the three TAXONOMY v1 class tokens', () => {
    expect(CLASS_IDS).toEqual(['ai_slop', 'rubbish', 'genuine'])
  })
})

describe('dominantClass', () => {
  it('picks the class with the highest probability', () => {
    expect(dominantClass({ ai_slop: 0.769, rubbish: 0.037, genuine: 0.194 })).toBe('ai_slop')
    expect(dominantClass({ ai_slop: 0.042, rubbish: 0.895, genuine: 0.063 })).toBe('rubbish')
    expect(dominantClass({ ai_slop: 0.014, rubbish: 0.011, genuine: 0.975 })).toBe('genuine')
  })

  it('returns null when two classes tie for the max', () => {
    expect(dominantClass({ ai_slop: 0.5, rubbish: 0.5, genuine: 0 })).toBeNull()
    expect(dominantClass({ ai_slop: 0, rubbish: 0.25, genuine: 0.25 })).toBeNull()
  })

  it('treats near-identical probabilities as a tie', () => {
    expect(dominantClass({ ai_slop: 0.5, rubbish: 0.5 - 1e-12, genuine: 0 })).toBeNull()
  })

  it('returns the dominant class on saturated extremes', () => {
    expect(dominantClass({ ai_slop: 1, rubbish: 0, genuine: 0 })).toBe('ai_slop')
  })

  it('the spike tie-break post (0.469 vs 0.461) is not a tie', () => {
    expect(dominantClass({ ai_slop: 0.469, rubbish: 0.461, genuine: 0.07 })).toBe('ai_slop')
  })
})
