// Wires the mic, the capture worklet, the note analyzer and the metronome
// onto one AudioContext, so every timestamp shares the same clock.

import { DEFAULT_SETTINGS, NoteAnalyzer, type LivePitch, type NoteEvent } from './analyzer'
import { Metronome } from './metronome'

type NoteListener = (ev: NoteEvent) => void

const LATENCY_KEY = 'fmt.latencyMs'
const VISUAL_KEY = 'fmt.visualOffsetMs'

export class AudioEngine {
  readonly ctx: AudioContext
  readonly metronome: Metronome
  readonly analyzer: NoteAnalyzer
  private readonly listeners = new Set<NoteListener>()
  private stream: MediaStream | null = null
  /** Measured input+output latency in ms; subtract from onset times. */
  latencyMs: number
  /** Extra delay for visuals in ms, tuned by eye in the lab's visual sync check. */
  visualOffsetMs: number

  private constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.metronome = new Metronome(ctx)
    this.analyzer = new NoteAnalyzer(ctx.sampleRate, DEFAULT_SETTINGS)
    this.latencyMs = loadNumber(LATENCY_KEY)
    this.visualOffsetMs = loadNumber(VISUAL_KEY)
  }

  /** Must be called from a user gesture (browser autoplay rules). */
  static async start(): Promise<AudioEngine> {
    const ctx = new AudioContext({ latencyHint: 'interactive' })
    const engine = new AudioEngine(ctx)
    await engine.openMic()
    return engine
  }

  private async openMic() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
    })
    await this.ctx.audioWorklet.addModule(`${import.meta.env.BASE_URL}capture-worklet.js`)
    const source = this.ctx.createMediaStreamSource(this.stream)
    const capture = new AudioWorkletNode(this.ctx, 'capture')
    capture.port.onmessage = (e: MessageEvent<{ frame: number; samples: Float32Array }>) => {
      const events = this.analyzer.push(e.data.samples, e.data.frame)
      for (const ev of events) for (const l of this.listeners) l(ev)
    }
    // Keep the worklet pulled by the graph without making it audible.
    const sink = this.ctx.createGain()
    sink.gain.value = 0
    source.connect(capture).connect(sink).connect(this.ctx.destination)
    await this.ctx.resume()
  }

  get livePitch(): LivePitch {
    return this.analyzer.livePitch
  }

  get micLabel(): string {
    return this.stream?.getAudioTracks()[0]?.label ?? ''
  }

  /**
   * The audio-clock time you are hearing right now. `ctx.currentTime` runs
   * ahead of the speakers by the output latency (larger with Bluetooth), so
   * anything drawn in time with the metronome should use this instead, plus
   * the user's visual offset.
   */
  displayTime(): number {
    const ctx = this.ctx
    let heard: number
    const ts = typeof ctx.getOutputTimestamp === 'function' ? ctx.getOutputTimestamp() : null
    if (ts?.contextTime && ts.performanceTime) {
      heard = ts.contextTime + (performance.now() - ts.performanceTime) / 1000
    } else {
      heard = ctx.currentTime - (ctx.outputLatency || 0) - (ctx.baseLatency || 0)
    }
    return heard - this.visualOffsetMs / 1000
  }

  /** Onset time corrected for measured latency. */
  corrected(ev: NoteEvent): number {
    return ev.time - this.latencyMs / 1000
  }

  onNote(listener: NoteListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  setLatency(ms: number) {
    this.latencyMs = ms
    saveNumber(LATENCY_KEY, ms)
  }

  setVisualOffset(ms: number) {
    this.visualOffsetMs = ms
    saveNumber(VISUAL_KEY, ms)
  }
}

function loadNumber(key: string): number {
  try {
    const v = Number(localStorage.getItem(key))
    return Number.isFinite(v) ? v : 0
  } catch {
    return 0
  }
}

function saveNumber(key: string, v: number) {
  try {
    localStorage.setItem(key, String(v))
  } catch {
    // storage unavailable; keep it for this session only
  }
}
