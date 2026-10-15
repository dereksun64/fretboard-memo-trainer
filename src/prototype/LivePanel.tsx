import type { AudioEngine } from '../audio/engine'
import { midiToName } from '../music/notes'
import { useFrame } from './useFrame'

const DB_MIN = -70

function toPct(rms: number): number {
  const db = 20 * Math.log10(Math.max(rms, 1e-7))
  return Math.max(0, Math.min(100, ((db - DB_MIN) / -DB_MIN) * 100))
}

export function LivePanel({ engine }: { engine: AudioEngine }) {
  useFrame()
  const live = engine.livePitch
  const nearest = live.midi === null ? null : Math.round(live.midi)
  const cents = live.midi === null || nearest === null ? 0 : Math.round((live.midi - nearest) * 100)
  const hz = live.midi === null ? null : 440 * 2 ** ((live.midi - 69) / 12)

  return (
    <section className="card live">
      <h2>Live pitch</h2>
      <div className="big-note">{nearest === null ? '–' : midiToName(nearest)}</div>
      <div className="cents">
        <div className="cents-track">
          <div className="cents-center" />
          {nearest !== null && (
            <div
              className={`cents-needle ${Math.abs(cents) <= 10 ? 'in-tune' : ''}`}
              style={{ left: `${50 + cents}%` }}
            />
          )}
        </div>
        <span className="muted small">
          {nearest === null ? 'no pitch' : `${cents > 0 ? '+' : ''}${cents} cents · ${hz!.toFixed(1)} Hz`}
        </span>
      </div>
      <div className="meter" title="Input level">
        <div className="meter-fill" style={{ width: `${toPct(live.rms)}%` }} />
        <div className="meter-floor" style={{ left: `${toPct(live.noiseFloor)}%` }} />
      </div>
      <p className="muted small">
        Level {(20 * Math.log10(Math.max(live.rms, 1e-7))).toFixed(0)} dB · clarity{' '}
        {live.clarity.toFixed(2)} · tick marks the noise floor
      </p>
    </section>
  )
}
