// What gets practiced at each level. Each exercise draws a fixed pool of
// runs when a level starts; the pool must be fully cleared to unlock the
// next exercise.

import {
  ACCIDENTAL_PCS,
  NATURALS,
  nameForPitchClass,
  pitchClass,
  type Natural,
  type NoteName,
} from '../music/notes'
import { randomInt, shuffle, type Rng } from './rng'

export type ExerciseId = 1 | 2 | 3 | 4
export const EXERCISES: readonly ExerciseId[] = [1, 2, 3, 4]

export type PoolItem =
  /** Exercises 1 and 2: one note, 6->1->6. */
  | { kind: 'note'; note: NoteName }
  /** Exercise 3: `up` on the way up 6->1, `down` on the way back 1->6. */
  | { kind: 'pair'; up: NoteName; down: NoteName }
  /** Exercise 4: a random order of the 7 naturals, alternating direction. */
  | { kind: 'sequence'; notes: Natural[] }

/** Basics: each of the 7 naturals once, shuffled (7 runs). */
export function basicsQueue(rng: Rng): Natural[] {
  return shuffle(NATURALS, rng)
}

function randomSpelling(rng: Rng): 'sharp' | 'flat' {
  return rng() < 0.5 ? 'sharp' : 'flat'
}

function opposite(name: NoteName): NoteName {
  return nameForPitchClass(pitchClass(name), name.endsWith('#') ? 'flat' : 'sharp')
}

/** Exercise 1: all 7 naturals, shuffled. */
function naturalsPool(rng: Rng): PoolItem[] {
  return shuffle(NATURALS, rng).map((note) => ({ kind: 'note', note }))
}

/**
 * Exercise 2: all 5 accidental pitches once with a random spelling, plus 2
 * repeats of different pitches using the other spelling, each placed
 * somewhere after that pitch's first appearance. 7 runs.
 */
function accidentalsPool(rng: Rng): PoolItem[] {
  const firsts: NoteName[] = shuffle(ACCIDENTAL_PCS, rng).map((pc) =>
    nameForPitchClass(pc, randomSpelling(rng)),
  )
  const order = [...firsts]
  for (const first of shuffle(firsts, rng).slice(0, 2)) {
    const after = order.indexOf(first) + 1
    order.splice(after + randomInt(order.length - after + 1, rng), 0, opposite(first))
  }
  return order.map((note) => ({ kind: 'note', note }))
}

/** Exercise 3: the 12 pitch classes shuffled into 6 pairs, accidentals spelled at random. */
function pairsPool(rng: Rng): PoolItem[] {
  const names = shuffle(
    Array.from({ length: 12 }, (_, pc) => pc),
    rng,
  ).map((pc) => nameForPitchClass(pc, randomSpelling(rng)))
  const pool: PoolItem[] = []
  for (let i = 0; i < names.length; i += 2) pool.push({ kind: 'pair', up: names[i], down: names[i + 1] })
  return pool
}

export const SEQUENCE_SETS = 5

/** Exercise 4: 5 random orders of the 7 naturals. */
function sequencesPool(rng: Rng): PoolItem[] {
  return Array.from({ length: SEQUENCE_SETS }, () => ({
    kind: 'sequence' as const,
    notes: shuffle(NATURALS, rng),
  }))
}

export function drawPool(exercise: ExerciseId, rng: Rng): PoolItem[] {
  switch (exercise) {
    case 1:
      return naturalsPool(rng)
    case 2:
      return accidentalsPool(rng)
    case 3:
      return pairsPool(rng)
    case 4:
      return sequencesPool(rng)
  }
}
