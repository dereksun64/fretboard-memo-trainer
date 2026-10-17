// Basics plays in wait mode: no metronome, the run only advances when the
// expected note is played. A wrong note is counted but changes nothing else:
// the app keeps waiting for the right one (the mic can mishear, so wrong
// notes never cost progress). Wrong notes before the first correct one are
// ignored entirely.

export interface WaitState {
  /** Index of the next expected note. */
  pos: number
  /** Wrong notes heard so far in this run. */
  wrong: number
  done: boolean
}

export type WaitOutcome = 'hit' | 'wrong' | 'ignored' | 'done'

export function startWait(): WaitState {
  return { pos: 0, wrong: 0, done: false }
}

/** Feed one detected note (exact MIDI pitch) against the run's expected pitches. */
export function feedWait(
  state: WaitState,
  expected: readonly number[],
  playedMidi: number,
): { state: WaitState; outcome: WaitOutcome } {
  if (state.done) return { state, outcome: 'done' }
  if (playedMidi !== expected[state.pos]) {
    if (state.pos === 0) return { state, outcome: 'ignored' }
    return { state: { ...state, wrong: state.wrong + 1 }, outcome: 'wrong' }
  }
  const pos = state.pos + 1
  const done = pos >= expected.length
  return { state: { ...state, pos, done }, outcome: done ? 'done' : 'hit' }
}
