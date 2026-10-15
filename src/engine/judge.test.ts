import { describe, expect, it } from 'vitest'
import { hitWindowMs, judgeBeats, perfectWindowMs } from './judge'

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

  it('uses each note for one beat only', () => {
    const close = [
      { time: 1, expectedMidi: 45 },
      { time: 1.2, expectedMidi: 45 },
    ]
    const r = judgeBeats(close, [{ time: 1.1, midi: 45 }], 100, 10)
    expect(r.map((x) => x.judgment)).toEqual(['good', 'miss'])
  })
})
