import { describe, expect, it } from 'vitest'
import { expectedMidi, fretFor, midiToName, pitchClass } from './notes'

describe('notes', () => {
  it('treats enharmonic names as the same pitch', () => {
    expect(pitchClass('A#')).toBe(pitchClass('Bb'))
    expect(pitchClass('Db')).toBe(1)
  })

  it('finds each note once per string in frets 1-12', () => {
    expect(fretFor('A', 6)).toBe(5)
    expect(fretFor('A', 5)).toBe(12) // open A excluded
    expect(fretFor('E', 1)).toBe(12)
    expect(fretFor('F', 1)).toBe(1)
  })

  it('respects other 12-fret windows', () => {
    expect(fretFor('A', 5, 5)).toBe(12)
    expect(fretFor('F', 6, 5)).toBe(13)
    expect(fretFor('A', 6, 5)).toBe(5)
  })

  it('gives exact expected pitches', () => {
    expect(midiToName(expectedMidi('A', 6))).toBe('A2')
    expect(midiToName(expectedMidi('A', 4))).toBe('A3')
    expect(midiToName(expectedMidi('A', 1))).toBe('A4')
  })
})
