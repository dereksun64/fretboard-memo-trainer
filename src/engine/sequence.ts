// Note sequences for runs. One pass = one note on all 6 strings in one
// direction; a run repeats its pattern 3 times.

import { STRINGS, type NoteName, type StringNum } from '../music/notes'
import type { PoolItem } from './pools'

export interface Step {
  note: NoteName
  string: StringNum
}

export const REPS = 3

const UP: readonly StringNum[] = STRINGS // 6 -> 1
const DOWN: readonly StringNum[] = [...STRINGS].reverse() // 1 -> 6

function pass(note: NoteName, strings: readonly StringNum[]): Step[] {
  return strings.map((string) => ({ note, string }))
}

function repeat(pattern: Step[], reps: number): Step[] {
  return Array.from({ length: reps }, () => pattern).flat()
}

/** One note, 6->1->6, `reps` times (Basics, Exercises 1 and 2). 36 beats. */
export function singleNoteRun(note: NoteName, reps = REPS): Step[] {
  return repeat([...pass(note, UP), ...pass(note, DOWN)], reps)
}

/** `up` on strings 6->1, then `down` on 1->6, `reps` times (Exercise 3). 36 beats. */
export function pairRun(up: NoteName, down: NoteName, reps = REPS): Step[] {
  return repeat([...pass(up, UP), ...pass(down, DOWN)], reps)
}

/**
 * Each note of `notes` gets one pass, alternating up and down, and the
 * same order is played `reps` times (Exercise 4). The alternation carries
 * across reps so there is never a jump from string 1 back to string 6.
 * 7 notes x 6 strings x 3 = 126 beats.
 */
export function sequenceRun(notes: readonly NoteName[], reps = REPS): Step[] {
  const out: Step[] = []
  let k = 0
  for (let r = 0; r < reps; r++) {
    for (const note of notes) out.push(...pass(note, k++ % 2 === 0 ? UP : DOWN))
  }
  return out
}

export function runSteps(item: PoolItem, reps = REPS): Step[] {
  switch (item.kind) {
    case 'note':
      return singleNoteRun(item.note, reps)
    case 'pair':
      return pairRun(item.up, item.down, reps)
    case 'sequence':
      return sequenceRun(item.notes, reps)
  }
}
