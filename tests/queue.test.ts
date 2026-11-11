import { describe, expect, it } from 'vitest'
import {
  createScoringQueue,
  type ScoringQueue,
  type ScoringQueueConfig,
} from '../src/queue/scoringQueue'

interface FakeResult {
  id: string
  text: string
}

/** A classifier whose in-flight calls stay unresolved until tests release them. */
function deferredClassifier() {
  const pending = new Map<
    string,
    { resolve: (r: FakeResult) => void; reject: (e: unknown) => void; text: string }
  >()
  let callCount = 0
  const classify = (text: string): Promise<FakeResult> => {
    callCount++
    return new Promise((resolve, reject) => {
      pending.set(String(callCount), { resolve, reject, text })
    })
  }
  function release(nth: number, result: FakeResult): void {
    const p = pending.get(String(nth))
    if (!p) throw new Error(`no pending call #${nth}`)
    pending.delete(String(nth))
    p.resolve(result)
  }
  function reject(nth: number, error: unknown): void {
    const p = pending.get(String(nth))
    if (!p) throw new Error(`no pending call #${nth}`)
    pending.delete(String(nth))
    p.reject(error)
  }
  return { classify, release, reject, callCount: () => callCount, pending }
}

function makeQueue(
  config: Partial<ScoringQueueConfig<FakeResult>> &
    Pick<ScoringQueueConfig<FakeResult>, 'classify'>,
): ScoringQueue<FakeResult> {
  return createScoringQueue({ concurrency: 2, ...config })
}

describe('createScoringQueue', () => {
  it('caches and returns the result for an id', async () => {
    const q = makeQueue({
      classify: async (text) => ({ id: text, text }),
    })
    q.submit('a', 'hello')
    // flush microtasks
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(q.result('a')).toEqual({ id: 'hello', text: 'hello' })
    expect(q.has('a')).toBe(true)
  })

  it('scores each id at most once per session', async () => {
    let calls = 0
    const q = makeQueue({
      classify: async (text) => {
        calls++
        return { id: text, text }
      },
    })
    q.submit('a', 'one')
    q.submit('a', 'two')
    q.submit('a', 'three')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls).toBe(1)
    expect(q.result('a')?.text).toBe('one')
  })

  it('deduplicates ids that are still waiting in the backlog', async () => {
    const { classify, release, callCount } = deferredClassifier()
    const q = makeQueue({ classify, concurrency: 1, maxBacklog: 2 })
    q.submit('a', '1') // running
    q.submit('b', '2') // queued
    q.submit('b', '2') // duplicate while still queued — must not enqueue again
    expect(q.inFlight()).toBe(1)
    expect(q.queued()).toBe(1)
    expect(callCount()).toBe(1)
    expect(q.has('b')).toBe(true)
    release(1, { id: 'a', text: '1' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(q.inFlight()).toBe(1)
    expect(q.queued()).toBe(0)
    expect(callCount()).toBe(2)
    release(2, { id: 'b', text: '2' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(q.inFlight()).toBe(0)
    expect(q.result('b')).toEqual({ id: 'b', text: '2' })
  })

  it('does not error on duplicate/late arrivals', async () => {
    const q = makeQueue({
      classify: async (text) => ({ id: text, text }),
    })
    q.submit('a', 'x')
    q.submit('a', 'x')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(q.has('a')).toBe(true)
    expect(() => q.submit('a', 'x')).not.toThrow()
  })

  it('never exceeds the concurrency bound under burst input', async () => {
    const { classify, release, callCount } = deferredClassifier()
    const q = makeQueue({ classify, concurrency: 2 })
    q.submit('a', '1')
    q.submit('b', '2')
    q.submit('c', '3')
    q.submit('d', '4')
    expect(q.inFlight()).toBe(2)
    expect(q.queued()).toBe(2)
    expect(callCount()).toBe(2)
    release(1, { id: 'a', text: '1' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(q.inFlight()).toBe(2)
    expect(q.queued()).toBe(1)
    expect(callCount()).toBe(3)
    release(2, { id: 'b', text: '2' })
    release(3, { id: 'c', text: '3' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(q.inFlight()).toBe(1)
    expect(q.queued()).toBe(0)
    release(4, { id: 'd', text: '4' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(q.inFlight()).toBe(0)
    expect(q.queued()).toBe(0)
  })

  it('fires onResult with the correct id and result', async () => {
    const results: Array<{ id: string; result: FakeResult }> = []
    const q = makeQueue({
      classify: async (text) => ({ id: text, text }),
      onResult: (id, result) => results.push({ id, result }),
    })
    q.submit('a', 'alpha')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(results).toEqual([{ id: 'a', result: { id: 'alpha', text: 'alpha' } }])
  })

  it('fires onError when classification fails', async () => {
    const errors: Array<{ id: string; error: unknown }> = []
    const q = makeQueue({
      classify: async () => {
        throw new Error('boom')
      },
      onError: (id, error) => errors.push({ id, error: String(error) }),
    })
    q.submit('a', 'x')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(errors).toEqual([{ id: 'a', error: 'Error: boom' }])
    expect(q.has('a')).toBe(false)
  })

  it('drops oldest queued job when backlog overflows', async () => {
    const { classify, release } = deferredClassifier()
    const q = makeQueue({ classify, concurrency: 1, maxBacklog: 2 })
    q.submit('a', '1') // running
    q.submit('b', '2') // queued
    q.submit('c', '3') // queued
    q.submit('d', '4') // drops 'b'
    expect(q.inFlight()).toBe(1)
    expect(q.queued()).toBe(2)
    release(1, { id: 'a', text: '1' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    // next should be c (oldest remaining), not b
    expect(q.inFlight()).toBe(1)
    release(2, { id: 'c', text: '3' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(q.inFlight()).toBe(1)
    release(3, { id: 'd', text: '4' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(q.inFlight()).toBe(0)
    expect(q.result('b')).toBeUndefined()
    expect(q.result('c')).toEqual({ id: 'c', text: '3' })
    expect(q.result('d')).toEqual({ id: 'd', text: '4' })
  })

  it('stop clears the backlog and prevents new submissions', async () => {
    let calls = 0
    const q = makeQueue({
      classify: async (text) => {
        calls++
        return { id: text, text }
      },
    })
    q.submit('a', 'x')
    q.stop()
    q.submit('b', 'y')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls).toBe(1)
    expect(q.has('a')).toBe(true)
    expect(q.has('b')).toBe(false)
  })

  it('rejects invalid concurrency', () => {
    expect(() => createScoringQueue({ classify: async () => 1, concurrency: 0 })).toThrow(
      /concurrency must be a positive integer/,
    )
    expect(() => createScoringQueue({ classify: async () => 1, concurrency: -1 })).toThrow(
      /concurrency must be a positive integer/,
    )
    expect(() => createScoringQueue({ classify: async () => 1, concurrency: 0.5 })).toThrow(
      /concurrency must be a positive integer/,
    )
  })

  it('keeps recently accessed results in the cache (LRU)', async () => {
    let calls = 0
    const q = makeQueue({
      concurrency: 4,
      maxCacheSize: 4,
      classify: async (text) => {
        calls++
        return { id: text, text }
      },
    })
    q.submit('a', '1')
    q.submit('b', '2')
    q.submit('c', '3')
    q.submit('d', '4')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls).toBe(4)
    // Touch 'a' via both result() and has() so it becomes most-recently used.
    expect(q.result('a')).toEqual({ id: '1', text: '1' })
    expect(q.has('a')).toBe(true)
    // Pushing 3 newer items should evict the LRU ('b'), not the touched 'a'.
    q.submit('e', '5')
    q.submit('f', '6')
    q.submit('g', '7')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls).toBe(7)
    expect(q.result('a')).toBeDefined()
    expect(q.result('b')).toBeUndefined()
    // Resubmitting the evicted id should score again.
    q.submit('b', '2')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls).toBe(8)
  })

  it('rejects invalid maxCacheSize', () => {
    expect(() =>
      createScoringQueue({ classify: async () => 1, concurrency: 1, maxCacheSize: -1 }),
    ).toThrow(/maxCacheSize must be a positive integer or Infinity/)
    expect(() =>
      createScoringQueue({ classify: async () => 1, concurrency: 1, maxCacheSize: 0 }),
    ).toThrow(/maxCacheSize must be a positive integer or Infinity/)
  })

  it('rejects invalid maxBacklog', () => {
    expect(() =>
      createScoringQueue({ classify: async () => 1, concurrency: 1, maxBacklog: 0 }),
    ).toThrow(/maxBacklog must be a positive integer or Infinity/)
    expect(() =>
      createScoringQueue({ classify: async () => 1, concurrency: 1, maxBacklog: -1 }),
    ).toThrow(/maxBacklog must be a positive integer or Infinity/)
  })

  it('accepts Infinity for maxBacklog and maxCacheSize', () => {
    expect(() =>
      createScoringQueue({
        classify: async () => 1,
        concurrency: 1,
        maxBacklog: Infinity,
        maxCacheSize: Infinity,
      }),
    ).not.toThrow()
  })
})
