import type { ModelStatus } from './decision/classifier'

/** Whether a `status` poll should kick off a model load. False once the model
 *  reaches a terminal state so errors stay persistent and `ready` stays idle. */
export function shouldStartModelLoad(phase: ModelStatus['phase']): boolean {
  return phase !== 'ready' && phase !== 'error'
}
