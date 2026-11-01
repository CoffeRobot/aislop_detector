import { describe, expect, it } from 'vitest'
import {
  judgedText,
  normalizeStatusId,
  scoreable,
  skipReason,
  type PostCandidate,
} from '../src/scraper/skip'

function candidate(overrides: Partial<PostCandidate> = {}): PostCandidate {
  // Long enough and id'd, so a test exercises exactly the rule it names.
  return {
    id: '/user/status/123',
    mainText: 'One two three four five six seven eight nine.',
    quotedText: '',
    isPromoted: false,
    isWidget: false,
    ...overrides,
  }
}

describe('skipReason', () => {
  it('null for a plain scoreable post', () => {
    expect(skipReason(candidate())).toBeNull()
  })

  it('promoted posts never score, even with full text and an id', () => {
    expect(skipReason(candidate({ isPromoted: true }))).toBe('promoted')
  })

  it('promoted wins over widget', () => {
    expect(skipReason(candidate({ isPromoted: true, isWidget: true }))).toBe('promoted')
  })

  it('Who-to-follow widget cells never score', () => {
    expect(skipReason(candidate({ id: null, mainText: '', isWidget: true }))).toBe('widget')
  })

  it('image/video-only posts (no text anywhere) are non_text', () => {
    expect(skipReason(candidate({ id: null, mainText: '', quotedText: '' }))).toBe('non_text')
  })

  it('a textless post whose quote has text is judged on the quoted text', () => {
    expect(
      skipReason(
        candidate({ mainText: '', quotedText: 'Quoted post with plenty of words to judge here.' }),
      ),
    ).toBeNull()
  })

  it('under ~5 words skips, quoted words count (they are folded in)', () => {
    expect(skipReason(candidate({ mainText: 'RT this now!' }))).toBe('too_short')
    expect(skipReason(candidate({ mainText: 'RT this now!', quotedText: '' }))).toBe('too_short')
    expect(
      skipReason(
        candidate({ mainText: 'RT this now!', quotedText: 'and the quote adds enough words' }),
      ),
    ).toBeNull()
  })

  it('a post with no stable id skips as no_id (last rule)', () => {
    expect(skipReason(candidate({ id: null }))).toBe('no_id')
  })

  it('non_text wins over too_short/short noise and no_id order holds', () => {
    expect(skipReason(candidate({ id: null, mainText: 'hi' }))).toBe('too_short')
  })
})

describe('scoreable', () => {
  it('narrows to an id-bearing candidate only when every rule passes', () => {
    expect(scoreable(candidate())).toBe(true)
    expect(scoreable(candidate({ id: null }))).toBe(false)
    expect(scoreable(candidate({ isPromoted: true }))).toBe(false)
  })
})

describe('judgedText', () => {
  it('joins main and quoted text with a blank line, dropping empty parts', () => {
    expect(judgedText(candidate({ mainText: 'main', quotedText: 'quoted' }))).toBe('main\n\nquoted')
    expect(judgedText(candidate({ mainText: '', quotedText: 'quoted' }))).toBe('quoted')
    expect(judgedText(candidate({ mainText: '   ', quotedText: '' }))).toBe('')
  })
})

describe('normalizeStatusId', () => {
  it('keeps the /user/status/nnn path and drops query params', () => {
    expect(normalizeStatusId('/user/status/123?s=20')).toBe('/user/status/123')
    expect(normalizeStatusId('https://x.com/user/status/1234567890')).toBe(
      '/user/status/1234567890',
    )
  })

  it('rejects non-permalinks', () => {
    expect(normalizeStatusId('/i/status/123')).toBeNull()
    expect(normalizeStatusId('/user/status/')).toBeNull()
    expect(normalizeStatusId('/user/followers')).toBeNull()
    expect(normalizeStatusId('javascript:alert(1)')).toBeNull()
    expect(normalizeStatusId('http://:bad')).toBeNull()
  })
})
