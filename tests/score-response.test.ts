import { describe, expect, it } from 'vitest'
import { classifyScoreResponse } from '../src/score-response'

describe('classifyScoreResponse', () => {
  it('treats a probabilities result as success', () => {
    const result = {
      probabilities: { ai_slop: 0.1, rubbish: 0.2, genuine: 0.7 },
      dominant: 'genuine',
      modelName: 'm',
      inputTokens: 10,
      ms: 20,
      promptVersion: 'p',
      taxonomyVersion: 't',
    }
    expect(classifyScoreResponse(result)).toEqual({ kind: 'success', result })
  })

  it('treats an explicit error as terminal', () => {
    const c = classifyScoreResponse({ error: 'bad prompt' })
    expect(c.kind).toBe('terminal')
    expect('error' in c && c.error).toBeInstanceOf(Error)
    expect('error' in c && c.error.message).toBe('bad prompt')
  })

  it('treats undefined as retryable', () => {
    expect(classifyScoreResponse(undefined)).toEqual({ kind: 'retry' })
  })

  it('treats an unrecognised object as retryable', () => {
    expect(classifyScoreResponse({ foo: 'bar' })).toEqual({ kind: 'retry' })
  })
})
