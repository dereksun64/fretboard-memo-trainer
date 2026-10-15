// Sample-accurate metronome using the Web Audio lookahead pattern:
// a coarse JS timer schedules clicks slightly ahead on the audio clock.
//
// The click is a short filtered noise burst, deliberately unpitched, so the
// note analyzer won't mistake bleed from laptop speakers for a note.

// Clicks are handed to the audio thread this far ahead. Generous, because
// browsers slow timers in background tabs (to ~1 s); stop() cancels clicks
// already scheduled, so a long lookahead never leaves stray clicks.
const LOOKAHEAD = 1.2 // s
const TICK_MS = 50

export class Metronome {
  private readonly ctx: AudioContext
  private readonly out: GainNode
  private readonly noise: AudioBuffer
  private timer: number | null = null
  private t0 = 0
  private spb = 1
  private next = 0
  private accent: (beat: number) => boolean = (i) => i % 4 === 0
  private maxBeats = Infinity
  /** Clicks already handed to the audio thread, so stop() can cancel them. */
  private scheduled: AudioBufferSourceNode[] = []

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.out = ctx.createGain()
    this.out.gain.value = 0.6
    this.out.connect(ctx.destination)

    const len = Math.floor(ctx.sampleRate * 0.03)
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  }

  get running(): boolean {
    return this.timer !== null
  }

  set volume(v: number) {
    this.out.gain.value = v
  }

  /** Time of beat `i` (beat 0 is the first click). */
  beatTime(i: number): number {
    return this.t0 + i * this.spb
  }

  /** Index of the beat nearest to `time`. */
  nearestBeat(time: number): number {
    return Math.round((time - this.t0) / this.spb)
  }

  /**
   * Start clicking at `startTime` (default: shortly from now).
   * `beats` limits the total number of clicks; `accent` picks the louder
   * ones (default: every 4th).
   */
  start(bpm: number, opts: { startTime?: number; beats?: number; accent?: (beat: number) => boolean } = {}) {
    this.stop()
    this.spb = 60 / bpm
    this.t0 = opts.startTime ?? this.ctx.currentTime + 0.1
    this.next = 0
    this.maxBeats = opts.beats ?? Infinity
    this.accent = opts.accent ?? ((i) => i % 4 === 0)
    this.schedule()
    this.timer = window.setInterval(() => this.schedule(), TICK_MS)
  }

  /** Stop clicking, including clicks already scheduled a moment ahead. */
  stop() {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    for (const src of this.scheduled) {
      try {
        src.stop()
      } catch {
        // already finished
      }
    }
    this.scheduled = []
  }

  private schedule() {
    while (this.next < this.maxBeats && this.beatTime(this.next) < this.ctx.currentTime + LOOKAHEAD) {
      this.click(this.beatTime(this.next), this.accent(this.next))
      this.next++
    }
    if (this.next >= this.maxBeats && this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
  }

  private click(time: number, accent: boolean) {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = accent ? 4500 : 3000
    filter.Q.value = 0.8
    const env = this.ctx.createGain()
    env.gain.setValueAtTime(accent ? 1 : 0.6, time)
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.025)
    src.connect(filter).connect(env).connect(this.out)
    src.start(time)
    src.stop(time + 0.03)
    src.onended = () => {
      this.scheduled = this.scheduled.filter((s) => s !== src)
    }
    this.scheduled.push(src)
  }
}

/**
 * Accents for a run: the first count-in click, then the first beat of every
 * 6-string pass, so the strong clicks line up with the pattern being played.
 */
export function runAccents(countIn: number, passLength = 6): (beat: number) => boolean {
  return (i) => i === 0 || (i >= countIn && (i - countIn) % passLength === 0)
}
