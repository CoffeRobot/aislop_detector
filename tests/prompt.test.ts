import { describe, expect, it } from 'vitest'
import {
  buildDecisionRequest,
  PROMPT_VERSION,
  QUESTION_ID,
  TAXONOMY_VERSION,
} from '../src/decision/prompt'
import { CLASS_IDS } from '../src/decision/probabilities'

describe('buildDecisionRequest', () => {
  it('builds one typed choice question over the post text', () => {
    const req = buildDecisionRequest('hello world')
    expect(req.state).toBe('hello world')
    expect(Object.keys(req.questions)).toEqual([QUESTION_ID])
    const q = req.questions[QUESTION_ID]
    expect(q.type).toBe('choice')
  })

  it('uses exactly the TAXONOMY v1 class tokens as criteria keys', () => {
    const q = buildDecisionRequest('x').questions[QUESTION_ID]
    expect(Object.keys(q.criteria).sort()).toEqual([...CLASS_IDS].sort())
  })

  it('passes the post text through unmodified as the state', () => {
    const text = 'post with "quotes" and\nnewlines — emoji 🚀'
    expect(buildDecisionRequest(text).state).toBe(text)
  })

  // Guards the exact wording the issue-2 spike validated (spike/spike_common.py).
  // Any change here must bump PROMPT_VERSION.
  it('keeps the validated spike wording', () => {
    const q = buildDecisionRequest('x').questions[QUESTION_ID]
    expect(q.instructions).toBe(
      'Classify the social media post by substance. The substance axis decides: if a post is both machine-generated filler and engagement bait, it is rubbish.'
    )
    expect(q.criteria.ai_slop).toBe(
      'Machine-generated filler: LLM cadence tells, generic advice, listicle padding, no personal anchor.'
    )
    expect(q.criteria.rubbish).toBe(
      'Low value regardless of author: engagement bait, hype and shilling, overclaiming, threadbait hooks.'
    )
    expect(q.criteria.genuine).toBe(
      'Real substance: firsthand experience, specific verifiable claims, original insight, honest signal.'
    )
  })

  it('surfaces the prompt and taxonomy versions', () => {
    expect(PROMPT_VERSION).toBe('v1')
    expect(TAXONOMY_VERSION).toBe('v1')
  })
})