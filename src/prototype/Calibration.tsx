import { useEffect, useRef, useState } from 'react'
import type { AudioEngine } from '../audio/engine'
import { useFrame } from './useFrame'

const BPM = 80
const COUNT_IN = 4
const PLAY_BEATS = 8
const MAX_OFFSET = 0.35 // s; ignore notes further than this from a click
const MIN_SAMPLES = 5

type State =
  | { kind: 'idle' }
  | { kind: 'running'; t0: number }
  | { kind: 'done'; latencyMs: number; offsets: number[] }
  | { kind: 'failed'; reason: string }

export function Calibration({ engine, onBusy }: { engine: AudioEngine; onBusy: () => void }) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const onsets = useRef<number[]>([])

  useEffect(() => engine.onNote((ev) => onsets.current.push(ev.time)), [engine])

  const start = () => {
    onBusy()
    onsets.current = []
    const t0 = engine.ctx.currentTime + 0.3
    engine.metronome.start(BPM, { startTime: t0, beats: COUNT_IN + PLAY_BEATS })
    setState({ kind: 'running', t0 })
  }

  return (
    <section className="card">
      <h2>Latency calibration</h2>
      <p className="muted small">
        After 4 count-in clicks, pluck any note exactly on each of the next 8 clicks. Uses raw
        (uncorrected) onset times. Current offset: <span className="mono">{engine.latencyMs} ms</span>
      </p>
      {state.kind === 'running' ? (
        <Running
          engine={engine}
          t0={state.t0}
          onFinish={() => setState(finish(onsets.current, state.t0, engine))}
        />
      ) : (
        <div className="row">
          <button className="primary" onClick={start}>
            Calibrate
          </button>
          <button onClick={() => engine.setLatency(0)}>Reset to 0</button>
        </div>
      )}
      {state.kind === 'done' && (
        <p>
          Latency set to <strong>{state.latencyMs} ms</strong>{' '}
          <span className="muted small">
            (offsets: {state.offsets.map((o) => Math.round(o)).join(', ')} ms)
          </span>
        </p>
      )}
      {state.kind === 'failed' && <p className="error">{state.reason}</p>}
    </section>
  )
}

function Running({ engine, t0, onFinish }: { engine: AudioEngine; t0: number; onFinish: () => void }) {
  useFrame()
  const spb = 60 / BPM
  const now = engine.ctx.currentTime
  const beat = Math.floor((now - t0) / spb)
  const end = t0 + (COUNT_IN + PLAY_BEATS - 1) * spb + MAX_OFFSET + 0.3

  useEffect(() => {
    if (now > end) onFinish()
  })

  const label =
    beat < 0 ? 'Get ready…' : beat < COUNT_IN ? `Count-in ${COUNT_IN - beat}` : `Play! ${Math.min(beat - COUNT_IN + 1, PLAY_BEATS)} / ${PLAY_BEATS}`
  return <div className="big-label">{label}</div>
}

function finish(onsets: number[], t0: number, engine: AudioEngine): State {
  const spb = 60 / BPM
  const offsets: number[] = []
  for (let i = COUNT_IN; i < COUNT_IN + PLAY_BEATS; i++) {
    const beat = t0 + i * spb
    let best: number | null = null
    for (const t of onsets) {
      const d = t - beat
      if (Math.abs(d) <= MAX_OFFSET && (best === null || Math.abs(d) < Math.abs(best))) best = d
    }
    if (best !== null) offsets.push(best * 1000)
  }
  if (offsets.length < MIN_SAMPLES) {
    return {
      kind: 'failed',
      reason: `Only caught ${offsets.length} of ${PLAY_BEATS} notes near the clicks. Try again, a little louder.`,
    }
  }
  const sorted = [...offsets].sort((a, b) => a - b)
  const latencyMs = Math.round(sorted[Math.floor(sorted.length / 2)])
  engine.setLatency(latencyMs)
  return { kind: 'done', latencyMs, offsets }
}
