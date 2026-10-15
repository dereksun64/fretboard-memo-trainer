// Music theory helpers: note names, pitch classes, string/fret math.
// Strings are numbered like guitarists do: 6 = low E ... 1 = high E.

export type StringNum = 1 | 2 | 3 | 4 | 5 | 6

export const NATURALS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
export type Natural = (typeof NATURALS)[number]

// Only the 10 common accidentals; E#, Fb, B#, Cb are never used.
export const SHARPS = ['C#', 'D#', 'F#', 'G#', 'A#'] as const
export const FLATS = ['Db', 'Eb', 'Gb', 'Ab', 'Bb'] as const

export type NoteName = Natural | (typeof SHARPS)[number] | (typeof FLATS)[number]

const NATURAL_PC: Record<Natural, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

/** Pitch classes of the 5 accidentals (C#/Db, D#/Eb, F#/Gb, G#/Ab, A#/Bb). */
export const ACCIDENTAL_PCS = [1, 3, 6, 8, 10] as const

/** Name a pitch class; `spelling` only matters for accidentals. */
export function nameForPitchClass(pc: number, spelling: 'sharp' | 'flat'): NoteName {
  const i = ((pc % 12) + 12) % 12
  return (spelling === 'sharp' ? SHARP_NAMES[i] : FLAT_NAMES[i]) as NoteName
}

export function isNatural(name: NoteName): name is Natural {
  return name.length === 1
}

export const STRINGS: readonly StringNum[] = [6, 5, 4, 3, 2, 1]

/** Tab-style string names: low E, A, D, G, B, high e. */
export const STRING_NAME: Record<StringNum, string> = { 6: 'E', 5: 'A', 4: 'D', 3: 'G', 2: 'B', 1: 'e' }

/** String name for prose, telling the two E strings apart. */
export function stringLabel(s: StringNum): string {
  return s === 6 ? 'low E' : s === 1 ? 'high e' : STRING_NAME[s]
}

// Standard tuning, MIDI numbers of the open strings.
export const OPEN_STRING_MIDI: Record<StringNum, number> = {
  6: 40, // E2
  5: 45, // A2
  4: 50, // D3
  3: 55, // G3
  2: 59, // B3
  1: 64, // E4
}

export function pitchClass(name: NoteName): number {
  const base = NATURAL_PC[name[0] as Natural]
  if (name.length === 1) return base
  return (base + (name[1] === '#' ? 1 : -1) + 12) % 12
}

/**
 * The fret where `name` sits on `string` inside the 12-fret window
 * [windowStart, windowStart + 11]. Each pitch class appears exactly once.
 */
export function fretFor(name: NoteName, string: StringNum, windowStart = 1): number {
  const open = OPEN_STRING_MIDI[string]
  const offset = (((pitchClass(name) - (open + windowStart)) % 12) + 12) % 12
  return windowStart + offset
}

/** Exact MIDI pitch (octave included) expected for `name` on `string`. */
export function expectedMidi(name: NoteName, string: StringNum, windowStart = 1): number {
  return OPEN_STRING_MIDI[string] + fretFor(name, string, windowStart)
}

export function midiToName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12
  return `${SHARP_NAMES[pc]}${Math.floor(midi / 12) - 1}`
}

export function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440)
}
