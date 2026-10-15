import { describe, expect, it } from 'vitest'
import { pairRun, runSteps, sequenceRun, singleNoteRun } from './sequence'

const strings = (steps: { string: number }[]) => steps.map((s) => s.string)

describe('sequences', () => {
  it('single note: 6->1->6 three times, 36 beats', () => {
    const run = singleNoteRun('A')
    expect(run).toHaveLength(36)
    expect(strings(run.slice(0, 12))).toEqual([6, 5, 4, 3, 2, 1, 1, 2, 3, 4, 5, 6])
    expect(run.every((s) => s.note === 'A')).toBe(true)
  })

  it('pair: first note going up, second coming down', () => {
    const run = pairRun('C', 'F#')
    expect(run).toHaveLength(36)
    expect(run.slice(0, 6).every((s) => s.note === 'C')).toBe(true)
    expect(run.slice(6, 12).every((s) => s.note === 'F#')).toBe(true)
    expect(strings(run.slice(0, 12))).toEqual([6, 5, 4, 3, 2, 1, 1, 2, 3, 4, 5, 6])
  })

  it('sequence: alternates direction continuously across reps, 126 beats', () => {
    const notes = ['D', 'F', 'C', 'E', 'A', 'G', 'B'] as const
    const run = sequenceRun(notes)
    expect(run).toHaveLength(126)
    // Pass k is up when k is even, down when odd, including across the rep boundary.
    for (let k = 0; k < 21; k++) {
      const pass = run.slice(k * 6, k * 6 + 6)
      expect(pass.every((s) => s.note === notes[k % 7])).toBe(true)
      expect(strings(pass)).toEqual(k % 2 === 0 ? [6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6])
    }
    // No jump between passes: each pass starts on the string the last one ended on.
    for (let k = 1; k < 21; k++) expect(run[k * 6].string).toBe(run[k * 6 - 1].string)
  })

  it('maps pool items to runs', () => {
    expect(runSteps({ kind: 'note', note: 'Bb' })).toEqual(singleNoteRun('Bb'))
    expect(runSteps({ kind: 'pair', up: 'C', down: 'D' })).toEqual(pairRun('C', 'D'))
  })
})
