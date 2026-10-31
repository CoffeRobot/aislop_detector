// Decision-core: the TAXONOMY-driven decision prompt.
//
// Single versioned place for the class definitions the model sees. The
// criteria text mirrors TAXONOMY.md v1 exactly as the issue-2 spike ran it
// (spike/spike_common.py) — the spike's validated per-class probabilities came
// from this wording. When definitions change: update TAXONOMY.md, copy the new
// wording here, bump TAXONOMY_VERSION and PROMPT_VERSION, add the new class to
// probabilities.ts, and add a bar color.

import type { ClassId } from './probabilities'

export const TAXONOMY_VERSION = 'v1'
export const PROMPT_VERSION = 'v1'

/** Question id in the decision request; the answer comes back under this key. */
export const QUESTION_ID = 'class'

const CRITERIA: Record<ClassId, string> = {
  ai_slop:
    'Machine-generated filler: LLM cadence tells, generic advice, listicle padding, no personal anchor.',
  rubbish:
    'Low value regardless of author: engagement bait, hype and shilling, overclaiming, threadbait hooks.',
  genuine:
    'Real substance: firsthand experience, specific verifiable claims, original insight, honest signal.',
}

const INSTRUCTIONS =
  'Classify the social media post by substance. The substance axis decides: if a post is both machine-generated filler and engagement bait, it is rubbish.'

/** The SystemOne request shape (wllama createSystemOne / llama.cpp /v1/systemone). */
export interface DecisionRequest {
  state: string
  questions: {
    [QUESTION_ID]: {
      type: 'choice'
      instructions: string
      criteria: Record<ClassId, string>
    }
  }
}

/**
 * Build the decision request for one post: a single typed choice question
 * over the TAXONOMY v1 class definitions. The next-token choice is constrained
 * to the class tokens — no free-form generation anywhere.
 */
export function buildDecisionRequest(postText: string): DecisionRequest {
  return {
    state: postText,
    questions: {
      [QUESTION_ID]: {
        type: 'choice',
        instructions: INSTRUCTIONS,
        criteria: CRITERIA,
      },
    },
  }
}
