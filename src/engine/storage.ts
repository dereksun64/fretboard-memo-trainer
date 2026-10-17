// Persist Progress in localStorage. Storage can be missing or throw
// (private windows, blocked site data), so every access is guarded and a
// bad or unreadable value falls back to a fresh start.

import { EXERCISES } from './pools'
import { newProgress, type Progress } from './progress'
import type { Rng } from './rng'

const KEY = 'fmt.progress'

function looksValid(v: unknown): v is Progress {
  if (!v || typeof v !== 'object') return false
  const p = v as Partial<Progress>
  return (
    p.version === 1 &&
    typeof p.level === 'number' &&
    Array.isArray(p.basics?.queue) &&
    typeof p.basics?.cleared === 'number' &&
    !!p.exercises &&
    EXERCISES.every((ex) => Array.isArray(p.exercises![ex]))
  )
}

export function loadProgress(rng: Rng, storage: Storage | undefined = globalThis.localStorage): Progress {
  try {
    const raw = storage?.getItem(KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (looksValid(parsed)) return parsed
    }
  } catch {
    // unreadable: start fresh
  }
  return newProgress(rng)
}

/** Remove everything this app keeps in localStorage (progress, settings, calibration). */
export function clearLocalData(storage: Storage | undefined = globalThis.localStorage): void {
  try {
    if (!storage) return
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((k): k is string => !!k?.startsWith('fmt.'))
    for (const k of keys) storage.removeItem(k)
  } catch {
    // storage unavailable: nothing to clear
  }
}

export function saveProgress(p: Progress, storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(KEY, JSON.stringify(p))
  } catch {
    // storage unavailable: progress lasts for this session only
  }
}
