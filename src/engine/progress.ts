// The player's progress, as a plain serializable value. Every update is a
// pure function returning a new Progress, so the UI can store it as state
// and persist it as-is.
//
// Rules (see SPEC.md):
// - Basics (14 runs) is done once and unlocks Exercise 1.
// - Within a level, exercises unlock in order: an exercise opens when the
//   previous one's whole pool is cleared.
// - Clearing all four exercises lets you increase the BPM by 1-10; the new
//   level gets fresh pools and Exercises 2-4 lock again.
// - Practice runs (any exercise, any BPM) never touch Progress.

import { basicsQueue, drawPool, EXERCISES, type ExerciseId, type PoolItem } from './pools'
import type { Natural } from '../music/notes'
import type { Rng } from './rng'

export const START_LEVEL = 40
export const TARGET_LEVEL = 80
export const MIN_INCREASE = 1
export const MAX_INCREASE = 10
export const DEFAULT_INCREASE = 5

export interface PoolEntry {
  item: PoolItem
  cleared: boolean
}

export interface Progress {
  version: 1
  /** Current level, which is the BPM runs count at. */
  level: number
  basics: { queue: Natural[]; cleared: number }
  exercises: Record<ExerciseId, PoolEntry[]>
}

function freshPools(rng: Rng): Progress['exercises'] {
  const entries = (ex: ExerciseId) => drawPool(ex, rng).map((item) => ({ item, cleared: false }))
  return { 1: entries(1), 2: entries(2), 3: entries(3), 4: entries(4) }
}

export function newProgress(rng: Rng): Progress {
  return {
    version: 1,
    level: START_LEVEL,
    basics: { queue: basicsQueue(rng), cleared: 0 },
    exercises: freshPools(rng),
  }
}

// ---- Basics ----

export function basicsDone(p: Progress): boolean {
  return p.basics.cleared >= p.basics.queue.length
}

/** The note for the next Basics run, or null when Basics is done. */
export function nextBasicsNote(p: Progress): Natural | null {
  return basicsDone(p) ? null : p.basics.queue[p.basics.cleared]
}

/** Basics runs only end when cleared (wait mode waits through wrong notes). */
export function recordBasicsClear(p: Progress): Progress {
  if (basicsDone(p)) return p
  return { ...p, basics: { ...p.basics, cleared: p.basics.cleared + 1 } }
}

// ---- Exercises ----

export function clearedCount(p: Progress, ex: ExerciseId): number {
  return p.exercises[ex].filter((e) => e.cleared).length
}

export function poolSize(p: Progress, ex: ExerciseId): number {
  return p.exercises[ex].length
}

export function exerciseDone(p: Progress, ex: ExerciseId): boolean {
  return clearedCount(p, ex) === poolSize(p, ex)
}

export function isUnlocked(p: Progress, ex: ExerciseId): boolean {
  if (!basicsDone(p)) return false
  return EXERCISES.filter((e) => e < ex).every((e) => exerciseDone(p, e))
}

/** The exercise to work on now: the first unlocked one not yet cleared. */
export function currentExercise(p: Progress): ExerciseId | null {
  if (!basicsDone(p)) return null
  return EXERCISES.find((ex) => !exerciseDone(p, ex)) ?? null
}

/** Number of exercises fully cleared at this level (0-4). */
export function exercisesCleared(p: Progress): number {
  return EXERCISES.filter((ex) => exerciseDone(p, ex)).length
}

/** The next run to play for `ex`: the first uncleared pool entry. */
export function nextItem(p: Progress, ex: ExerciseId): PoolItem | null {
  if (!isUnlocked(p, ex)) return null
  return p.exercises[ex].find((e) => !e.cleared)?.item ?? null
}

/**
 * Record the result of the run returned by `nextItem(p, ex)`. A cleared run
 * is checked off; a failed one moves to the back of the remaining runs so
 * the next attempt is a different note.
 */
export function recordRun(p: Progress, ex: ExerciseId, cleared: boolean): Progress {
  if (!isUnlocked(p, ex)) return p
  const pool = p.exercises[ex]
  const i = pool.findIndex((e) => !e.cleared)
  if (i === -1) return p
  let next: PoolEntry[]
  if (cleared) {
    next = pool.map((e, j) => (j === i ? { ...e, cleared: true } : e))
  } else {
    next = [...pool.slice(0, i), ...pool.slice(i + 1), pool[i]]
  }
  return { ...p, exercises: { ...p.exercises, [ex]: next } }
}

// ---- Level ----

export function canIncreaseBpm(p: Progress): boolean {
  return exercisesCleared(p) === EXERCISES.length
}

export function clampIncrease(delta: number): number {
  return Math.min(MAX_INCREASE, Math.max(MIN_INCREASE, Math.round(delta)))
}

/** Move to level + delta (1-10) with fresh pools. No-op unless all exercises are cleared. */
export function increaseBpm(p: Progress, delta: number, rng: Rng): Progress {
  if (!canIncreaseBpm(p)) return p
  return { ...p, level: p.level + clampIncrease(delta), exercises: freshPools(rng) }
}

/** How the 40->80 bar should look: fill fraction and how rainbow it is past 80. */
export function levelBar(level: number): { fill: number; rainbow: number; mastered: boolean } {
  const span = TARGET_LEVEL - START_LEVEL
  return {
    fill: Math.min(1, Math.max(0, (level - START_LEVEL) / span)),
    rainbow: level <= TARGET_LEVEL ? 0 : Math.min(1, (level - TARGET_LEVEL) / span),
    mastered: level >= TARGET_LEVEL,
  }
}
