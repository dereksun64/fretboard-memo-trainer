import { useState } from 'react'
import { getAudioEngine } from '../app/audio'
import type { AudioEngine } from '../audio/engine'
import { BpmInput } from './BpmInput'
import { Calibration } from './Calibration'
import { DetectorSettings } from './DetectorSettings'
import { LivePanel } from './LivePanel'
import { NoteLog } from './NoteLog'
import { RunTest } from './RunTest'
import { VisualSync } from './VisualSync'

export function App() {
  const [engine, setEngine] = useState<AudioEngine | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const start = async () => {
    setStarting(true)
    setError(null)
    try {
      setEngine(await getAudioEngine())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setStarting(false)
    }
  }

  return (
    <main>
      <header>
        <h1>Detection lab</h1>
        <p className="muted">
          See what the mic hears, check timing against the metronome, and calibrate input latency and
          visual sync.
        </p>
      </header>
      {engine ? (
        <Prototype engine={engine} />
      ) : (
        <section className="card start">
          <p>Headphones are recommended so the metronome doesn't bleed into the mic.</p>
          <button className="primary" onClick={start} disabled={starting}>
            {starting ? 'Opening mic…' : 'Start mic'}
          </button>
          {error && <p className="error">Couldn't open the mic: {error}</p>}
        </section>
      )}
    </main>
  )
}

function Prototype({ engine }: { engine: AudioEngine }) {
  const [bpm, setBpm] = useState(40)
  const [metroOn, setMetroOn] = useState(false)
  const [volume, setVolume] = useState(0.6)

  const toggleMetronome = () => {
    if (metroOn) engine.metronome.stop()
    else engine.metronome.start(bpm)
    setMetroOn(!metroOn)
  }

  const changeBpm = (v: number) => {
    setBpm(v)
    if (metroOn) engine.metronome.start(v)
  }

  return (
    <div className="grid">
      <LivePanel engine={engine} />

      <section className="card">
        <h2>Metronome</h2>
        <div className="row">
          <label>
            BPM
            <BpmInput value={bpm} onChange={changeBpm} />
          </label>
          <button onClick={toggleMetronome}>{metroOn ? 'Stop' : 'Start'} metronome</button>
        </div>
        <label>
          Click volume
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => {
              const v = Number(e.target.value)
              setVolume(v)
              engine.metronome.volume = v
            }}
          />
        </label>
        <p className="muted small">
          {engine.micLabel || 'Mic'} · {engine.ctx.sampleRate} Hz · base latency{' '}
          {Math.round(engine.ctx.baseLatency * 1000)} ms · output latency{' '}
          {Math.round((engine.ctx.outputLatency || 0) * 1000)} ms
        </p>
      </section>

      <Calibration engine={engine} onBusy={() => setMetroOn(false)} />
      <VisualSync engine={engine} onBusy={() => setMetroOn(false)} />
      <RunTest engine={engine} bpm={bpm} onBusy={() => setMetroOn(false)} />
      <NoteLog engine={engine} bpm={bpm} />
      <DetectorSettings engine={engine} />
    </div>
  )
}
