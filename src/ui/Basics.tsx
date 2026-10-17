// Basics (Thomas's Exercise 1): wait mode. No metronome; each correct note
// slides the next one onto the hit line; a wrong one is flagged and the app
// keeps waiting for the right note. The diagram stays visible. Clicking the
// big letter picks which note to play.

import { useEffect, useMemo, useRef, useState } from 'react'
import { getAudioEngine } from '../app/audio'
import { navigate } from '../app/navigate'
import { useFrameValue } from '../app/useNow'
import type { AudioEngine } from '../audio/engine'
import type { BeatResult, BeatTarget } from '../engine/judge'
import { basicsDone, basicsRunsLeft, nextBasicsNote, type Progress } from '../engine/progress'
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
  /** Move `note` to the front of the Basics queue so a run of it counts. */
  onPickNote: (note: Natural) => void
  /** Mark Basics done without playing it. */
  onSkip: () => void
}

interface Run {
  id: number
  note: Natural
  counts: boolean
  steps: Step[]
  expected: number[]
}

export function Basics({ progress, windowStart, onRunCleared, onPickNote, onSkip }: Props) {
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
  // The note picker opened from the big letter.
  const [picking, setPicking] = useState(false)
  const pickingRef = useRef(picking)
  pickingRef.current = picking
  const restartRef = useRef<(() => void) | null>(null)
  const randomRef = useRef<(() => void) | null>(null)
  const [diagram, setDiagram] = useState(true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') {
        if (pickingRef.current) setPicking(false)
        else navigate('/')
        return
      }
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'd' || e.key === 'D') setDiagram((d) => !d)
      if (e.key === 'r' || e.key === 'R') {
        if (!e.repeat) restartRef.current?.()
      }
      // Tab jumps to a random note (Shift+Tab still moves focus back).
      if (e.key === 'Tab' && !e.shiftKey && randomRef.current) {
        e.preventDefault()
        if (!e.repeat) randomRef.current()
      }
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

  /** Start a run: the queued note, or `picked` (which counts if it still has runs left). */
  const start = async (picked?: Natural) => {
    setError(null)
    setPicking(false)
    try {
      const e = engine ?? (await getAudioEngine())
      setEngine(e)
      let note: Natural
      let counts: boolean
      if (picked) {
        note = picked
        counts = !basicsDone(progress) && basicsRunsLeft(progress, picked) > 0
        if (counts) onPickNote(picked)
      } else {
        const queued = nextBasicsNote(progress)
        note = queued ?? NATURALS[Math.floor(Math.random() * NATURALS.length)]
        counts = queued !== null
      }
      const steps = singleNoteRun(note)
      setRun({ id: Date.now(), note, counts, steps, expected: steps.map((s) => expectedMidi(s.note, s.string, windowStart)) })
      const fresh = startWait()
      waitRef.current = fresh
      setWait(fresh)
      setWrong(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }
  /** Play the same note again from the top. */
  const restart = () => run && start(run.note)
  restartRef.current = run && engine ? restart : null
  /** A random different note, preferring ones whose run still counts. */
  const random = () => {
    const others = NATURALS.filter((n) => n !== run?.note)
    const counting = basicsDone(progress) ? [] : others.filter((n) => basicsRunsLeft(progress, n) > 0)
    const pool = counting.length ? counting : others
    start(pool[Math.floor(Math.random() * pool.length)])
  }
  randomRef.current = run && engine ? random : null

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
            note, and a wrong note just shows what it heard. Look at the diagram as much as you like. To play
            a different note, click the big letter. Press Tab for a random note, D to toggle the diagram, R to restart a run, Esc to leave.
          </p>
          <p>
            {basicsDone(progress)
              ? 'Basics is complete. Replays are for warming up and don’t count.'
              : `${cleared} of ${total} runs cleared. Finish all ${total} to unlock Exercise 1.`}
          </p>
          <div className="ready-actions">
            <button type="button" className="btn primary" onClick={() => start()}>
              Start
            </button>
            {!basicsDone(progress) && (
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  onSkip()
                  navigate('/')
                }}
              >
                Skip Basics
              </button>
            )}
          </div>
          {error && (
            <p role="alert" style={{ color: 'var(--wrong)' }}>
              {error}
            </p>
          )}
        </section>
        {diagram && <FretDiagram windowStart={windowStart} />}
      </main>
    )
  }

  const current = run.steps[Math.min(wait.pos, run.steps.length - 1)]

  return (
    <main className="page play">
      {header}
      <section className="target-row">
        <div className="target">
          <div className="note-pick-wrap">
            <SelectionBox>
              <button
                type="button"
                className="target-note display note-pick"
                aria-haspopup="true"
                aria-expanded={picking}
                aria-label={`Note ${run.note}. Pick a different note`}
                title="Pick a note"
                onClick={() => setPicking((v) => !v)}
              >
                {run.note}
                <span className="note-pick-hint" aria-hidden="true">
                  Pick a note…
                </span>
              </button>
            </SelectionBox>
            {picking && (
              <NotePicker
                current={run.note}
                runsLeft={(n) => (basicsDone(progress) ? null : basicsRunsLeft(progress, n))}
                onPick={(n) => start(n)}
                onClose={() => setPicking(false)}
              />
            )}
          </div>
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
              <button type="button" className="btn primary" onClick={() => start()} autoFocus>
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

      <section className="play-foot">
        <div className="counts">
          <span className="count">
            <span className="dot perfect" />
            <span className="count-num mono">{wait.pos}</span>
            <span className="label muted">hit</span>
          </span>
          <span className="count">
            <span className="dot wrong" />
            <span className="count-num mono">{wait.wrong}</span>
            <span className="label muted">wrong</span>
          </span>
        </div>
        <div className="foot-actions">
          <button type="button" className="btn" onClick={random}>
            Random <span className="label muted">Tab</span>
          </button>
          <button type="button" className="btn" onClick={restart}>
            Restart <span className="label muted">R</span>
          </button>
          <button type="button" className="btn" aria-pressed={diagram} onClick={() => setDiagram((d) => !d)}>
            Diagram <span className="label muted">D</span>
          </button>
          <a className="btn ghost" href="#/">
            Stop <span className="label muted">Esc</span>
          </a>
        </div>
      </section>

      {diagram && <FretDiagram windowStart={windowStart} />}
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

/**
 * The seven naturals under the big letter. Each shows how many of its
 * Basics runs are left; a note with none left plays as a replay.
 */
function NotePicker({
  current,
  runsLeft,
  onPick,
  onClose,
}: {
  current: Natural
  /** null once Basics is done (every run is a replay). */
  runsLeft: (note: Natural) => number | null
  onPick: (note: Natural) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node) && !(e.target as Element).closest?.('.note-pick')) onClose()
    }
    addEventListener('pointerdown', onDown)
    return () => removeEventListener('pointerdown', onDown)
  }, [onClose])
  return (
    <div ref={ref} className="note-picker" role="menu" aria-label="Pick a note">
      <span className="label muted note-picker-title">Pick a note</span>
      <div className="note-picker-row">
        {NATURALS.map((n) => {
          const left = runsLeft(n)
          return (
            <button
              key={n}
              type="button"
              role="menuitem"
              className={`note-picker-btn ${n === current ? 'current' : ''} ${left === 0 ? 'spent' : ''}`}
              onClick={() => onPick(n)}
              autoFocus={n === current}
            >
              <span className="display">{n}</span>
              <span className="label muted">{left === null ? '' : left === 0 ? 'done' : `${left} left`}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
