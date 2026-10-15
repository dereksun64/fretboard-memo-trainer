// Basics plays in wait mode: no metronome, the run only advances when the
// expected note is played. A wrong note restarts the run from the top.

export interface WaitState {
  /** Index of the next expected note. */
  pos: number
  restarts: number
  done: boolean
}

export type WaitOutcome = 'hit' | 'wrong' | 'done'

export function startWait(): WaitState {
  return { pos: 0, restarts: 0, done: false }
}

/** Feed one detected note (exact MIDI pitch) against the run's expected pitches. */
export function feedWait(
  state: WaitState,
  expected: readonly number[],
  playedMidi: number,
): { state: WaitState; outcome: WaitOutcome } {
  if (state.done) return { state, outcome: 'done' }
  if (playedMidi !== expected[state.pos]) {
    return { state: { pos: 0, restarts: state.restarts + 1, done: false }, outcome: 'wrong' }
  }
  const pos = state.pos + 1
  const done = pos >= expected.length
  return { state: { ...state, pos, done }, outcome: done ? 'done' : 'hit' }
}
