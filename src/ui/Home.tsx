import { useState } from 'react'
import type { Settings } from '../app/settings'
import { EXERCISES } from '../engine/pools'
import {
  DEFAULT_INCREASE,
  MAX_INCREASE,
  MIN_INCREASE,
  START_LEVEL,
  TARGET_LEVEL,
  basicsDone,
  canIncreaseBpm,
  clearedCount,
  currentExercise,
  exercisesCleared,
  isUnlocked,
  levelBar,
  poolSize,
  type Progress,
} from '../engine/progress'
import { AppearanceControls } from './AppearanceControls'
import { SelectionBox, Stripe, Tag, useStyle } from './decor'
import { EXERCISE_INFO, exerciseCode } from './exercises'
import './home.css'

interface Props {
  progress: Progress
  settings: Settings
  onSettings: (patch: Partial<Settings>) => void
  onIncreaseBpm: (delta: number) => void
}

export function Home({ progress, settings, onSettings, onIncreaseBpm }: Props) {
  const style = useStyle()
  const level = progress.level
  const bar = levelBar(level)
  const current = currentExercise(progress)
  const basicsCleared = basicsDone(progress)
  const ready = canIncreaseBpm(progress)

  return (
    <main className="page home" style={{ maxWidth: 960 }}>
      <header className="home-head">
        <div className="wordmark">
          <span className="display">Fretboard</span>
          {style === 'blueprint' && <span className="label muted">Trainer</span>}
          <Stripe width={108} />
        </div>
        <AppearanceControls settings={settings} onSettings={onSettings} />
      </header>

      <section className="level">
        <div className="level-num">
          <span className="label muted" style={{ fontSize: 13 }}>
            Level
          </span>
          <SelectionBox>
            <span className="level-value">
              <span className="display" style={{ color: style === 'retro' ? 'var(--accent)' : undefined }}>
                {level}
              </span>
              <span className="label muted">BPM</span>
            </span>
          </SelectionBox>
        </div>
        <div className="level-bar">
          <div className="bar-head">
            <span>{bar.mastered ? 'Fretboard mastered' : `Toward ${TARGET_LEVEL} BPM`}</span>
            <span className="muted">
              {bar.mastered ? `+${level - TARGET_LEVEL} past ${TARGET_LEVEL}` : `${TARGET_LEVEL - level} to go`}
            </span>
          </div>
          <div
            className="bar"
            role="progressbar"
            aria-label={`Progress from ${START_LEVEL} to ${TARGET_LEVEL} BPM`}
            aria-valuemin={START_LEVEL}
            aria-valuemax={TARGET_LEVEL}
            aria-valuenow={Math.min(level, TARGET_LEVEL)}
          >
            <span className="bar-fill" style={{ width: `${bar.fill * 100}%` }} />
            <span className="bar-rainbow" style={{ width: `${bar.fill * 100}%`, opacity: bar.rainbow }} />
          </div>
          <div className="bar-ticks label muted">
            {[40, 50, 60, 70, 80].map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
          <span className="muted" style={{ fontSize: 14 }}>
            Clear all exercises to increase BPM.{' '}
            <span style={{ color: 'var(--ink)' }}>
              {exercisesCleared(progress)} of {EXERCISES.length} done.
            </span>
          </span>
        </div>
      </section>

      {ready && <IncreaseBpm level={level} onIncrease={onIncreaseBpm} />}

      <section className="list" aria-label="Exercises">
        <div className={`row ${basicsCleared ? '' : 'current'}`}>
          <span className="row-code label">{style === 'blueprint' ? 'EX–00' : '00'}</span>
          <div className="row-main">
            <span className="row-name">
              Basics {!basicsCleared && <Tag>{style === 'retro' ? 'Current' : 'Start here'}</Tag>}
            </span>
            <span className="muted">Untimed walkthrough: play each note at your own pace.</span>
          </div>
          <div className="row-progress">
            <span className="label muted">
              {progress.basics.cleared}/{progress.basics.queue.length} runs
            </span>
          </div>
          <a className={`btn ${basicsCleared ? '' : 'primary'}`} href="#/basics">
            {basicsCleared ? 'Replay' : 'Play'}
          </a>
        </div>

        {EXERCISES.map((ex) => {
          const unlocked = isUnlocked(progress, ex)
          const done = clearedCount(progress, ex)
          const total = poolSize(progress, ex)
          const isCurrent = ex === current
          const info = EXERCISE_INFO[ex]
          return (
            <div key={ex} className={`row ${isCurrent ? 'current' : ''} ${unlocked ? '' : 'locked'}`}>
              <span className="row-code label">{style === 'blueprint' ? `EX–${exerciseCode(ex)}` : exerciseCode(ex)}</span>
              <div className="row-main">
                <span className="row-name">
                  {info.name} {isCurrent && <Tag>Up next</Tag>}
                </span>
                <span className="muted">{info.desc}</span>
              </div>
              <div className="row-progress">
                <span className="pips" aria-hidden="true">
                  {Array.from({ length: total }, (_, i) => (
                    <span key={i} className={i < done ? 'on' : ''} />
                  ))}
                </span>
                <span className="label muted">
                  {unlocked ? `${done}/${total} at ${level} BPM` : `Clear ${ex === 1 ? 'Basics' : `Exercise ${exerciseCode(ex - 1)}`} first`}
                </span>
              </div>
              {unlocked ? (
                <a className={`btn ${isCurrent ? 'primary' : ''}`} href={`#/play/${ex}`}>
                  {done === total ? 'Replay' : 'Play'}
                </a>
              ) : (
                <button type="button" className="btn" disabled>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                  Locked
                </button>
              )}
            </div>
          )
        })}
      </section>

      <footer className="home-foot muted">
        <span>
          Timing off? Calibrate in the <a href="#/lab">detection lab</a>.
        </span>
        <span>
          <a href="#/about">About</a> · <a href="#/about">Your audio never leaves this device</a>
        </span>
      </footer>
    </main>
  )
}

function IncreaseBpm({ level, onIncrease }: { level: number; onIncrease: (delta: number) => void }) {
  const [delta, setDelta] = useState(DEFAULT_INCREASE)
  return (
    <section className="increase" aria-label="Increase BPM">
      <div>
        <span className="row-name">All exercises cleared at {level} BPM.</span>
        <span className="muted"> Pick how much to speed up.</span>
      </div>
      <div className="stepper">
        <button type="button" className="btn" aria-label="Smaller increase" disabled={delta <= MIN_INCREASE} onClick={() => setDelta(delta - 1)}>
          −
        </button>
        <span className="mono" style={{ minWidth: 48, textAlign: 'center', fontSize: 18 }}>
          +{delta}
        </span>
        <button type="button" className="btn" aria-label="Larger increase" disabled={delta >= MAX_INCREASE} onClick={() => setDelta(delta + 1)}>
          +
        </button>
        <button type="button" className="btn primary" onClick={() => onIncrease(delta)}>
          Increase to {level + delta} BPM
        </button>
      </div>
    </section>
  )
}
