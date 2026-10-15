// Rhythm-mode judging: match detected note events to metronome beats.

import { expectedMidi } from '../music/notes'
import type { Step } from './sequence'

export type Judgment = 'perfect' | 'good' | 'miss' | 'wrong'

export interface BeatTarget {
  /** Beat time in seconds (AudioContext clock). */
  time: number
  expectedMidi: number
}

export interface PlayedNote {
  /** Latency-corrected onset time in seconds. */
  time: number
  midi: number
}

export interface BeatResult {
  judgment: Judgment | 'pending'
  /** Played minus beat, in ms (negative = early). Absent for miss/pending. */
  offsetMs?: number
  playedMidi?: number
}

/** ± hit window in ms: 25% of a beat, capped at 200 ms. */
export function hitWindowMs(bpm: number): number {
  return Math.min((0.25 * 60000) / bpm, 200)
}

/** ± Perfect window in ms: the inner 40% of the hit window. */
export function perfectWindowMs(bpm: number): number {
  return hitWindowMs(bpm) * 0.4
}

/**
 * Judge each beat. The first note inside a beat's window decides it.
 * A beat is 'pending' until `now` passes the end of its window plus
 * `settle` seconds, the time the analyzer needs to name a note.
 */
export function judgeBeats(
  beats: BeatTarget[],
  notes: PlayedNote[],
  bpm: number,
  now: number,
  settle = 0.25,
): BeatResult[] {
  const win = hitWindowMs(bpm) / 1000
  const perfect = perfectWindowMs(bpm) / 1000
  const used = new Set<number>()

  return beats.map((beat) => {
    const idx = notes.findIndex(
      (n, i) => !used.has(i) && Math.abs(n.time - beat.time) <= win,
    )
    if (idx === -1) {
      return { judgment: now > beat.time + win + settle ? 'miss' : 'pending' }
    }
    used.add(idx)
    const note = notes[idx]
    const offset = note.time - beat.time
    const result = { offsetMs: Math.round(offset * 1000), playedMidi: note.midi }
    if (note.midi !== beat.expectedMidi) return { judgment: 'wrong', ...result }
    return { judgment: Math.abs(offset) <= perfect ? 'perfect' : 'good', ...result }
  })
}

/** Beat targets for a run whose first note lands at `firstBeat` seconds. */
export function beatTargets(
  steps: readonly Step[],
  firstBeat: number,
  bpm: number,
  windowStart = 1,
): BeatTarget[] {
  const spb = 60 / bpm
  return steps.map((s, i) => ({ time: firstBeat + i * spb, expectedMidi: expectedMidi(s.note, s.string, windowStart) }))
}

export interface RunSummary {
  /** Zero misses and zero wrong notes. Only meaningful once nothing is pending. */
  cleared: boolean
  finished: boolean
  perfect: number
  good: number
  miss: number
  wrong: number
  /** Perfect counts 1, Good 0.9, Miss and Wrong 0; over judged beats (0-100). */
  accuracy: number
  combo: number
  maxCombo: number
}

export function summarize(results: readonly BeatResult[]): RunSummary {
  const s = { perfect: 0, good: 0, miss: 0, wrong: 0 }
  let combo = 0
  let maxCombo = 0
  let judged = 0
  for (const r of results) {
    if (r.judgment === 'pending') break
    judged++
    s[r.judgment]++
    combo = r.judgment === 'perfect' || r.judgment === 'good' ? combo + 1 : 0
    maxCombo = Math.max(maxCombo, combo)
  }
  const finished = judged === results.length
  return {
    ...s,
    cleared: finished && s.miss === 0 && s.wrong === 0,
    finished,
    accuracy: judged ? Math.round(((s.perfect + 0.9 * s.good) / judged) * 1000) / 10 : 0,
    combo,
    maxCombo,
  }
}
