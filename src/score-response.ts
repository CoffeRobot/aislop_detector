import type { ScoreResult } from './decision/classifier'

export type ScoreResponse =
  { kind: 'success'; result: ScoreResult } | { kind: 'terminal'; error: Error } | { kind: 'retry' }

/** Classify the raw response from an offscreen `score` message.
 *  - A result with probabilities is a success.
 *  - An explicit `{error: ...}` is terminal: do not retry.
 *  - Anything else (usually `undefined` when the listener is not yet registered)
 *    is retryable. */
export function classifyScoreResponse(r: unknown): ScoreResponse {
  if (r && typeof r === 'object' && 'probabilities' in r) {
    return { kind: 'success', result: r as ScoreResult }
  }
  if (r && typeof r === 'object' && 'error' in r) {
    return { kind: 'terminal', error: new Error(String((r as { error: unknown }).error)) }
  }
  return { kind: 'retry' }
}
