// Pure bounded-concurrency scoring queue.
//
// Keeps one classifier call in flight per post id, caches results, and caps
// both parallel work and queued backlog. Backpressure: once the backlog fills,
// the oldest unstarted job is dropped (it was likely scrolled past). No DOM
// here — the scraper adapter feeds observed posts in and renders callbacks out.

export interface ScoreJob {
  id: string
  text: string
}

export interface ScoringQueueConfig<R> {
  classify: (text: string) => Promise<R>
  /** Maximum concurrent classifier calls. */
  concurrency: number
  /** Maximum queued (not yet running) jobs; oldest dropped on overflow. */
  maxBacklog?: number
  /** Maximum cached results; oldest evicted on overflow. */
  maxCacheSize?: number
  onResult?: (id: string, result: R) => void
  onError?: (id: string, error: unknown) => void
}

export interface ScoringQueue<R> {
  /** Queue a post if it is not already cached, running, or queued. */
  submit(id: string, text: string): void
  /** Cached result for an id, if any. */
  result(id: string): R | undefined
  /** Whether the id is cached, running, or queued. */
  has(id: string): boolean
  /** Queued (not yet running) jobs. */
  queued(): number
  /** Currently running classifier calls. */
  inFlight(): number
  /** Stop accepting jobs and clear the backlog. In-flight calls complete. */
  stop(): void
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`)
  }
}

function requirePositiveIntegerOrInfinity(name: string, value: number | undefined): number {
  if (value === undefined || value === Infinity) return Infinity
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer or Infinity`)
  }
  return value
}

class QueueImpl<R> implements ScoringQueue<R> {
  private classify: (text: string) => Promise<R>
  private concurrency: number
  private maxBacklog: number
  private maxCacheSize: number
  private onResult?: (id: string, result: R) => void
  private onError?: (id: string, error: unknown) => void

  private cache = new Map<string, R>()
  private pending = new Set<string>()
  private backlog: ScoreJob[] = []
  private running = 0
  private stopped = false

  constructor(config: ScoringQueueConfig<R>) {
    assertPositiveInteger('concurrency', config.concurrency)
    this.classify = config.classify
    this.concurrency = config.concurrency
    this.maxBacklog = requirePositiveIntegerOrInfinity('maxBacklog', config.maxBacklog)
    this.maxCacheSize = requirePositiveIntegerOrInfinity('maxCacheSize', config.maxCacheSize)
    this.onResult = config.onResult
    this.onError = config.onError
  }

  submit(id: string, text: string): void {
    if (this.stopped) return
    if (this.touchCache(id) || this.pending.has(id) || this.backlog.some((j) => j.id === id)) return
    if (this.backlog.length >= this.maxBacklog) {
      // Drop the oldest unstarted job: it is farthest from the viewport and
      // least likely to be looked at. This prevents unbounded growth when
      // scrolling is faster than the model.
      this.backlog.shift()
    }
    this.backlog.push({ id, text })
    this.pump()
  }

  private pump(): void {
    while (this.running < this.concurrency && this.backlog.length > 0 && !this.stopped) {
      const job = this.backlog.shift()
      if (!job) break
      this.pending.add(job.id)
      this.running++
      this.classify(job.text)
        .then((result) => {
          this.cache.set(job.id, result)
          this.trimCache()
          this.onResult?.(job.id, result)
        })
        .catch((err) => {
          this.onError?.(job.id, err)
        })
        .finally(() => {
          this.pending.delete(job.id)
          this.running--
          this.pump()
        })
    }
  }

  result(id: string): R | undefined {
    this.touchCache(id)
    return this.cache.get(id)
  }

  has(id: string): boolean {
    return this.touchCache(id) || this.pending.has(id) || this.backlog.some((j) => j.id === id)
  }

  /** Refresh insertion order so recently seen ids survive cache eviction. */
  private touchCache(id: string): boolean {
    if (!this.cache.has(id)) return false
    const r = this.cache.get(id)!
    this.cache.delete(id)
    this.cache.set(id, r)
    return true
  }

  private trimCache(): void {
    if (this.maxCacheSize === Infinity || this.cache.size <= this.maxCacheSize) return
    const first = this.cache.keys().next().value
    if (first !== undefined) this.cache.delete(first)
  }

  queued(): number {
    return this.backlog.length
  }

  inFlight(): number {
    return this.running
  }

  stop(): void {
    this.stopped = true
    this.backlog = []
  }
}

export function createScoringQueue<R>(config: ScoringQueueConfig<R>): ScoringQueue<R> {
  return new QueueImpl(config)
}
