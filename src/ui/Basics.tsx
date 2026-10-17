// Basics (Thomas's Exercise 1): wait mode. No metronome; each correct note
// slides the next one onto the hit line; a wrong one is flagged and the app
// keeps waiting for the right note. The diagram stays visible.

import { useEffect, useMemo, useRef, useState } from 'react'
import { getAudioEngine } from '../app/audio'
import { navigate } from '../app/navigate'
import { useFrameValue } from '../app/useNow'
import type { AudioEngine } from '../audio/engine'
import type { BeatResult, BeatTarget } from '../engine/judge'
import { basicsDone, nextBasicsNote, type Progress } from '../engine/progress'
import { singleNoteRun, type Step } from '../engine/sequence'
import { feedWait, startWait, type WaitState } from '../engine/waitMode'
import { NATURALS, expectedMidi, midiToName, stringLabel, type Natural } from '../music/notes'
import { SelectionBox, Stripe, Tag } from './decor'
import { FretDiagram } from './FretDiagram'
import { Highway, type Flash } from './Highway'
import './play.css'

interface Props {
  progress: Progress
  windowStart: number
  onRunCleared: () => void
}

interface Run {
  id: number
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
  const [flashes, setFlashes] = useState<Flash[]>([])
  // Show the result once the last note has slid past and faded.
  const [showDone, setShowDone] = useState(false)
  useEffect(() => {
    if (!wait.done) return setShowDone(false)
    const t = setTimeout(() => setShowDone(true), 700)
    return () => clearTimeout(t)
  }, [wait.done])
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
      const prev = waitRef.current
      const { state, outcome } = feedWait(prev, run.expected, ev.midi)
      if (outcome === 'done' && waitRef.current.done) return
      waitRef.current = state
      setWait(state)
      if (outcome === 'wrong') {
        setWrong(midiToName(ev.midi))
        const string = run.steps[prev.pos].string
        setFlashes((f) => [...f.slice(-3), { id: Date.now(), string, judgment: 'wrong', at: performance.now() }])
      }
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
      setRun({ id: Date.now(), note, counts: queued !== null, steps, expected: steps.map((s) => expectedMidi(s.note, s.string, windowStart)) })
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
            note, and a wrong note just shows what it heard. Look at the diagram as much as you like.
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
          {error && (
            <p role="alert" style={{ color: 'var(--wrong)' }}>
              {error}
            </p>
          )}
        </section>
        <FretDiagram windowStart={windowStart} />
      </main>
    )
  }

  const current = run.steps[Math.min(wait.pos, run.steps.length - 1)]

  return (
    <main className="page play">
      {header}
      <section className="target-row">
        <div className="target">
          <SelectionBox>
            <span className="target-note display">{run.note}</span>
          </SelectionBox>
          <div className="target-side">
            <span className="target-string">{wait.done ? 'run cleared' : `${stringLabel(current.string)} string`}</span>
            <Stripe width={96} />
          </div>
        </div>
        <div className="feedback" aria-live="polite">
          <span className="judgment-slot wide">
            {wrong && (
              <>
                <Tag>Wrong</Tag>
                <span className="muted">
                  heard <span className="mono">{wrong}</span>, try again
                </span>
              </>
            )}
          </span>
          <span className="combo-slot muted">
            <span className="combo display">{wait.pos}</span> / {run.steps.length}
          </span>
        </div>
      </section>

      <div className="stage">
        <BasicsHighway key={run.id} steps={run.steps} wait={wait} flashes={flashes} />
        {showDone && (
        <section className="results overlay">
          <div className="results-main">
            <span className="results-title display cleared">Run cleared</span>
            <span className="muted">
              {run.counts ? `${cleared} of ${total} Basics runs done.` : 'Replay: doesn’t count.'}
              {wait.wrong > 0 && ` ${wait.wrong} wrong note${wait.wrong === 1 ? '' : 's'} along the way.`}
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
      </div>

      <FretDiagram windowStart={windowStart} />
    </main>
  )
}

/**
 * The highway in wait mode: positions instead of seconds. The "clock" eases
 * toward the next note's index, so each correct note slides the run along.
 */
function BasicsHighway({ steps, wait, flashes }: { steps: Step[]; wait: WaitState; flashes: Flash[] }) {
  const pos = useRef(0)
  const last = useRef(performance.now())
  const target = wait.done ? steps.length : wait.pos
  const now = useFrameValue(() => {
    const t = performance.now()
    const dt = Math.min(0.1, (t - last.current) / 1000)
    last.current = t
    pos.current += (target - pos.current) * (1 - Math.exp(-dt * 12))
    if (Math.abs(target - pos.current) < 0.002) pos.current = target
    return pos.current
  })
  const beats = useMemo<BeatTarget[]>(() => steps.map((_, i) => ({ time: i, expectedMidi: 0 })), [steps])
  const results: BeatResult[] = steps.map((_, i) => ({ judgment: i < target ? 'perfect' : 'pending' }))
  return (
    <Highway
      steps={steps}
      beats={beats}
      results={results}
      now={now}
      spb={1}
      next={wait.done ? -1 : wait.pos}
      approachCircles={false}
      flashes={flashes}
    />
  )
}
