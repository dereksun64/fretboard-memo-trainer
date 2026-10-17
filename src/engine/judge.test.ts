import { describe, expect, it } from 'vitest'
import { beatTargets, hitWindowMs, judgeBeats, perfectWindowMs, summarize, type BeatResult } from './judge'
import { singleNoteRun } from './sequence'

describe('hit window', () => {
  it('is 25% of a beat capped at 200 ms', () => {
    expect(hitWindowMs(40)).toBe(200)
    expect(hitWindowMs(75)).toBe(200)
    expect(hitWindowMs(80)).toBeCloseTo(187.5)
    expect(hitWindowMs(100)).toBe(150)
    expect(perfectWindowMs(40)).toBe(80)
  })
})

describe('judgeBeats', () => {
  const beats = [
    { time: 1, expectedMidi: 45 },
    { time: 2, expectedMidi: 57 },
    { time: 3, expectedMidi: 57 },
    { time: 4, expectedMidi: 57 },
  ]

  it('grades perfect, good, wrong and miss', () => {
    const notes = [
      { time: 1.05, midi: 45 }, // perfect (50 ms)
      { time: 1.85, midi: 57 }, // good (-150 ms)
      { time: 3.0, midi: 58 }, // wrong pitch
    ]
    const r = judgeBeats(beats, notes, 40, 10)
    expect(r.map((x) => x.judgment)).toEqual(['perfect', 'good', 'wrong', 'miss'])
    expect(r[1].offsetMs).toBe(-150)
  })

  it('treats notes outside the window as misses', () => {
    const r = judgeBeats(beats.slice(0, 1), [{ time: 1.25, midi: 45 }], 40, 10)
    expect(r[0].judgment).toBe('miss')
  })

  it('keeps beats pending until their window has closed', () => {
    const r = judgeBeats(beats, [], 40, 1.3)
    expect(r.map((x) => x.judgment)).toEqual(['pending', 'pending', 'pending', 'pending'])
    expect(judgeBeats(beats, [], 40, 1.5)[0].judgment).toBe('miss')
  })

  it('ignores a wrong note just before the first beat', () => {
    // wrong note in the count-in, inside beat 1's window, then the right one on time
    let r = judgeBeats(beats.slice(0, 1), [{ time: 0.9, midi: 50 }, { time: 1.02, midi: 45 }], 40, 10)
    expect(r[0].judgment).toBe('perfect')
    // with nothing else played, beat 1 is a miss rather than wrong
    r = judgeBeats(beats.slice(0, 1), [{ time: 0.9, midi: 50 }], 40, 10)
    expect(r[0].judgment).toBe('miss')
    // a wrong note after the first beat still counts
    r = judgeBeats(beats.slice(0, 1), [{ time: 1.1, midi: 50 }], 40, 10)
    expect(r[0].judgment).toBe('wrong')
  })

  it('uses each note for one beat only', () => {
    const close = [
      { time: 1, expectedMidi: 45 },
      { time: 1.2, expectedMidi: 45 },
    ]
    const r = judgeBeats(close, [{ time: 1.1, midi: 45 }], 100, 10)
    expect(r.map((x) => x.judgment)).toEqual(['good', 'miss'])
  })
})

describe('beatTargets', () => {
  it('spaces beats by the tempo and uses exact expected pitches', () => {
    const t = beatTargets(singleNoteRun('A', 1), 2, 60)
    expect(t).toHaveLength(12)
    expect(t[0]).toEqual({ time: 2, expectedMidi: 45 })
    expect(t[1]).toEqual({ time: 3, expectedMidi: 57 })
    expect(t[5].expectedMidi).toBe(69)
  })
})

describe('summarize', () => {
  const r = (judgment: BeatResult['judgment']): BeatResult => ({ judgment })

  it('scores accuracy, combo and clear', () => {
    const s = summarize([...Array(6).fill(r('perfect')), r('good')])
    expect(s.accuracy).toBe(98.6)
    expect(s.maxCombo).toBe(7)
    expect(s.cleared).toBe(true)
  })

  it('fails on any miss or wrong note and breaks the combo', () => {
    const s = summarize([r('perfect'), r('perfect'), r('wrong'), r('perfect')])
    expect(s.cleared).toBe(false)
    expect(s.combo).toBe(1)
    expect(s.maxCombo).toBe(2)
  })

  it('is not finished while beats are pending', () => {
    const s = summarize([r('perfect'), r('pending')])
    expect(s.finished).toBe(false)
    expect(s.cleared).toBe(false)
    expect(s.accuracy).toBe(100)
  })
})
