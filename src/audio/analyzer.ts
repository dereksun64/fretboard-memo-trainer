// Turns a stream of mic samples into (a) a live pitch readout and
// (b) discrete note events: "a note started at time t with pitch m".
//
// Pure TypeScript with no Web Audio dependency, so it can be unit-tested
// with synthetic signals. Times are in seconds on the AudioContext clock
// (sample frame / sampleRate).
//
// How a note event is produced:
//  1. Onset: spectral flux (sum of per-bin increases in log magnitude) jumps
//     above its recent median. This catches a new pluck even while the
//     previous note is still ringing, which plain loudness can't.
//  2. Naming: compare the spectrum just *before* the onset with the spectrum
//     shortly *after* it. Only what got louder belongs to the new note, so a
//     ringing previous note (often an octave below) doesn't fool us. The new
//     energy is matched against the harmonic series of every candidate pitch.
//  3. An onset with no harmonic new energy (a metronome click, a thump) is
//     dropped.
//
// The live readout (tuner-style) uses the McLeod pitch method instead.

import { PitchDetector } from 'pitchy'
import { magnitudeSpectrum } from './fft'
import { freqToMidi } from '../music/notes'

export interface AnalyzerSettings {
  /** Onset fires when spectral flux exceeds its recent median by this factor. */
  onsetRatio: number
  /** Minimum MPM clarity for the live pitch readout. */
  clarityThreshold: number
  /** Absolute RMS floor below which nothing is considered sound. */
  minRms: number
  /** Gate = max(minRms, noiseFloor * noiseGateFactor). */
  noiseGateFactor: number
}

export const DEFAULT_SETTINGS: AnalyzerSettings = {
  onsetRatio: 3,
  clarityThreshold: 0.88,
  minRms: 0.002,
  noiseGateFactor: 4,
}

export interface LivePitch {
  time: number
  /** Fractional MIDI pitch, or null when there is no confident pitch. */
  midi: number | null
  clarity: number
  rms: number
  noiseFloor: number
}

export interface NoteEvent {
  /** Onset time (seconds, AudioContext clock, before latency correction). */
  time: number
  midi: number
  /** Deviation from `midi` in cents, from the MPM readout (0 if unavailable). */
  cents: number
  /** Share of MPM frames after the onset that agreed with `midi` (0..1). */
  agreement: number
}

const RING = 8192
const HOP = 256 // onset resolution (~5 ms at 48 kHz)
const FLUX_N = 2048 // onset spectrum size (long enough to see low E steadily)
const FLUX_LAG = 2 // hops; compare with the spectrum this many hops back
const NAME_N = 4096 // naming spectrum size (~85 ms at 48 kHz)
const MPM_N = 2048 // live pitch window
const MPM_EVERY = 2 // hops between live pitch updates
const FLUX_HISTORY = 24 // hops (~130 ms) for the adaptive onset threshold
const FLUX_FLOOR = 2 // absolute minimum flux for an onset
const REFRACTORY = 0.06 // s; min gap between onsets
const AFTER_DELAY = 0.025 // s; skip the attack (and any click) before naming
const MIN_MIDI = 38 // D2; below low E with headroom
const MAX_MIDI = 88 // E6
const HARMONICS = 8

interface Pending {
  time: number
  frame: number
  before: Float32Array
  mpm: number[]
}

export class NoteAnalyzer {
  settings: AnalyzerSettings
  private readonly sampleRate: number
  private readonly detector = PitchDetector.forFloat32Array(MPM_N)
  private readonly ring = new Float32Array(RING)
  /** Absolute frame number of the next sample written. */
  private frame = 0
  private hopFill = 0
  private hopSumSq = 0
  private hopCount = 0
  private readonly logSpecs: Float32Array[] = []
  private readonly fluxHistory: number[] = []
  private noiseFloor = 0.001
  private lastOnset = -Infinity
  private pending: Pending[] = []
  private live: LivePitch = { time: 0, midi: null, clarity: 0, rms: 0, noiseFloor: 0 }

  constructor(sampleRate: number, settings: AnalyzerSettings = DEFAULT_SETTINGS) {
    this.sampleRate = sampleRate
    this.settings = { ...settings }
    this.detector.minVolumeAbsolute = 0
  }

  get livePitch(): LivePitch {
    return this.live
  }

  /**
   * Feed a block of samples whose first sample is at `startFrame`.
   * Returns any note events that became final during this block.
   */
  push(samples: Float32Array, startFrame: number): NoteEvent[] {
    const out: NoteEvent[] = []
    this.frame = startFrame
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i]
      this.ring[this.frame % RING] = s
      this.frame++
      this.hopSumSq += s * s
      this.hopFill++
      if (this.hopFill === HOP) {
        this.processHop(out)
        this.hopFill = 0
        this.hopSumSq = 0
      }
    }
    return out
  }

  /** Copy the `n` samples ending (exclusive) at absolute frame `end`. */
  private window(end: number, n: number): Float32Array {
    const w = new Float32Array(n)
    for (let i = 0; i < n; i++) w[i] = this.ring[(((end - n + i) % RING) + RING) % RING]
    return w
  }

  private processHop(out: NoteEvent[]) {
    const end = this.frame
    const time = end / this.sampleRate
    const rms = Math.sqrt(this.hopSumSq / HOP)
    const { onsetRatio, minRms, noiseGateFactor } = this.settings
    const warm = end >= RING

    // Noise floor: drops immediately; rises slowly, and only while nothing
    // pitched is sounding, so a ringing note can't drag it up.
    if (rms < this.noiseFloor) this.noiseFloor = Math.max(rms, 1e-5)
    else if (this.live.clarity < 0.6) this.noiseFloor *= 1.002
    const gate = Math.max(minRms, this.noiseFloor * noiseGateFactor)

    // Onset detection, SuperFlux style: sum the per-bin rise in log magnitude
    // against a max-filtered spectrum from a couple of hops back, which
    // ignores the wobble of low notes and slight pitch drift.
    const spec = magnitudeSpectrum(this.window(end, FLUX_N))
    const logSpec = new Float32Array(spec.length)
    for (let i = 0; i < spec.length; i++) logSpec[i] = Math.log1p(spec[i] * 1000)
    let flux = 0
    if (this.logSpecs.length === FLUX_LAG) {
      const ref = this.logSpecs[0]
      const binHz = this.sampleRate / FLUX_N
      const lo = Math.floor(60 / binHz)
      const hi = Math.min(spec.length - 1, Math.ceil(6000 / binHz))
      for (let i = lo; i < hi; i++) {
        const r = Math.max(ref[i - 1], ref[i], ref[i + 1])
        flux += Math.max(0, logSpec[i] - r)
      }
    }
    this.logSpecs.push(logSpec)
    if (this.logSpecs.length > FLUX_LAG) this.logSpecs.shift()
    const sorted = [...this.fluxHistory].sort((a, b) => a - b)
    const median = sorted.length ? sorted[sorted.length >> 1] : 0
    const onsetTime = (end - HOP) / this.sampleRate
    if (
      warm &&
      rms > gate &&
      flux > Math.max(FLUX_FLOOR, median * onsetRatio) &&
      onsetTime - this.lastOnset > REFRACTORY
    ) {
      this.lastOnset = onsetTime
      // A newer onset cuts short anything still waiting to be named.
      for (const p of this.pending.splice(0)) this.finish(p, end - HOP, gate, out)
      this.pending.push({
        time: onsetTime,
        frame: end - HOP,
        before: magnitudeSpectrum(this.window(end - HOP, NAME_N)),
        mpm: [],
      })
    }
    this.fluxHistory.push(flux)
    if (this.fluxHistory.length > FLUX_HISTORY) this.fluxHistory.shift()

    // Live pitch readout.
    this.hopCount++
    if (warm && this.hopCount % MPM_EVERY === 0) {
      const [freq, clarity] = this.detector.findPitch(this.window(end, MPM_N), this.sampleRate)
      const midi = freq > 0 ? freqToMidi(freq) : NaN
      const ok =
        rms > gate &&
        clarity >= this.settings.clarityThreshold &&
        midi >= MIN_MIDI &&
        midi <= MAX_MIDI
      this.live = { time, midi: ok ? midi : null, clarity, rms, noiseFloor: this.noiseFloor }
      if (ok) {
        for (const p of this.pending) if (end - MPM_N >= p.frame) p.mpm.push(midi)
      }
    }

    // Name pending onsets once a full window after the attack is available.
    const delay = Math.round(AFTER_DELAY * this.sampleRate)
    while (this.pending.length && end >= this.pending[0].frame + delay + NAME_N) {
      this.finish(this.pending.shift()!, end, gate, out)
    }
  }

  private finish(p: Pending, end: number, gate: number, out: NoteEvent[]) {
    const n = Math.min(NAME_N, end - p.frame - Math.round(AFTER_DELAY * this.sampleRate))
    if (n < NAME_N / 2) return // cut off too early to name reliably
    const size = n >= NAME_N ? NAME_N : NAME_N / 2
    const after = magnitudeSpectrum(this.window(end, size))
    const before = size === NAME_N ? p.before : downsampleSpectrum(p.before)
    const midi = nameNewNote(before, after, this.sampleRate, size, gate)
    if (midi === null) return
    const agreeing = p.mpm.filter((m) => Math.round(m) === midi)
    const cents = agreeing.length
      ? Math.round((agreeing.reduce((a, m) => a + m, 0) / agreeing.length - midi) * 100)
      : 0
    out.push({
      time: p.time,
      midi,
      cents,
      agreement: p.mpm.length ? agreeing.length / p.mpm.length : 0,
    })
  }
}

/** Halve a spectrum's resolution (for when the after-window had to be shorter). */
function downsampleSpectrum(spec: Float32Array): Float32Array {
  const out = new Float32Array(spec.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = Math.max(spec[2 * i], spec[2 * i + 1])
  return out
}

/**
 * Name the note that started between `before` and `after` (magnitude spectra
 * of the windows just before the onset and shortly after it). Returns null if
 * nothing loud and new enough was found.
 */
export function nameNewNote(
  before: Float32Array,
  after: Float32Array,
  sampleRate: number,
  n: number,
  gate: number,
): number | null {
  const binHz = sampleRate / n
  const lo = Math.floor(60 / binHz)
  const hi = Math.min(after.length, Math.ceil(5000 / binHz))

  // How much of the old sound is still there? Bins where the old sound was
  // strong and nothing new landed shrink by the decay factor; bins shared
  // with the new note grow. A low quantile of after/before therefore
  // estimates the decay: ~0 if the old note was damped, ~0.8 if it rings.
  let beforePeak = 0
  for (let i = lo; i < hi; i++) beforePeak = Math.max(beforePeak, before[i])
  const ratios: number[] = []
  for (let i = lo; i < hi; i++) {
    if (before[i] > 0.1 * beforePeak && before[i] > 0.05 * gate) ratios.push(after[i] / before[i])
  }
  ratios.sort((a, b) => a - b)
  const decay = ratios.length >= 5 ? Math.min(1, ratios[Math.floor(ratios.length * 0.3)]) : 0

  const residual = new Float32Array(after.length)
  let afterPeak = 0
  let residualPeak = 0
  let afterSum = 0
  let beforeSum = 0
  for (let i = lo; i < hi; i++) {
    residual[i] = Math.max(0, after[i] - decay * before[i])
    afterPeak = Math.max(afterPeak, after[i])
    residualPeak = Math.max(residualPeak, residual[i])
    afterSum += after[i]
    beforeSum += before[i]
  }
  // A sine of RMS `gate` peaks around 0.35 * gate in a Hann magnitude spectrum.
  if (afterPeak < 0.2 * gate) return null
  if (residualPeak > 0.25 * afterPeak) {
    return residualPeak < 0.2 * gate ? null : bestHarmonicMatch(residual, binHz)
  }
  // Little new energy relative to what's sounding. If it still got louder
  // overall, the same pitch was plucked again on top of itself and the full
  // spectrum names it. If not, the "onset" was something else (a mute, a
  // note being cut off) and there is no new note.
  if (afterSum < 1.2 * beforeSum) return null
  return bestHarmonicMatch(after.slice(), binHz)
}

/**
 * The MIDI pitch whose harmonic series best fits `spec`. Score = energy on
 * the candidate's harmonics minus energy halfway between them: an
 * octave-too-high candidate is punished by the real odd harmonics sitting
 * between its own, and an octave-too-low one only collects half the partials.
 */
function bestHarmonicMatch(spec: Float32Array, binHz: number): number {
  // sqrt-compress so a few loud partials don't dominate.
  for (let i = 0; i < spec.length; i++) spec[i] = Math.sqrt(spec[i])
  const at = (hz: number) => {
    const x = hz / binHz
    const i = Math.floor(x)
    if (i + 1 >= spec.length) return 0
    return spec[i] + (spec[i + 1] - spec[i]) * (x - i)
  }

  let best = MIN_MIDI
  let bestScore = -Infinity
  for (let m = MIN_MIDI; m <= MAX_MIDI; m++) {
    const f0 = 440 * 2 ** ((m - 69) / 12)
    let score = 0
    for (let k = 1; k <= HARMONICS; k++) score += at(k * f0) - at((k - 0.5) * f0)
    if (score > bestScore) {
      bestScore = score
      best = m
    }
  }
  return best
}
