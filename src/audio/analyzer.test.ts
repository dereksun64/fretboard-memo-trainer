import { describe, expect, it } from 'vitest'
import { expectedMidi, STRINGS, type NoteName } from '../music/notes'
import { NoteAnalyzer, type NoteEvent } from './analyzer'

const SR = 48000

// Seeded PRNG so failures are reproducible.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32
    return seed / 2 ** 32
  }
}

/**
 * Additive plucked-string model. Partial k has amplitude |sin(k*pi*beta)|/k
 * (beta = pluck position along the string), higher partials decay faster,
 * slight inharmonicity, and a short noisy attack: close to a real guitar
 * spectrum without a recording.
 */
function pluck(
  out: Float32Array,
  start: number,
  midi: number,
  amp: number,
  rand: () => number,
  stopAt = Infinity,
) {
  const f0 = 440 * 2 ** ((midi - 69) / 12)
  const beta = 0.1 + 0.15 * rand()
  const len = Math.min(out.length - start, Math.round(SR * 1.5))
  const fade = SR * 0.02 // lifting the fretting finger damps the string over ~20 ms
  const partials: { re: number; im: number; cos: number; sin: number; damp: number; a: number }[] = []
  let norm = 0
  for (let k = 1; k <= 30; k++) {
    const fk = k * f0 * Math.sqrt(1 + 1e-4 * k * k)
    if (fk > 6000) break
    const a = Math.abs(Math.sin(k * Math.PI * beta)) / k
    const tau = 1.8 / (1 + (k * f0) / 300) // seconds
    const w = (2 * Math.PI * fk) / SR
    const phase = rand() * 2 * Math.PI
    partials.push({ re: Math.cos(phase), im: Math.sin(phase), cos: Math.cos(w), sin: Math.sin(w), damp: Math.exp(-1 / (tau * SR)), a })
    norm += a
  }
  const attack = SR * 0.003
  for (let i = 0; i < len; i++) {
    const t = start + i
    const stop = Math.min(stopAt, start + len - fade)
    const gain = t < stop ? 1 : Math.max(0, 1 - (t - stop) / fade)
    if (gain === 0) break
    let v = 0
    for (const p of partials) {
      v += p.a * p.im
      // rotate the phasor and apply decay
      const re = (p.re * p.cos - p.im * p.sin) * p.damp
      p.im = (p.re * p.sin + p.im * p.cos) * p.damp
      p.re = re
    }
    const env = i < attack ? i / attack : 1
    const noiseBurst = i < SR * 0.005 ? (rand() * 2 - 1) * 0.3 * (1 - i / (SR * 0.005)) : 0
    out[t] += amp * gain * (env * (v / norm) * 2 + noiseBurst)
  }
}

/** Unpitched metronome-like click: 25 ms decaying noise burst. */
function click(out: Float32Array, start: number, amp: number, rand: () => number) {
  const len = Math.floor(SR * 0.025)
  for (let i = 0; i < len && start + i < out.length; i++) {
    out[start + i] += (rand() * 2 - 1) * amp * Math.exp(-i / (SR * 0.005))
  }
}

function noise(out: Float32Array, amp: number, rand: () => number) {
  for (let i = 0; i < out.length; i++) out[i] += (rand() * 2 - 1) * amp
}

/** 2nd-order high-pass, mimicking a laptop mic's weak low end. */
function highpass(x: Float32Array, cutoff: number) {
  const w = (2 * Math.PI * cutoff) / SR
  const q = Math.SQRT1_2
  const alpha = Math.sin(w) / (2 * q)
  const cos = Math.cos(w)
  const a0 = 1 + alpha
  const b0 = (1 + cos) / 2 / a0
  const b1 = -(1 + cos) / a0
  const b2 = b0
  const a1 = (-2 * cos) / a0
  const a2 = (1 - alpha) / a0
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < x.length; i++) {
    const y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = x[i]
    y2 = y1
    y1 = y
    x[i] = y
  }
}

function analyze(signal: Float32Array): NoteEvent[] {
  const a = new NoteAnalyzer(SR)
  const events: NoteEvent[] = []
  for (let i = 0; i < signal.length; i += 512) {
    events.push(...a.push(signal.subarray(i, i + 512), i))
  }
  return events
}

/** One pass of `note` across strings 6->1, one pluck per beat. */
function passSignal(
  note: NoteName,
  bpm: number,
  opts: { clicks?: boolean; noteAmp?: number; ring?: boolean; laptopMic?: boolean } = {},
) {
  const rand = rng(42)
  const spb = 60 / bpm
  const lead = 0.5
  const targets = STRINGS.map((s, i) => ({ time: lead + i * spb, midi: expectedMidi(note, s) }))
  const signal = new Float32Array(Math.ceil((lead + targets.length * spb + 1) * SR))
  noise(signal, 0.0005, rand)
  targets.forEach((t, i) => {
    const at = Math.round(t.time * SR)
    // By default the previous note is damped when the finger moves on;
    // `ring` is the worst case where it keeps sounding.
    const next = targets[i + 1]
    const stopAt = opts.ring || !next ? Infinity : Math.round(next.time * SR)
    if (opts.clicks) click(signal, at, 0.3, rand)
    pluck(signal, at, t.midi, opts.noteAmp ?? 0.3, rand, stopAt)
  })
  if (opts.laptopMic) highpass(signal, 200)
  return { signal, targets }
}

function expectMatches(events: NoteEvent[], targets: { time: number; midi: number }[]) {
  expect(events.map((e) => e.midi)).toEqual(targets.map((t) => t.midi))
  for (let i = 0; i < targets.length; i++) {
    expect(Math.abs(events[i].time - targets[i].time)).toBeLessThan(0.015)
  }
}

describe('NoteAnalyzer', () => {
  it('detects each note of a pass with correct octave and timing', () => {
    for (const note of ['A', 'C', 'E', 'F', 'B'] as NoteName[]) {
      const { signal, targets } = passSignal(note, 80)
      expectMatches(analyze(signal), targets)
    }
  })

  it('handles accidentals and fast tempos', () => {
    const { signal, targets } = passSignal('Bb', 140)
    expectMatches(analyze(signal), targets)
  })

  it('covers the lowest and highest notes in frets 1-12', () => {
    const rand = rng(7)
    const notes = [41, 52, 76, 65] // F2 (6th fret 1), E3 (6th fret 12), E5 (1st fret 12), F4 (1st fret 1)
    const signal = new Float32Array(SR * 5)
    noise(signal, 0.0005, rand)
    notes.forEach((m, i) => pluck(signal, Math.round((0.5 + i) * SR), m, 0.3, rand))
    expect(analyze(signal).map((e) => e.midi)).toEqual(notes)
  })

  it('ignores metronome clicks on their own', () => {
    const rand = rng(3)
    const signal = new Float32Array(SR * 4)
    noise(signal, 0.0005, rand)
    for (let i = 0; i < 6; i++) click(signal, Math.round((0.5 + i * 0.5) * SR), 0.3, rand)
    expect(analyze(signal)).toEqual([])
  })

  it('still names notes played on top of clicks (speaker bleed)', () => {
    const { signal, targets } = passSignal('G', 60, { clicks: true })
    expectMatches(analyze(signal), targets)
  })

  it('ignores background noise', () => {
    const rand = rng(11)
    const signal = new Float32Array(SR * 3)
    noise(signal, 0.002, rand)
    expect(analyze(signal)).toEqual([])
  })

  it('detects quieter playing', () => {
    const { signal, targets } = passSignal('D', 80, { noteAmp: 0.03 })
    expectMatches(analyze(signal), targets)
  })

  it('names new notes while the previous note keeps ringing', () => {
    for (const note of ['A', 'E', 'G', 'C'] as NoteName[]) {
      const { signal, targets } = passSignal(note, 80, { ring: true })
      expectMatches(analyze(signal), targets)
    }
  })

  it('survives a mic with weak low end', () => {
    for (const note of ['F', 'G', 'A', 'B'] as NoteName[]) {
      const { signal, targets } = passSignal(note, 80, { laptopMic: true })
      expectMatches(analyze(signal), targets)
    }
  })

  it('handles every natural, sharp and flat on every string', () => {
    const all: NoteName[] = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B']
    for (const note of all) {
      const { signal, targets } = passSignal(note, 60, { laptopMic: true, clicks: true })
      expectMatches(analyze(signal), targets)
    }
  })

  it('copes with everything at once: ringing, weak bass, clicks, 100 BPM', () => {
    for (const note of ['A', 'D', 'F#', 'Eb'] as NoteName[]) {
      const { signal, targets } = passSignal(note, 100, { ring: true, laptopMic: true, clicks: true })
      expectMatches(analyze(signal), targets)
    }
  })
})
