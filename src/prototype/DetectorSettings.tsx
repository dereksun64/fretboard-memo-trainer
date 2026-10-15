import { useState } from 'react'
import { DEFAULT_SETTINGS, type AnalyzerSettings } from '../audio/analyzer'
import type { AudioEngine } from '../audio/engine'

interface Slider {
  key: keyof AnalyzerSettings
  label: string
  min: number
  max: number
  step: number
  hint: string
}

const SLIDERS: Slider[] = [
  { key: 'onsetRatio', label: 'Onset ratio', min: 1.2, max: 4, step: 0.1, hint: 'Lower = more sensitive to new plucks, more false triggers' },
  { key: 'clarityThreshold', label: 'Clarity threshold', min: 0.6, max: 0.99, step: 0.01, hint: 'Higher = stricter pitch confidence' },
  { key: 'minRms', label: 'Min level (RMS)', min: 0.0005, max: 0.02, step: 0.0005, hint: 'Absolute quietest sound treated as playing' },
  { key: 'noiseGateFactor', label: 'Noise gate ×', min: 1.5, max: 10, step: 0.5, hint: 'Gate = noise floor × this' },
]

export function DetectorSettings({ engine }: { engine: AudioEngine }) {
  const [settings, setSettings] = useState<AnalyzerSettings>(engine.analyzer.settings)

  const update = (next: AnalyzerSettings) => {
    engine.analyzer.settings = next
    setSettings(next)
  }

  return (
    <section className="card">
      <div className="row spread">
        <h2>Detector tuning</h2>
        <button onClick={() => update({ ...DEFAULT_SETTINGS })}>Reset</button>
      </div>
      {SLIDERS.map((s) => (
        <label key={s.key} className="slider">
          <span>
            {s.label} <span className="mono">{settings[s.key]}</span>
          </span>
          <input
            type="range"
            min={s.min}
            max={s.max}
            step={s.step}
            value={settings[s.key]}
            onChange={(e) => update({ ...settings, [s.key]: Number(e.target.value) })}
          />
          <span className="muted small">{s.hint}</span>
        </label>
      ))}
    </section>
  )
}
