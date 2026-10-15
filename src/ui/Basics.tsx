// Basics (Thomas's Exercise 1): wait mode. No metronome; each correct note
// moves you along, a wrong one restarts the run. The diagram stays visible.

import { useEffect, useRef, useState } from 'react'
import { getAudioEngine } from '../app/audio'
import { navigate } from '../app/navigate'
import type { AudioEngine } from '../audio/engine'
import { basicsDone, nextBasicsNote, type Progress } from '../engine/progress'
import { REPS, singleNoteRun, type Step } from '../engine/sequence'
import { feedWait, startWait, type WaitState } from '../engine/waitMode'
import { NATURALS, expectedMidi, midiToName, type Natural } from '../music/notes'
import { SelectionBox, Stripe, Tag } from './decor'
import { FretDiagram } from './FretDiagram'
import './play.css'

interface Props {
  progress: Progress
  windowStart: number
  onRunCleared: () => void
}

interface Run {
  note: Natural
  counts: boolean
  steps: Step[]
  expected: number[]
}

export function Basics({ progress, windowStart, onRunCleared }: Props) {
  const [engine, setEngine] = useState<AudioEngine | null>(null)
  const [run, setRun] = useState<Run | null>(null)
  const [wait, setWait] = useState<WaitState>(startWait)
  const [wrong, setWrong] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const waitRef = useRef(wait)
  waitRef.current = wait

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/')
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!engine || !run) return
    return engine.onNote((ev) => {
      const { state, outcome } = feedWait(waitRef.current, run.expected, ev.midi)
      if (outcome === 'done' && waitRef.current.done) return
      waitRef.current = state
      setWait(state)
      if (outcome === 'wrong') setWrong(midiToName(ev.midi))
      if (outcome === 'hit') setWrong(null)
      if (outcome === 'done') {
        setWrong(null)
        if (run.counts) onRunCleared()
      }
    })
  }, [engine, run, onRunCleared])

  const start = async () => {
    setError(null)
    try {
      const e = engine ?? (await getAudioEngine())
      setEngine(e)
      const queued = nextBasicsNote(progress)
      const note = queued ?? NATURALS[Math.floor(Math.random() * NATURALS.length)]
      const steps = singleNoteRun(note)
      setRun({ note, counts: queued !== null, steps, expected: steps.map((s) => expectedMidi(s.note, s.string, windowStart)) })
      const fresh = startWait()
      waitRef.current = fresh
      setWait(fresh)
      setWrong(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const total = progress.basics.queue.length
  const cleared = progress.basics.cleared
  const header = (
    <div className="play-head">
      <a href="#/" className="back">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span className="back-name">Basics</span>
      </a>
      <span className="label muted">
        {cleared}/{total} runs · no metronome
      </span>
    </div>
  )

  if (!run || !engine) {
    return (
      <main className="page play">
        {header}
        <section className="ready">
          <h1 className="display">Basics</h1>
          <p className="muted">
            Find one note on every string, 6 → 1 and back, three times. Take your time: the app waits for each
            note. A wrong note restarts the run. Look at the diagram as much as you like.
          </p>
          <p>
            {basicsDone(progress)
              ? 'Basics is complete. Replays are for warming up and don’t count.'
              : `${cleared} of ${total} runs cleared. Finish all ${total} to unlock Exercise 1.`}
          </p>
          <div>
            <button type="button" className="btn primary" onClick={start}>
              Start
            </button>
          </div>
          {error && <p style={{ color: 'var(--wrong)' }}>Couldn't open the microphone: {error}</p>}
        </section>
        <FretDiagram windowStart={windowStart} />
      </main>
    )
  }

  const current = run.steps[Math.min(wait.pos, run.steps.length - 1)]
  const perRep = run.steps.length / REPS

  return (
    <main className="page play">
      {header}
      <section className="target-row">
        <div className="target">
          <SelectionBox>
            <span className="target-note display">{run.note}</span>
          </SelectionBox>
          <div className="target-side">
            <span className="target-string">{wait.done ? 'run cleared' : `string ${current.string}`}</span>
            <Stripe width={96} />
          </div>
        </div>
        <div className="feedback" aria-live="polite">
          {wrong && (
            <span className="judgment">
              <Tag>Wrong</Tag>
              <span className="muted">heard {wrong}, starting the run again</span>
            </span>
          )}
          <span className="muted">
            <span className="combo display">{wait.pos}</span> / {run.steps.length}
          </span>
        </div>
      </section>

      <div className="wait-grid" aria-label="Run steps">
        {Array.from({ length: REPS }, (_, r) => (
          <div key={r} className="wait-row">
            {run.steps.slice(r * perRep, (r + 1) * perRep).map((s, i) => {
              const idx = r * perRep + i
              const state = idx < wait.pos ? 'done' : idx === wait.pos && !wait.done ? 'now' : ''
              return (
                <span key={idx} className={`wait-cell ${state}`}>
                  <span className="label">S{s.string}</span>
                </span>
              )
            })}
          </div>
        ))}
      </div>

      {wait.done && (
        <section className="results">
          <div className="results-main">
            <span className="results-title display cleared">Run cleared</span>
            <span className="muted">
              {run.counts ? `${cleared} of ${total} Basics runs done.` : 'Replay: doesn’t count.'}
              {wait.restarts > 0 && ` Restarted ${wait.restarts} time${wait.restarts === 1 ? '' : 's'}.`}
            </span>
          </div>
          <div className="results-actions">
            {basicsDone(progress) && run.counts ? (
              <a className="btn primary" href="#/play/1">
                On to Exercise 01
              </a>
            ) : (
              <button type="button" className="btn primary" onClick={start} autoFocus>
                Next note
              </button>
            )}
            <a className="btn" href="#/">
              Exercises
            </a>
          </div>
        </section>
      )}

      <FretDiagram windowStart={windowStart} />
    </main>
  )
}
