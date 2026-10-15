// Note sequences for runs. One pass = one note on all 6 strings in one
// direction; a run repeats its pattern 3 times.

import { STRINGS, type NoteName, type StringNum } from '../music/notes'

export interface Step {
  note: NoteName
  string: StringNum
}

const UP: readonly StringNum[] = STRINGS // 6 -> 1
const DOWN: readonly StringNum[] = [...STRINGS].reverse() // 1 -> 6

function pass(note: NoteName, strings: readonly StringNum[]): Step[] {
  return strings.map((string) => ({ note, string }))
}

/** Single note, 6->1->6, `reps` times (Prologue, Stages 1 and 2). */
export function singleNoteRun(note: NoteName, reps = 3): Step[] {
  const roundTrip = [...pass(note, UP), ...pass(note, DOWN)]
  return Array.from({ length: reps }, () => roundTrip).flat()
}
