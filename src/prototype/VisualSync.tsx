import { useState } from 'react'
import type { AudioEngine } from '../audio/engine'
import { useFrame } from './useFrame'

const BPM = 80
const FLASH_S = 0.09

/**
 * Line the highway up with what you hear: a note slides onto a line and the
 * line flashes on every click. Nudge the offset until flash and click land
 * together. Stored per device; Bluetooth headphones usually need more.
 */
export function VisualSync({ engine, onBusy }: { engine: AudioEngine; onBusy: () => void }) {
  const [running, setRunning] = useState(false)
  const [offset, setOffset] = useState(engine.visualOffsetMs)

  const toggle = () => {
    if (running) {
      engine.metronome.stop()
    } else {
      onBusy()
      engine.metronome.start(BPM)
    }
    setRunning(!running)
  }

  const change = (ms: number) => {
    setOffset(ms)
    engine.setVisualOffset(ms)
  }

  return (
    <section className="card">
      <h2>Visual sync</h2>
      <p className="muted small">
        Start the clicks and watch the line. If it flashes <em>before</em> you hear the click, move the slider
        right; if after, move it left. Re-check whenever you switch speakers or headphones.
      </p>
      <div className="row">
        <button className="primary" onClick={toggle}>
          {running ? 'Stop clicks' : 'Start clicks'}
        </button>
        <button onClick={() => change(0)}>Reset to 0</button>
      </div>
      {running && <SyncTrack engine={engine} />}
      <label className="slider">
        <span>
          Visual delay <span className="mono">{offset > 0 ? '+' : ''}{offset} ms</span>
        </span>
        <input
          type="range"
          min={-150}
          max={350}
          step={5}
          value={offset}
          onChange={(e) => change(Number(e.target.value))}
        />
        <span className="muted small">
          Reported output latency {Math.round(((engine.ctx.outputLatency || 0) + (engine.ctx.baseLatency || 0)) * 1000)} ms
          is already accounted for.
        </span>
      </label>
    </section>
  )
}

function SyncTrack({ engine }: { engine: AudioEngine }) {
  useFrame()
  const m = engine.metronome
  const spb = 60 / BPM
  const t = engine.displayTime()
  const i = m.nearestBeat(t)
  const sinceBeat = t - m.beatTime(i)
  const flash = sinceBeat >= 0 && sinceBeat < FLASH_S
  // A note that reaches the line on the next beat.
  const nextBeat = sinceBeat >= 0 ? i + 1 : i
  const toNext = (m.beatTime(nextBeat) - t) / spb // 1 -> 0

  return (
    <div className="sync-track" aria-hidden="true">
      <span className={`sync-line ${flash ? 'flash' : ''}`} />
      <span className="sync-note" style={{ left: `calc(15% + ${toNext * 70}%)` }} />
    </div>
  )
}
