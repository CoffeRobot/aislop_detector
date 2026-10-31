// Classifier adapter: wllama over the d1 decision model, inside the offscreen
// document. Path A of docs/spike-wllama.md — per-option probabilities from
// full logits via the SystemOne (TypeSafe) API; zero generated tokens.
//
// The GGUF is fetched from HuggingFace once and cached by wllama's cache
// manager (OPFS), which is the only network egress the extension ever makes.

import { Wllama } from '@wllama/wllama'
import { buildDecisionRequest, PROMPT_VERSION, QUESTION_ID, TAXONOMY_VERSION } from './prompt'
import { dominantClass, extractProbabilities } from './probabilities'
import type { ClassId, ClassProbabilities } from './probabilities'

/** Model profile — the spike's validated default (docs/spike-wllama.md). */
export const MODEL_PROFILE = {
  repo: 'LiquidAI/d1-3B-GGUF',
  quant: 'Q4_K_M',
} as const

// The decision prompt is ~200 tokens (spike: 190–220); the demo's batch sizes.
const LOAD_PARAMS = {
  n_ctx: 2048,
  n_batch: 1024,
  n_ubatch: 1024,
} as const

export interface ModelStatus {
  phase: 'loading' | 'ready' | 'error'
  /** Download progress 0..1 while loading (jumps to 1 when the GGUF is cached). */
  progress?: number
  detail?: string
  profile?: { repo: string; quant: string }
  backend?: { webgpuAvailable: boolean; threads: number; crossOriginIsolated: boolean }
}

export interface ScoreResult {
  probabilities: ClassProbabilities
  dominant: ClassId | null
  /** Model reference from the GGUF itself (response.model). */
  modelName: string
  inputTokens: number
  ms: number
  promptVersion: string
  taxonomyVersion: string
}

let wllama: Wllama | null = null
let status: ModelStatus = { phase: 'loading' }
let loadPromise: Promise<void> | null = null

// Where the vendored wasm binary lives inside the built extension.
const CONFIG_PATHS = { default: chrome.runtime.getURL('wllama.wasm') }

export function modelStatus(): ModelStatus {
  return status
}

/** Load the model once; concurrent callers share one load. Idempotent after. */
export function ensureModel(): Promise<void> {
  if (wllama) return Promise.resolve()
  if (!loadPromise) {
    loadPromise = (async () => {
      status = { phase: 'loading', progress: 0 }
      const w = new Wllama(CONFIG_PATHS)
      await w.loadModelFromHF(MODEL_PROFILE, {
        ...LOAD_PARAMS,
        progressCallback: ({ loaded, total }) => {
          status = {
            phase: 'loading',
            progress: total > 0 ? loaded / total : 0,
          }
        },
      })
      wllama = w
      const meta = w.getLoadedContextInfo().metadata
      status = {
        phase: 'ready',
        profile: { ...MODEL_PROFILE },
        backend: {
          // Capability, not usage: wllama does not surface which backend ran.
          // In the 2026-10-29 evidence run the llama.cpp buffers were all CPU.
          webgpuAvailable: w.isSupportWebGPU(),
          threads: w.getNumThreads(),
          crossOriginIsolated: globalThis.crossOriginIsolated ?? false,
        },
        detail: meta['general.name'] ?? `${MODEL_PROFILE.repo} ${MODEL_PROFILE.quant}`,
      }
    })().catch((err: unknown) => {
      loadPromise = null
      status = { phase: 'error', detail: String((err as Error)?.message ?? err) }
      throw err
    })
  }
  return loadPromise
}

/** Score one post's text end to end: prompt → d1 decision → probabilities. */
export async function scorePost(postText: string): Promise<ScoreResult> {
  await ensureModel()
  if (!wllama) throw new Error('model not loaded')
  const t0 = performance.now()
  const response = await wllama.createSystemOne(buildDecisionRequest(postText))
  const probabilities = extractProbabilities(response.answers[QUESTION_ID])
  const loadedName = wllama.getLoadedContextInfo().metadata['general.name']
  return {
    probabilities,
    dominant: dominantClass(probabilities),
    modelName: `${loadedName ?? response.model} (${MODEL_PROFILE.repo} ${MODEL_PROFILE.quant})`,
    inputTokens: response.usage.input_tokens,
    ms: performance.now() - t0,
    promptVersion: PROMPT_VERSION,
    taxonomyVersion: TAXONOMY_VERSION,
  }
}
