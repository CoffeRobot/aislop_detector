// Decision-core: class tokens and probability extraction.
//
// The decision model answers with one `choice` question whose probabilities
// record holds every class token — full-logit softmax, nothing windowed
// (Path A of docs/spike-wllama.md). This module turns the raw answer into the
// typed per-class probabilities, failing loudly on anything malformed so a
// broken readout can never silently fabricate confidence (the top-k lesson
// from the spike).

/** The literal class tokens the model must choose among (TAXONOMY.md v1). */
export type ClassId = 'ai_slop' | 'rubbish' | 'genuine'

export const CLASS_IDS: readonly ClassId[] = ['ai_slop', 'rubbish', 'genuine'] as const

export type ClassProbabilities = Record<ClassId, number>

// The wasm-side softmax sums to 1 in float64; allow a little rounding slack.
const SUM_TOLERANCE = 1e-3

// Two classes closer than this count as a tie (float compare).
const TIE_TOLERANCE = 1e-9

function fail(why: string): never {
  throw new Error(`malformed decision answer: ${why}`)
}

/**
 * Extract per-class probabilities from a raw decision answer
 * (`SystemOneAnswer`): validates shape, class set, value range and sum, and
 * throws on anything else. Unknown class keys are rejected — they mean the
 * engine's answer set drifted from the taxonomy this build ships.
 */
export function extractProbabilities(rawAnswer: unknown): ClassProbabilities {
  if (typeof rawAnswer !== 'object' || rawAnswer === null) {
    fail('answer is not an object')
  }
  const answer = rawAnswer as Record<string, unknown>
  if (answer.type !== 'choice') {
    fail(`answer type ${JSON.stringify(answer.type)}, expected "choice"`)
  }
  const raw = answer.probabilities
  if (typeof raw !== 'object' || raw === null) {
    fail('probabilities record missing')
  }
  const probabilities = raw as Record<string, unknown>
  for (const key of Object.keys(probabilities)) {
    if (!CLASS_IDS.includes(key as ClassId)) fail(`unknown class key ${JSON.stringify(key)}`)
  }
  const out = {} as ClassProbabilities
  let sum = 0
  for (const id of CLASS_IDS) {
    const value = probabilities[id]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      fail(`${id} is ${JSON.stringify(value)}, not a finite number`)
    }
    if (value < 0 || value > 1) {
      fail(`${id} = ${value}, outside [0, 1]`)
    }
    out[id] = value
    sum += value
  }
  if (Math.abs(sum - 1) > SUM_TOLERANCE) {
    fail(`probabilities sum to ${sum}, expected 1`)
  }
  return out
}

/**
 * The class with the highest probability, or null when two or more classes tie
 * for the max. Display highlights use it; a tie never collapses to a pick.
 */
export function dominantClass(p: ClassProbabilities): ClassId | null {
  let top: ClassId[] = []
  let max = -Infinity
  for (const id of CLASS_IDS) {
    if (p[id] > max + TIE_TOLERANCE) {
      max = p[id]
      top = [id]
    } else if (Math.abs(p[id] - max) <= TIE_TOLERANCE) {
      top.push(id)
    }
  }
  return top.length === 1 ? top[0] : null
}
